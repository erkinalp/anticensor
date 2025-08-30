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
import {
	Message,
	ChannelFollower,
	Channel,
	MessageFlags,
	getGuildLimits,
	resolveLimit,
	emitEvent,
	Snowflake,
	DiscordApiErrors,
} from "@spacebar/util";

const router = Router();

router.post(
	"/",
	route({
		permission: "MANAGE_MESSAGES",
		responses: {
			200: {
				body: "Message",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id, message_id } = req.params as {
			channel_id: string;
			message_id: string;
		};

		const originalMessage = await Message.findOneOrFail({
			where: { id: message_id, channel_id },
			relations: ["author"],
		});

		if (
			originalMessage.flags &&
			originalMessage.flags & Number(MessageFlags.FLAGS.CROSSPOSTED)
		) {
			throw DiscordApiErrors.ALREADY_CROSSPOSTED;
		}

		const followers = await ChannelFollower.find({
			where: { source_channel_id: channel_id },
			relations: ["target_channel"],
			select: {
				target_channel_id: true,
				webhook_id: true,
				target_channel: { id: true, guild_id: true },
			},
		});

		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const limits = getGuildLimits(guildId).crosspost;
		const crosspostCap = resolveLimit(
			0,
			limits.crosspostMaxTargets,
			0,
			limits.crosspostMaxTargets,
		);

		if (crosspostCap !== null && followers.length > crosspostCap) {
			followers.splice(crosspostCap);
		}

		const uniqueTargets = new Map();
		for (const follower of followers) {
			const guildId = follower.target_channel.guild_id;
			if (!uniqueTargets.has(guildId)) {
				uniqueTargets.set(guildId, follower);
			}
		}

		const crosspostPromises = Array.from(uniqueTargets.values()).map(
			async (follower) => {
				const crosspostMessage = await Message.create({
					id: Snowflake.generate(),
					channel_id: follower.target_channel_id,
					guild_id: follower.target_channel.guild_id,
					author_id: originalMessage.author_id,
					content: originalMessage.content,
					type: originalMessage.type,
					flags:
						(originalMessage.flags || 0) |
						Number(MessageFlags.FLAGS.IS_CROSSPOST),
					embeds: originalMessage.embeds,
					attachments: originalMessage.attachments,
					timestamp: new Date(),
					message_reference: {
						message_id: originalMessage.id,
						channel_id: originalMessage.channel_id,
						guild_id: originalMessage.guild_id,
					},
				}).save();

				await emitEvent({
					event: "MESSAGE_CREATE",
					channel_id: follower.target_channel_id,
					guild_id: follower.target_channel.guild_id,
					data: crosspostMessage,
				});

				return crosspostMessage;
			},
		);

		await Promise.all(crosspostPromises);

		originalMessage.flags =
			(originalMessage.flags || 0) |
			Number(MessageFlags.FLAGS.CROSSPOSTED);
		await originalMessage.save();

		await emitEvent({
			event: "MESSAGE_UPDATE",
			channel_id,
			guild_id: originalMessage.guild_id,
			data: originalMessage,
		});

		res.json(originalMessage);
	},
);

export default router;
