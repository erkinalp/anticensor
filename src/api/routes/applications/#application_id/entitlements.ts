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
import { Entitlement, EntitlementType, SKU, Snowflake, emitEvent } from "@spacebar/util";
import { EntitlementCreateSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { FindOptionsWhere, LessThan, MoreThan } from "typeorm";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {
                body: "ApplicationEntitlementsResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;
        const { user_id, sku_ids, before, after, limit, guild_id, exclude_ended, exclude_deleted } = req.query;

        const where: FindOptionsWhere<Entitlement> = { application_id };

        if (user_id) where.user_id = user_id as string;
        if (guild_id) where.guild_id = guild_id as string;
        if (before) where.id = LessThan(before as string);
        if (after) where.id = MoreThan(after as string);
        if (exclude_ended === "true") where.ends_at = MoreThan(new Date());
        if (exclude_deleted !== "false") where.deleted = false;

        const entitlements = await Entitlement.find({
            where,
            take: Math.min(Number(limit) || 100, 100),
            order: { id: "DESC" },
        });

        if (sku_ids) {
            const skuIdList = (sku_ids as string).split(",");
            res.json(entitlements.filter((e) => skuIdList.includes(e.sku_id)));
        } else {
            res.json(entitlements);
        }
    },
);

router.post(
    "/",
    route({
        requestBody: "EntitlementCreateSchema",
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;
        const body = req.body as EntitlementCreateSchema;

        await SKU.findOneOrFail({ where: { id: body.sku_id, application_id } });

        const entitlement = Entitlement.create({
            id: Snowflake.generate(),
            sku_id: body.sku_id,
            application_id,
            user_id: body.owner_type === 2 ? body.owner_id : undefined,
            guild_id: body.owner_type === 1 ? body.owner_id : undefined,
            type: EntitlementType.TEST_MODE_PURCHASE,
            deleted: false,
            consumed: false,
        });

        await entitlement.save();

        await emitEvent({
            event: "ENTITLEMENT_CREATE",
            data: entitlement,
            user_id: entitlement.user_id,
            guild_id: entitlement.guild_id,
        });

        res.json(entitlement);
    },
);

router.get(
    "/:entitlement_id",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;
        const entitlement_id = req.params.entitlement_id as string;

        const entitlement = await Entitlement.findOneOrFail({
            where: { id: entitlement_id, application_id },
        });

        res.json(entitlement);
    },
);

router.post(
    "/:entitlement_id/consume",
    route({
        responses: {
            204: {},
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;
        const entitlement_id = req.params.entitlement_id as string;

        const entitlement = await Entitlement.findOneOrFail({
            where: { id: entitlement_id, application_id },
        });

        entitlement.consumed = true;
        await entitlement.save();

        await emitEvent({
            event: "ENTITLEMENT_UPDATE",
            data: entitlement,
            user_id: entitlement.user_id,
            guild_id: entitlement.guild_id,
        });

        res.sendStatus(204);
    },
);

router.delete(
    "/:entitlement_id",
    route({
        responses: {
            204: {},
        },
    }),
    async (req: Request, res: Response) => {
        const application_id = req.params.application_id as string;
        const entitlement_id = req.params.entitlement_id as string;

        const entitlement = await Entitlement.findOneOrFail({
            where: { id: entitlement_id, application_id, type: EntitlementType.TEST_MODE_PURCHASE },
        });

        entitlement.deleted = true;
        await entitlement.save();

        await emitEvent({
            event: "ENTITLEMENT_DELETE",
            data: entitlement,
            user_id: entitlement.user_id,
            guild_id: entitlement.guild_id,
        });

        res.sendStatus(204);
    },
);

export default router;
