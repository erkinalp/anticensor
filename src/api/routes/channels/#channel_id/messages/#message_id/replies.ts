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

import {
	Message,
	Channel,
	getPermission,
	emitEvent,
	MessageDeleteBulkEvent,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { In } from "typeorm";
import { route } from "../../../../../util";

const router = Router();

router.get(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: {
			200: { body: "APIMessageArray" },
			403: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { message_id, channel_id } = req.params;

		const permissions = await getPermission(
			req.user_id,
			undefined,
			channel_id,
		);
		permissions.hasThrow("READ_MESSAGE_HISTORY");

		const parentMessage = await Message.findOneOrFail({
			where: { id: message_id, channel_id },
		});

		if (!parentMessage.reply_ids) {
			const replies = await Message.find({
				where: {
					channel_id: channel_id,
					message_reference: {
						message_id: message_id,
					},
				},
				select: ["id"],
			});

			if (replies.length > 0) {
				parentMessage.reply_ids = replies.map((r) => r.id);
				await Message.update(
					{ id: message_id },
					{ reply_ids: parentMessage.reply_ids },
				);
			} else {
				parentMessage.reply_ids = [];
				await Message.update({ id: message_id }, { reply_ids: [] });
			}
		}

		const replyMessages = await Message.find({
			where: {
				id: In(parentMessage.reply_ids || []),
				channel_id: channel_id,
			},
			relations: [
				"author",
				"webhook",
				"application",
				"mentions",
				"mention_roles",
				"mention_channels",
				"sticker_items",
				"attachments",
			],
			order: { timestamp: "ASC" },
		});

		return res.json(
			replyMessages.map((m) => {
				const json = m.toJSON();
				json.reply_ids = m.reply_ids ?? undefined;
				return json;
			}),
		);
	},
);

router.delete(
	"/",
	route({
		permission: "MANAGE_MESSAGES",
		responses: {
			204: {},
			403: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { message_id, channel_id } = req.params;

		const channel = await Channel.findOneOrFail({
			where: { id: channel_id },
		});

		const permissions = await getPermission(
			req.user_id,
			channel.guild_id,
			channel_id,
		);
		permissions.hasThrow("MANAGE_MESSAGES");

		const parentMessage = await Message.findOneOrFail({
			where: { id: message_id, channel_id },
		});

		if (!parentMessage.reply_ids) {
			const replies = await Message.find({
				where: {
					channel_id: channel_id,
					message_reference: {
						message_id: message_id,
					},
				},
				select: ["id"],
			});

			if (replies.length > 0) {
				parentMessage.reply_ids = replies.map((r) => r.id);
				await Message.update(
					{ id: message_id },
					{ reply_ids: parentMessage.reply_ids },
				);
			} else {
				parentMessage.reply_ids = [];
				await Message.update({ id: message_id }, { reply_ids: [] });
			}
		}

		if (parentMessage.reply_ids?.length) {
			await Message.delete({ id: In(parentMessage.reply_ids) });

			await emitEvent({
				event: "MESSAGE_DELETE_BULK",
				channel_id,
				data: {
					ids: parentMessage.reply_ids,
					channel_id,
					guild_id: channel.guild_id,
				},
			} as MessageDeleteBulkEvent);

			parentMessage.reply_ids = [];
			await Message.update({ id: message_id }, { reply_ids: [] });
		}

		res.sendStatus(204);
	},
);

export default router;
