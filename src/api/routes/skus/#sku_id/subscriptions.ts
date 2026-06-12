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
import { Subscription } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { ArrayContains, FindOptionsWhere, LessThan, MoreThan } from "typeorm";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const sku_id = req.params.sku_id as string;
        const { before, after, limit, user_id } = req.query;

        const where: FindOptionsWhere<Subscription> = {
            sku_ids: ArrayContains([sku_id]),
        };

        if (user_id) where.user_id = user_id as string;
        if (before) where.id = LessThan(before as string);
        if (after) where.id = MoreThan(after as string);

        const subscriptions = await Subscription.find({
            where,
            take: Math.min(Number(limit) || 50, 100),
            order: { id: "DESC" },
        });

        res.json(subscriptions);
    },
);

router.get(
    "/:subscription_id",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const sku_id = req.params.sku_id as string;
        const subscription_id = req.params.subscription_id as string;

        const subscription = await Subscription.findOneOrFail({
            where: {
                id: subscription_id,
                sku_ids: ArrayContains([sku_id]),
            },
        });

        res.json(subscription);
    },
);

export default router;
