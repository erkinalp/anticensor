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
import { KillBillService, Subscription, SubscriptionStatus, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const userId = req.user_id;

        const subscriptions = await Subscription.find({
            where: { user_id: userId },
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
        const userId = req.user_id;
        const subscription_id = req.params.subscription_id as string;

        const subscription = await Subscription.findOneOrFail({
            where: { id: subscription_id, user_id: userId },
        });

        res.json(subscription);
    },
);

router.delete(
    "/:subscription_id",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const userId = req.user_id;
        const subscription_id = req.params.subscription_id as string;

        const subscription = await Subscription.findOneOrFail({
            where: { id: subscription_id, user_id: userId },
        });

        if (subscription.status === SubscriptionStatus.INACTIVE) {
            throw new HTTPError("Subscription is already inactive", 400);
        }

        subscription.status = SubscriptionStatus.ENDING;
        subscription.canceled_at = new Date();
        await subscription.save();

        if (KillBillService.isEnabled() && subscription.payment_gateway_subscription_id) {
            await KillBillService.cancelSubscription(subscription.payment_gateway_subscription_id);
        }

        await emitEvent({
            event: "SUBSCRIPTION_UPDATE",
            data: subscription,
            user_id: userId,
            guild_id: subscription.guild_id,
        });

        res.json(subscription);
    },
);

export default router;
