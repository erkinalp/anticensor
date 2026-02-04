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
import { UserConsent, ConsentType, ConsentStatus, DiscordApiErrors } from "@spacebar/util";

const router: Router = Router();

router.get(
    "/",
    route({
        summary: "Get consent details for a specific service",
        description:
            "Returns the consent record for a specific service for the authenticated user. For HB 805 pairwise consents, use item_id and target_user_id to identify specific consent records.",
        query: {
            consent_type: {
                type: "string",
                required: false,
                description: "Filter by consent type",
                values: Object.values(ConsentType),
            },
            item_id: {
                type: "string",
                required: false,
                description: "Filter by item ID (for per-item consents)",
            },
            target_user_id: {
                type: "string",
                required: false,
                description: "Filter by target user ID (for HB 805 pairwise consents)",
            },
        },
        responses: {
            200: { body: "UserConsentResponse" },
            404: { body: "APIErrorResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const service_id = req.params.service_id;
        const consent_type = (req.query.consent_type as ConsentType) || ConsentType.CUSTOM;
        const item_id = req.query.item_id as string | undefined;
        const target_user_id = req.query.target_user_id as string | undefined;

        const consent = await UserConsent.findOne({
            where: {
                user_id,
                service_id,
                consent_type,
                ...(item_id && { item_id }),
                ...(target_user_id && { target_user_id }),
            },
        });

        if (!consent) {
            throw DiscordApiErrors.UNKNOWN_CONSENT;
        }

        res.json(consent.toJSON());
    },
);

router.put(
    "/",
    route({
        summary: "Grant consent for a service",
        description:
            "Grants consent for a service. Supports GDPR-compliant consent with basis documents for off-platform consents. For HB 805 pairwise consents (O(n²) where n is number of persons), use target_user_id to specify who receives consent to view/share. Based on GNAP (RFC 9635) grant negotiation principles.",
        requestBody: "UserConsentGrantSchema",
        responses: {
            200: { body: "UserConsentResponse" },
            204: { body: "null" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const service_id = req.params.service_id;
        const { consent_type = ConsentType.CUSTOM, item_id, target_user_id, basis_document_url, basis_document_hash, expires_at, provisional, extra_data } = req.body;

        const existing = await UserConsent.findOne({
            where: {
                user_id,
                service_id,
                consent_type,
                ...(item_id && { item_id }),
                ...(target_user_id && { target_user_id }),
            },
        });

        if (existing) {
            existing.status = provisional ? ConsentStatus.PROVISIONAL : ConsentStatus.GRANTED;
            existing.granted_at = new Date();
            existing.retracted_at = undefined;
            existing.basis_document_url = basis_document_url;
            existing.basis_document_hash = basis_document_hash;
            existing.expires_at = expires_at ? new Date(expires_at) : undefined;
            existing.item_id = item_id;
            existing.target_user_id = target_user_id;
            existing.extra_data = extra_data;
            await existing.save();
            return res.json(existing.toJSON());
        }

        const consent = UserConsent.create({
            user_id,
            service_id,
            consent_type,
            item_id,
            target_user_id,
            status: provisional ? ConsentStatus.PROVISIONAL : ConsentStatus.GRANTED,
            basis_document_url,
            basis_document_hash,
            granted_at: new Date(),
            expires_at: expires_at ? new Date(expires_at) : undefined,
            extra_data,
        });
        await consent.save();
        return res.json(consent.toJSON());
    },
);

router.delete(
    "/",
    route({
        summary: "Revoke consent for a service (GDPR-compliant)",
        description:
            "Revokes consent for a service. Per GDPR Article 7(3), withdrawal of consent is as easy as giving consent. For HB 805 pairwise consents, specify item_id and target_user_id. The consent record is retained with RETRACTED status for audit purposes.",
        query: {
            consent_type: {
                type: "string",
                required: false,
                description: "Consent type to revoke",
                values: Object.values(ConsentType),
            },
            item_id: {
                type: "string",
                required: false,
                description: "Item ID for per-item consent revocation",
            },
            target_user_id: {
                type: "string",
                required: false,
                description: "Target user ID for HB 805 pairwise consent revocation",
            },
        },
        responses: { 204: { body: "null" } },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const service_id = req.params.service_id;
        const consent_type = (req.query.consent_type as ConsentType) || ConsentType.CUSTOM;
        const item_id = req.query.item_id as string | undefined;
        const target_user_id = req.query.target_user_id as string | undefined;

        const existing = await UserConsent.findOne({
            where: {
                user_id,
                service_id,
                consent_type,
                ...(item_id && { item_id }),
                ...(target_user_id && { target_user_id }),
            },
        });

        if (existing) {
            existing.status = ConsentStatus.RETRACTED;
            existing.retracted_at = new Date();
            await existing.save();
        }

        return res.status(204).send();
    },
);

export default router;
