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
import {
	Channel,
	ChannelPinsUpdateEvent,
	Config,
	DiscordApiErrors,
	emitEvent,
	Message,
	MessageCreateEvent,
	MessageUpdateEvent,
	User,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { LessThan } from "typeorm";

const router: Router = Router();

router.get(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		query: {
			before: {
				type: "string",
				required: false,
				description: "Get messages pinned before this timestamp",
			},
			limit: {
				type: "number",
				required: false,
				description: "Max number of pins to return (1-50)",
			},
		},
		responses: {
			200: {
				body: "Object",
			},
			400: {
				body: "APIErrorResponse",
			},
			403: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params;
		const { before, limit = 50 } = req.query as {
			before?: string;
			limit?: number;
		};

		if (!req.permission?.has("READ_MESSAGE_HISTORY")) {
			return res.json({ items: [], has_more: false });
		}

		if (limit && (limit < 1 || limit > 50)) {
			throw new HTTPError("Limit must be between 1 and 50", 400);
		}

		const whereClause: any = {
			channel_id: channel_id,
			pinned: true,
		};

		if (before) {
			whereClause.timestamp = LessThan(new Date(before));
		}

		const pins = await Message.find({
			where: whereClause,
			relations: ["author"],
			order: { timestamp: "DESC" },
			take: (limit || 50) + 1,
		});

		const hasMore = pins.length > (limit || 50);
		if (hasMore) {
			pins.pop();
		}

		const items = pins.map((pin) => ({
			...pin,
			pinned_at: pin.timestamp?.toISOString(),
		}));

		res.json({
			items,
			has_more: hasMore,
		});
	},
);

router.put(
	"/:message_id",
	route({
		permission: "VIEW_CHANNEL",
		responses: {
			204: {},
			403: {},
			404: {},
			400: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id, message_id } = req.params;

		const message = await Message.findOne({
			where: { id: message_id, channel_id },
			relations: ["author"],
		});

		if (!message) {
			throw new HTTPError("Message not found", 404);
		}

		if (message.guild_id) {
			req.permission?.hasThrow("MANAGE_MESSAGES");
		}

		if (message.pinned) {
			return res.sendStatus(204);
		}

		const pinnedMessages = await Message.find({
			where: { channel_id: channel_id, pinned: true },
		});

		const { maxPins } = Config.get().limits.channel;
		if (pinnedMessages.length >= maxPins) {
			throw DiscordApiErrors.MAXIMUM_PINS.withParams(maxPins);
		}

		message.pinned = true;

		const channel = await Channel.findOne({
			where: { id: channel_id },
		});

		if (channel) {
			channel.last_pin_timestamp = new Date().getTime();
			await channel.save();
		}

		const author = await User.getPublicUser(req.user_id);

		const systemPinMessage = new Message();
		systemPinMessage.timestamp = new Date();
		systemPinMessage.type = 6;
		systemPinMessage.guild_id = message.guild_id;
		systemPinMessage.channel_id = message.channel_id;
		systemPinMessage.author = author;
		systemPinMessage.author_id = req.user_id;
		systemPinMessage.message_reference = {
			message_id: message.id,
			channel_id: message.channel_id,
			guild_id: message.guild_id,
		};
		systemPinMessage.reactions = [];
		systemPinMessage.attachments = [];
		systemPinMessage.embeds = [];
		systemPinMessage.sticker_items = [];
		systemPinMessage.mentions = [];
		systemPinMessage.mention_channels = [];
		systemPinMessage.mention_roles = [];
		systemPinMessage.mention_everyone = false;

		await Promise.all([
			message.save(),
			systemPinMessage.save(),
			emitEvent({
				event: "MESSAGE_UPDATE",
				channel_id,
				data: message,
			} as MessageUpdateEvent),
			emitEvent({
				event: "CHANNEL_PINS_UPDATE",
				channel_id,
				data: {
					channel_id,
					guild_id: message.guild_id,
					last_pin_timestamp: new Date().getTime(),
				},
			} as ChannelPinsUpdateEvent),
			emitEvent({
				event: "MESSAGE_CREATE",
				channel_id: message.channel_id,
				data: systemPinMessage,
			} as MessageCreateEvent),
		]);

		res.sendStatus(204);
	},
);

router.delete(
	"/:message_id",
	route({
		permission: "VIEW_CHANNEL",
		responses: {
			204: {},
			403: {},
			404: {},
			400: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id, message_id } = req.params;

		const message = await Message.findOne({
			where: { id: message_id, channel_id },
			relations: ["author"],
		});

		if (!message) {
			throw new HTTPError("Message not found", 404);
		}

		if (message.guild_id) {
			req.permission?.hasThrow("MANAGE_MESSAGES");
		}

		if (!message.pinned) {
			return res.sendStatus(204);
		}

		message.pinned = false;

		const channel = await Channel.findOne({
			where: { id: channel_id },
		});

		let lastPinTimestamp: Date | undefined;
		if (channel) {
			const remainingPins = await Message.find({
				where: { channel_id: channel_id, pinned: true },
				order: { timestamp: "DESC" },
				take: 1,
			});

			if (remainingPins.length > 0) {
				lastPinTimestamp = remainingPins[0].timestamp;
			}

			channel.last_pin_timestamp = lastPinTimestamp?.getTime();
			await channel.save();
		}

		await Promise.all([
			message.save(),
			emitEvent({
				event: "MESSAGE_UPDATE",
				channel_id,
				data: message,
			} as MessageUpdateEvent),
			emitEvent({
				event: "CHANNEL_PINS_UPDATE",
				channel_id,
				data: {
					channel_id,
					guild_id: message.guild_id,
					last_pin_timestamp: lastPinTimestamp?.getTime(),
				},
			} as ChannelPinsUpdateEvent),
		]);

		res.sendStatus(204);
	},
);

export default router;
