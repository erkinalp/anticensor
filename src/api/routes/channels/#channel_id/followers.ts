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

import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import {
	ChannelFollower,
	Channel,
	Webhook,
	WebhookType,
	getGuildLimits,
	resolveLimit,
	getPermission,
	Snowflake,
	DiscordApiErrors,
} from "@spacebar/util";

const router = Router({ mergeParams: true });

router.get(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: { 200: { body: "Object" } },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };

		const followers = await ChannelFollower.find({
			where: { source_channel_id: channel_id },
			relations: ["target_channel", "webhook"],
			select: {
				target_channel_id: true,
				webhook_id: true,
				target_channel: { id: true, name: true, guild_id: true },
				webhook: { id: true, name: true },
			},
		});

		res.status(200).json({
			followers: followers.map((f) => ({
				channel_id: f.target_channel_id,
				webhook_id: f.webhook_id,
			})),
		});
	},
);

router.post(
	"/",
	route({
		permission: "MANAGE_WEBHOOKS",
		responses: { 200: { body: "Object" } },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };
		const { webhook_channel_id } = req.body as {
			webhook_channel_id: string;
		};

		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const limits = getGuildLimits(guildId).followers;
		const followerCap = resolveLimit(
			0,
			limits.followersMaxPerChannel,
			0,
			limits.followersMaxPerChannel,
		);

		if (followerCap !== null) {
			const currentFollowers = await ChannelFollower.count({
				where: { source_channel_id: channel_id },
			});
			if (currentFollowers >= followerCap) {
				throw DiscordApiErrors.MAXIMUM_NUMBER_OF_FOLLOWERS_REACHED;
			}
		}

		const existing = await ChannelFollower.findOne({
			where: {
				source_channel_id: channel_id,
				target_channel_id: webhook_channel_id,
			},
		});
		if (existing) {
			throw DiscordApiErrors.ALREADY_FOLLOWING_CHANNEL;
		}

		const webhook = await Webhook.create({
			id: Snowflake.generate(),
			type: WebhookType.ChannelFollower,
			name: `Crosspost Webhook`,
			channel_id: webhook_channel_id,
			guild_id: guildId,
			user_id: req.user_id,
		}).save();

		await ChannelFollower.create({
			source_channel_id: channel_id,
			target_channel_id: webhook_channel_id,
			webhook_id: webhook.id,
		}).save();

		res.status(200).json({
			channel_id: webhook_channel_id,
			webhook_id: webhook.id,
		});
	},
);

router.delete(
	"/:webhook_id",
	route({
		permission: "MANAGE_WEBHOOKS",
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, webhook_id } = req.params as {
			channel_id: string;
			webhook_id: string;
		};

		await ChannelFollower.delete({
			source_channel_id: channel_id,
			webhook_id,
		});
		await Webhook.delete({ id: webhook_id });

		res.sendStatus(204);
	},
);

export default router;
