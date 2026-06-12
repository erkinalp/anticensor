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

import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import { emitEvent, getRights, getPermission, Guild, GuildMemberSubscription, GuildMemberSubscriptionStatus, GuildSubscriptionTier, Member, Role, Snowflake } from "@spacebar/util";
import { HTTPError } from "lambert-server";

const router = Router({ mergeParams: true });

router.get("/subscriptions", route({}), async (req: Request, res: Response) => {
    const guild_id = req.params.guild_id as string;

    await Member.IsInGuildOrFail(req.user_id, guild_id);

    const tiers = await GuildSubscriptionTier.find({
        where: { guild_id, published: true, archived: false },
        order: { position: "ASC" },
    });

    res.json(tiers);
});

router.get("/subscriptions/tiers", route({}), async (req: Request, res: Response) => {
    const guild_id = req.params.guild_id as string;

    const perms = await getPermission(req.user_id, guild_id);
    perms.hasThrow("MANAGE_GUILD");

    const tiers = await GuildSubscriptionTier.find({
        where: { guild_id },
        order: { position: "ASC" },
    });

    res.json(tiers);
});

router.post(
    "/subscriptions/tiers",
    route({
        permission: "MANAGE_GUILD",
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const guild_id = req.params.guild_id as string;
        const { name, description, image, price, role_ids, channel_ids } = req.body;

        const rights = await getRights(req.user_id);
        rights.hasThrow("CREDITABLE");

        const guild = await Guild.findOneOrFail({ where: { id: guild_id } });

        if (!guild.features.includes("CREATOR_MONETIZABLE_PROVISIONAL")) {
            guild.features.push("CREATOR_MONETIZABLE_PROVISIONAL");
            await guild.save();
        }

        const existingCount = await GuildSubscriptionTier.count({ where: { guild_id, archived: false } });
        if (existingCount >= 3) {
            throw new HTTPError("Maximum of 3 subscription tiers allowed", 400);
        }

        const tier = GuildSubscriptionTier.create({
            id: Snowflake.generate(),
            guild_id,
            name,
            description,
            image,
            position: existingCount,
            price: price || { amount: 0, currency: "USD" },
            role_ids: role_ids || [],
            channel_ids: channel_ids || [],
            published: true,
            archived: false,
        });

        await tier.save();

        res.json(tier);
    },
);

router.patch(
    "/subscriptions/tiers/:tier_id",
    route({
        permission: "MANAGE_GUILD",
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const guild_id = req.params.guild_id as string;
        const tier_id = req.params.tier_id as string;
        const { name, description, image, price, role_ids, channel_ids, published, position } = req.body;

        const tier = await GuildSubscriptionTier.findOneOrFail({
            where: { id: tier_id, guild_id },
        });

        if (name !== undefined) tier.name = name;
        if (description !== undefined) tier.description = description;
        if (image !== undefined) tier.image = image;
        if (price !== undefined) tier.price = price;
        if (role_ids !== undefined) tier.role_ids = role_ids;
        if (channel_ids !== undefined) tier.channel_ids = channel_ids;
        if (published !== undefined) tier.published = published;
        if (position !== undefined) tier.position = position;

        await tier.save();

        res.json(tier);
    },
);

router.delete(
    "/subscriptions/tiers/:tier_id",
    route({
        permission: "MANAGE_GUILD",
        responses: { 204: {} },
    }),
    async (req: Request, res: Response) => {
        const guild_id = req.params.guild_id as string;
        const tier_id = req.params.tier_id as string;

        const tier = await GuildSubscriptionTier.findOneOrFail({
            where: { id: tier_id, guild_id },
        });

        tier.archived = true;
        tier.published = false;
        await tier.save();

        res.sendStatus(204);
    },
);

router.post(
    "/subscriptions/tiers/:tier_id/subscribe",
    route({
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const guild_id = req.params.guild_id as string;
        const tier_id = req.params.tier_id as string;

        const rights = await getRights(req.user_id);
        rights.hasThrow("DEBTABLE");

        await Member.IsInGuildOrFail(req.user_id, guild_id);

        const tier = await GuildSubscriptionTier.findOneOrFail({
            where: { id: tier_id, guild_id, published: true, archived: false },
        });

        const existing = await GuildMemberSubscription.findOne({
            where: { guild_id, user_id: req.user_id, status: GuildMemberSubscriptionStatus.ACTIVE },
        });

        if (existing) {
            throw new HTTPError("Already subscribed to a tier in this guild", 400);
        }

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const subscription = GuildMemberSubscription.create({
            id: Snowflake.generate(),
            guild_id,
            user_id: req.user_id,
            tier_id,
            current_period_start: now,
            current_period_end: periodEnd,
            status: GuildMemberSubscriptionStatus.ACTIVE,
        });

        await subscription.save();

        // Grant premium roles from the tier
        const member = await Member.findOneOrFail({
            where: { guild_id, id: req.user_id },
            relations: { roles: true },
        });

        if (tier.role_ids.length > 0) {
            const existingRoleIds = member.roles.map((r) => r.id);
            const newRoleIds = tier.role_ids.filter((id) => !existingRoleIds.includes(id));

            if (newRoleIds.length > 0) {
                const rolesToAdd = await Role.find({
                    where: newRoleIds.map((id) => ({ id, guild_id })),
                });
                member.roles = [...member.roles, ...rolesToAdd];
                await member.save();

                await emitEvent({
                    event: "GUILD_MEMBER_UPDATE",
                    guild_id,
                    data: {
                        ...member,
                        guild_id,
                        roles: member.roles.map((r) => r.id),
                        user: member.user,
                    },
                });
            }
        }

        await emitEvent({
            event: "SUBSCRIPTION_CREATE",
            data: subscription,
            user_id: req.user_id,
            guild_id,
        });

        res.json(subscription);
    },
);

router.delete(
    "/subscriptions/tiers/:tier_id/subscribe",
    route({
        responses: { 200: {} },
    }),
    async (req: Request, res: Response) => {
        const guild_id = req.params.guild_id as string;
        const tier_id = req.params.tier_id as string;

        const subscription = await GuildMemberSubscription.findOneOrFail({
            where: { guild_id, user_id: req.user_id, tier_id, status: GuildMemberSubscriptionStatus.ACTIVE },
        });

        subscription.status = GuildMemberSubscriptionStatus.ENDING;
        await subscription.save();

        await emitEvent({
            event: "SUBSCRIPTION_UPDATE",
            data: subscription,
            user_id: req.user_id,
            guild_id,
        });

        res.json(subscription);
    },
);

router.get("/subscriptions/mine", route({}), async (req: Request, res: Response) => {
    const guild_id = req.params.guild_id as string;

    await Member.IsInGuildOrFail(req.user_id, guild_id);

    const subscriptions = await GuildMemberSubscription.find({
        where: { guild_id, user_id: req.user_id },
        relations: { tier: true },
    });

    res.json(subscriptions);
});

export default router;
