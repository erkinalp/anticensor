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
import { Entitlement, EntitlementType, getRights, Message, SKU, Snowflake, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });

router.post(
    "/:message_id/unlock",
    route({
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const channel_id = req.params.channel_id as string;
        const message_id = req.params.message_id as string;

        const rights = await getRights(req.user_id);
        rights.hasThrow("DEBTABLE");

        const message = await Message.findOneOrFail({
            where: { id: message_id, channel_id },
        });

        if (!message.sku_id) {
            throw new HTTPError("This message is not gated by an SKU", 400);
        }

        const existingEntitlement = await Entitlement.findOne({
            where: { sku_id: message.sku_id, user_id: req.user_id, deleted: false },
        });

        if (existingEntitlement) {
            res.json({ already_unlocked: true, message });
            return;
        }

        const sku = await SKU.findOneOrFail({ where: { id: message.sku_id } });

        const entitlement = Entitlement.create({
            id: Snowflake.generate(),
            sku_id: sku.id,
            application_id: sku.application_id,
            user_id: req.user_id,
            type: EntitlementType.PURCHASE,
            deleted: false,
            consumed: false,
            starts_at: new Date(),
        });

        await entitlement.save();

        await emitEvent({
            event: "ENTITLEMENT_CREATE",
            data: entitlement,
            user_id: req.user_id,
        });

        res.json({ unlocked: true, entitlement_id: entitlement.id, message });
    },
);

router.get(
    "/:message_id/sku",
    route({
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const channel_id = req.params.channel_id as string;
        const message_id = req.params.message_id as string;

        const message = await Message.findOneOrFail({
            where: { id: message_id, channel_id },
        });

        if (!message.sku_id) {
            throw new HTTPError("This message is not gated by an SKU", 400);
        }

        const sku = await SKU.findOneOrFail({ where: { id: message.sku_id } });

        const hasAccess = await Entitlement.findOne({
            where: { sku_id: message.sku_id, user_id: req.user_id, deleted: false },
        });

        res.json({
            ...sku,
            unlocked: !!hasAccess,
        });
    },
);

export default router;
