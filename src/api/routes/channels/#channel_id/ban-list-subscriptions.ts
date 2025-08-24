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
	BanList,
	BanListSubscription,
	BanListSubscriberType,
	Channel,
	ChannelType,
} from "@spacebar/util";
import { BanListSubscribeSchema } from "@spacebar/util";
import { HTTPError } from "lambert-server";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const { channel_id } = req.params;
	const user_id = req.user_id;

	const channel = await Channel.findOneOrFail({
		where: { id: channel_id },
		relations: ["recipients"],
	});

	if (
		channel.type === ChannelType.DM ||
		channel.type === ChannelType.GROUP_DM
	) {
		const isParticipant = channel.recipients?.some(
			(r) => r.user_id === user_id,
		);
		if (!isParticipant) {
			throw new HTTPError("Access denied", 403);
		}
	} else {
		throw new HTTPError(
			"Ban list subscriptions not supported for this channel type",
			400,
		);
	}

	const subscriptions = await BanListSubscription.find({
		where: {
			subscriber_id: channel_id,
			subscriber_type: BanListSubscriberType.channel,
		},
		relations: ["ban_list"],
		order: { created_at: "DESC" },
	});

	res.json(
		subscriptions.map((sub) => ({
			ban_list_id: sub.ban_list_id,
			ban_list: sub.ban_list?.toPublicBanList(),
			created_at: sub.created_at,
		})),
	);
});

router.put(
	"/",
	route({ requestBody: "BanListSubscribeSchema" }),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params;
		const user_id = req.user_id;
		const body = req.body as BanListSubscribeSchema;

		const channel = await Channel.findOneOrFail({
			where: { id: channel_id },
			relations: ["recipients"],
		});

		if (channel.type === ChannelType.DM) {
			const isParticipant = channel.recipients?.some(
				(r) => r.user_id === user_id,
			);
			if (!isParticipant) {
				throw new HTTPError("Access denied", 403);
			}
		} else if (channel.type === ChannelType.GROUP_DM) {
			if (channel.owner_id !== user_id) {
				throw new HTTPError(
					"Only the group owner can manage ban list subscriptions",
					403,
				);
			}
		} else {
			throw new HTTPError(
				"Ban list subscriptions not supported for this channel type",
				400,
			);
		}

		const banLists = await BanList.find({
			where: body.ban_list_ids.map((id) => ({ id })),
		});

		const accessibleBanLists = banLists.filter(
			(list) => list.is_public || list.creator_id === user_id,
		);

		if (accessibleBanLists.length !== body.ban_list_ids.length) {
			throw new HTTPError(
				"One or more ban lists not found or not accessible",
				400,
			);
		}

		await BanListSubscription.delete({
			subscriber_id: channel_id,
			subscriber_type: BanListSubscriberType.channel,
		});

		const subscriptions = [];
		for (const ban_list_id of body.ban_list_ids) {
			const subscription = BanListSubscription.create({
				subscriber_id: channel_id,
				subscriber_type: BanListSubscriberType.channel,
				ban_list_id,
				created_at: new Date(),
			});
			await subscription.save();
			subscriptions.push(subscription);
		}

		res.json(subscriptions.map((sub) => sub.toPublicBanListSubscription()));
	},
);

export default router;
