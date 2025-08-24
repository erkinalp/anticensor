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
	BanListEntry,
	User,
	Relationship,
	RelationshipType,
} from "@spacebar/util";
import { BanListSubscribeSchema } from "@spacebar/util";
import { HTTPError } from "lambert-server";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const user_id = req.user_id;

	const subscriptions = await BanListSubscription.find({
		where: {
			subscriber_id: user_id,
			subscriber_type: BanListSubscriberType.user,
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
		const user_id = req.user_id;
		const body = req.body as BanListSubscribeSchema;

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
			subscriber_id: user_id,
			subscriber_type: BanListSubscriberType.user,
		});

		const subscriptions = [];
		for (const ban_list_id of body.ban_list_ids) {
			const subscription = BanListSubscription.create({
				subscriber_id: user_id,
				subscriber_type: BanListSubscriberType.user,
				ban_list_id,
				created_at: new Date(),
			});
			await subscription.save();
			subscriptions.push(subscription);
		}

		await updateUserBlockedRelationships(user_id);

		res.json(subscriptions.map((sub) => sub.toPublicBanListSubscription()));
	},
);

async function updateUserBlockedRelationships(user_id: string) {
	const subscriptions = await BanListSubscription.find({
		where: {
			subscriber_id: user_id,
			subscriber_type: BanListSubscriberType.user,
		},
	});

	const banListIds = subscriptions.map((sub) => sub.ban_list_id);

	if (banListIds.length === 0) {
		await Relationship.delete({
			from_id: user_id,
			type: RelationshipType.blocked,
		});
		return;
	}

	const banListEntries = await BanListEntry.find({
		where: banListIds.map((id) => ({ ban_list_id: id })),
	});

	const bannedUserIds = [
		...new Set(banListEntries.map((entry) => entry.banned_user_id)),
	];

	await Relationship.delete({
		from_id: user_id,
		type: RelationshipType.blocked,
	});

	for (const banned_user_id of bannedUserIds) {
		if (banned_user_id !== user_id) {
			// Don't block yourself
			const existingRelationship = await Relationship.findOne({
				where: { from_id: user_id, to_id: banned_user_id },
			});

			if (!existingRelationship) {
				const relationship = Relationship.create({
					from_id: user_id,
					to_id: banned_user_id,
					type: RelationshipType.blocked,
				});
				await relationship.save();
			} else if (existingRelationship.type !== RelationshipType.blocked) {
				existingRelationship.type = RelationshipType.blocked;
				await existingRelationship.save();
			}
		}
	}
}

export default router;
