/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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
import { Application, getRights, SKU, Snowflake } from "@spacebar/util";
import { SKUCreateSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "ApplicationSkusResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;

        const skus = await SKU.find({
            where: { application_id },
        });

        res.json(skus);
    },
);

router.post(
    "/",
    route({
        requestBody: "SKUCreateSchema",
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;
        const body = req.body as SKUCreateSchema;

        const rights = await getRights(req.user_id);
        rights.hasThrow("CREDITABLE");

        await Application.findOneOrFail({ where: { id: application_id } });

        const slug = body.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

        const sku = SKU.create({
            id: Snowflake.generate(),
            application_id,
            name: body.name,
            type: body.type,
            slug,
            flags: body.flags ?? 0,
            summary: body.summary,
            description: body.description,
            access_type: body.access_type ?? 1,
            dependent_sku_id: body.dependent_sku_id,
            features: body.features,
            release_date: body.release_date,
            premium: body.premium ?? false,
            legal_notice: body.legal_notice,
            price: body.price,
            price_tier: body.price_tier,
            show_age_gate: body.show_age_gate ?? false,
        });

        await sku.save();

        res.json(sku);
    },
);

export default router;
