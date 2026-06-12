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
import { getPermission, GuildMemberSubscription, GuildMemberSubscriptionStatus, GuildSubscriptionTier } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const guild_id = req.params.guild_id as string;

        const perms = await getPermission(req.user_id, guild_id);
        perms.hasThrow("VIEW_CREATOR_MONETIZATION_ANALYTICS");

        const tiers = await GuildSubscriptionTier.find({
            where: { guild_id },
            order: { position: "ASC" },
        });

        const activeSubscriptions = await GuildMemberSubscription.count({
            where: { guild_id, status: GuildMemberSubscriptionStatus.ACTIVE },
        });

        const endingSubscriptions = await GuildMemberSubscription.count({
            where: { guild_id, status: GuildMemberSubscriptionStatus.ENDING },
        });

        const totalSubscriptions = await GuildMemberSubscription.count({
            where: { guild_id },
        });

        const tierBreakdown = await Promise.all(
            tiers.map(async (tier) => {
                const count = await GuildMemberSubscription.count({
                    where: { guild_id, tier_id: tier.id, status: GuildMemberSubscriptionStatus.ACTIVE },
                });
                return {
                    tier_id: tier.id,
                    tier_name: tier.name,
                    price: tier.price,
                    active_subscribers: count,
                    monthly_revenue: count * tier.price.amount,
                };
            }),
        );

        res.json({
            guild_id,
            total_subscribers: activeSubscriptions,
            ending_subscribers: endingSubscriptions,
            total_all_time: totalSubscriptions,
            monthly_revenue: tierBreakdown.reduce((sum, t) => sum + t.monthly_revenue, 0),
            currency: tiers[0]?.price?.currency || "USD",
            tiers: tierBreakdown,
        });
    },
);

export default router;
