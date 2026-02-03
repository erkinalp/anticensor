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
import { UserConsent, ConsentType, ConsentStatus } from "@spacebar/util";
import { FindOptionsWhere } from "typeorm";

const router: Router = Router();

router.get(
    "/",
    route({
        summary: "List consents for the current user",
        description:
            "Returns all consents for the authenticated user. Supports filtering by consent_type, status, service_id, item_id, and target_user_id. For HB 805 pairwise consents (O(n²) per item), use item_id and target_user_id filters.",
        query: {
            consent_type: {
                type: "string",
                required: false,
                description: "Filter by consent type",
                values: Object.values(ConsentType),
            },
            status: {
                type: "string",
                required: false,
                description: "Filter by consent status",
                values: Object.values(ConsentStatus),
            },
            service_id: {
                type: "string",
                required: false,
                description: "Filter by service ID",
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
            200: { body: "UserConsentListResponse" },
        },
    }),
    async (req: Request, res: Response) => {
        const user_id = req.user_id!;
        const { consent_type, status, service_id, item_id, target_user_id } = req.query;

        const where: FindOptionsWhere<UserConsent> = { user_id };

        if (consent_type) {
            where.consent_type = consent_type as ConsentType;
        }
        if (status) {
            where.status = status as ConsentStatus;
        }
        if (service_id) {
            where.service_id = service_id as string;
        }
        if (item_id) {
            where.item_id = item_id as string;
        }
        if (target_user_id) {
            where.target_user_id = target_user_id as string;
        }

        const consents = await UserConsent.find({ where });

        res.json({
            consents: consents.map((c) => c.toJSON()),
        });
    },
);

export default router;
