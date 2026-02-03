/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { ConsentGrant, ConsentGrantStatus, ConsentType, UserConsent, ConsentStatus, DiscordApiErrors, User } from "@spacebar/util";
import { FindOptionsWhere } from "typeorm";

const router: Router = Router();

router.get(
    "/",
    route({
        summary: "List consent grant requests",
        description: "Returns all consent grant requests for the authenticated user (both as grantor and requester). Based on GNAP (RFC 9635) grant negotiation principles.",
        query: {
            status: {
                type: "string",
                required: false,
                description: "Filter by grant status",
                values: Object.values(ConsentGrantStatus),
            },
            consent_type: {
                type: "string",
                required: false,
                description: "Filter by consent type",
                values: Object.values(ConsentType),
            },
            as_requester: {
                type: "boolean",
                required: false,
                description: "If true, list grants where user is the requester; if false, list grants where user is the grantor",
            },
        },
        responses: {
            200: { body: "ConsentGrantListResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const { status, consent_type, as_requester } = req.query;

        const where: FindOptionsWhere<ConsentGrant> = {};

        if (as_requester === "true") {
            where.requester_id = user_id;
        } else {
            where.user_id = user_id;
        }

        if (status) {
            where.status = status as ConsentGrantStatus;
        }
        if (consent_type) {
            where.consent_type = consent_type as ConsentType;
        }

        const grants = await ConsentGrant.find({ where });

        res.json({
            grants: grants.map((g) => g.toJSON()),
        });
    },
);

router.post(
    "/",
    route({
        summary: "Request a consent grant (GNAP-like)",
        description:
            "Initiates a consent grant request to another user. Based on GNAP (RFC 9635) grant negotiation. The target user will receive the request and can approve, deny, or negotiate.",
        requestBody: "ConsentGrantRequestSchema",
        responses: {
            200: { body: "ConsentGrantResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const requester_id = req.user_id!;
        const { user_id, consent_type = ConsentType.CUSTOM, service_id, item_id, requested_access, interaction_url, expires_at, extra_data } = req.body;

        const targetUser = await User.findOne({ where: { id: user_id } });
        if (!targetUser) {
            throw DiscordApiErrors.UNKNOWN_USER;
        }

        const grant = ConsentGrant.create({
            user_id,
            requester_id,
            consent_type,
            service_id,
            item_id,
            status: ConsentGrantStatus.PENDING,
            requested_access,
            interaction_url,
            expires_at: expires_at ? new Date(expires_at) : undefined,
            extra_data,
        });

        grant.generateContinueToken();
        await grant.save();

        res.json(grant.toJSON());
    },
);

router.get(
    "/:grant_id",
    route({
        summary: "Get consent grant details",
        description: "Returns details of a specific consent grant request. Only accessible by the grantor or requester.",
        responses: {
            200: { body: "ConsentGrantResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const grant_id = req.params.grant_id;

        const grant = await ConsentGrant.findOne({
            where: [
                { id: grant_id, user_id },
                { id: grant_id, requester_id: user_id },
            ],
        });

        if (!grant) {
            throw DiscordApiErrors.UNKNOWN_CONSENT_GRANT;
        }

        res.json(grant.toJSON());
    },
);

router.post(
    "/:grant_id/approve",
    route({
        summary: "Approve a consent grant request",
        description: "Approves a pending consent grant request. Creates the corresponding UserConsent record. Only the target user (grantor) can approve.",
        requestBody: "ConsentGrantApproveSchema",
        responses: {
            200: { body: "ConsentGrantResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const grant_id = req.params.grant_id;
        const { granted_access, provisional, expires_at, extra_data } = req.body;

        const grant = await ConsentGrant.findOne({
            where: { id: grant_id, user_id, status: ConsentGrantStatus.PENDING },
        });

        if (!grant) {
            throw DiscordApiErrors.UNKNOWN_CONSENT_GRANT;
        }

        grant.status = ConsentGrantStatus.APPROVED;
        grant.responded_at = new Date();
        grant.granted_access = granted_access || grant.requested_access;
        grant.generateAccessToken();

        if (extra_data) {
            grant.extra_data = { ...grant.extra_data, ...extra_data };
        }

        await grant.save();

        const consent = UserConsent.create({
            user_id,
            service_id: grant.service_id || "gnap_grant",
            consent_type: grant.consent_type,
            item_id: grant.item_id,
            target_user_id: grant.requester_id,
            status: provisional ? ConsentStatus.PROVISIONAL : ConsentStatus.GRANTED,
            granted_at: new Date(),
            expires_at: expires_at ? new Date(expires_at) : grant.expires_at || undefined,
            extra_data: {
                grant_id: grant.id,
                granted_access: grant.granted_access,
            },
        });
        await consent.save();

        res.json(grant.toJSON());
    },
);

router.post(
    "/:grant_id/deny",
    route({
        summary: "Deny a consent grant request",
        description: "Denies a pending consent grant request. Only the target user (grantor) can deny.",
        responses: {
            200: { body: "ConsentGrantResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const grant_id = req.params.grant_id;

        const grant = await ConsentGrant.findOne({
            where: { id: grant_id, user_id, status: ConsentGrantStatus.PENDING },
        });

        if (!grant) {
            throw DiscordApiErrors.UNKNOWN_CONSENT_GRANT;
        }

        grant.status = ConsentGrantStatus.DENIED;
        grant.responded_at = new Date();
        await grant.save();

        res.json(grant.toJSON());
    },
);

router.post(
    "/:grant_id/continue",
    route({
        summary: "Continue grant negotiation (GNAP-like)",
        description: "Continues the grant negotiation process using the continuation token. Used for multi-step negotiation flows per GNAP (RFC 9635).",
        requestBody: "ConsentGrantContinueSchema",
        responses: {
            200: { body: "ConsentGrantResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const grant_id = req.params.grant_id;
        const { continue_token, updated_access, interaction_ref } = req.body;

        const grant = await ConsentGrant.findOne({
            where: [
                { id: grant_id, user_id },
                { id: grant_id, requester_id: user_id },
            ],
        });

        if (!grant) {
            throw DiscordApiErrors.UNKNOWN_CONSENT_GRANT;
        }

        if (grant.continue_token !== continue_token) {
            throw DiscordApiErrors.UNKNOWN_CONSENT_GRANT;
        }

        if (updated_access) {
            grant.requested_access = updated_access;
        }

        if (interaction_ref) {
            grant.extra_data = { ...grant.extra_data, interaction_ref };
        }

        grant.generateContinueToken();
        await grant.save();

        res.json(grant.toJSON());
    },
);

router.delete(
    "/:grant_id",
    route({
        summary: "Cancel/revoke a consent grant",
        description: "Cancels a pending grant request (if requester) or revokes an approved grant (if grantor). Per GDPR Article 7(3), revocation is as easy as granting.",
        responses: {
            204: { body: "null" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const grant_id = req.params.grant_id;

        const grant = await ConsentGrant.findOne({
            where: [
                { id: grant_id, user_id },
                { id: grant_id, requester_id: user_id },
            ],
        });

        if (!grant) {
            throw DiscordApiErrors.UNKNOWN_CONSENT_GRANT;
        }

        if (grant.user_id === user_id) {
            if (grant.status === ConsentGrantStatus.APPROVED) {
                const consent = await UserConsent.findOne({
                    where: {
                        user_id,
                        target_user_id: grant.requester_id,
                        consent_type: grant.consent_type,
                        item_id: grant.item_id,
                    },
                });
                if (consent) {
                    consent.status = ConsentStatus.RETRACTED;
                    consent.retracted_at = new Date();
                    await consent.save();
                }
            }
            grant.status = ConsentGrantStatus.DENIED;
        } else {
            grant.status = ConsentGrantStatus.EXPIRED;
        }

        grant.responded_at = new Date();
        await grant.save();

        res.status(204).send();
    },
);

export default router;
