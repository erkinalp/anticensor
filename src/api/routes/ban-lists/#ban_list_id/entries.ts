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
import { BanList, BanListEntry, User } from "@spacebar/util";
import { BanListEntrySchema } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { In } from "typeorm";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const { ban_list_id } = req.params;
	const user_id = req.user_id;

	const banList = await BanList.findOne({
		where: { id: ban_list_id },
	});

	if (!banList) {
		throw new HTTPError("Ban list not found", 404);
	}

	if (!banList.is_public && banList.creator_id !== user_id) {
		throw new HTTPError("Access denied", 403);
	}

	const entries = await BanListEntry.find({
		where: { ban_list_id },
		relations: ["banned_user"],
		order: { created_at: "DESC" },
	});

	res.json(entries.map((entry) => entry.toPublicBanListEntry()));
});

router.post(
	"/",
	route({ requestBody: "BanListEntrySchema" }),
	async (req: Request, res: Response) => {
		const { ban_list_id } = req.params;
		const user_id = req.user_id;
		const body = req.body as BanListEntrySchema;

		const banList = await BanList.findOne({
			where: { id: ban_list_id },
		});

		if (!banList) {
			throw new HTTPError("Ban list not found", 404);
		}

		if (banList.creator_id !== user_id) {
			throw new HTTPError("Access denied", 403);
		}

		const users = await User.find({
			where: body.user_ids.map((id) => ({ id })),
		});

		if (users.length !== body.user_ids.length) {
			throw new HTTPError("One or more users not found", 400);
		}

		const entries = [];
		for (const banned_user_id of body.user_ids) {
			const existingEntry = await BanListEntry.findOne({
				where: { ban_list_id, banned_user_id },
			});

			if (!existingEntry) {
				const entry = BanListEntry.create({
					ban_list_id,
					banned_user_id,
					reason: body.reason,
					created_at: new Date(),
				});

				await entry.save();
				entries.push(entry);
			}
		}

		banList.updated_at = new Date();
		await banList.save();

		res.status(201).json(
			entries.map((entry) => entry.toPublicBanListEntry()),
		);
	},
);

router.delete(
	"/",
	route({ requestBody: "BanListEntrySchema" }),
	async (req: Request, res: Response) => {
		const { ban_list_id } = req.params;
		const user_id = req.user_id;
		const body = req.body as BanListEntrySchema;

		const banList = await BanList.findOne({
			where: { id: ban_list_id },
		});

		if (!banList) {
			throw new HTTPError("Ban list not found", 404);
		}

		if (banList.creator_id !== user_id) {
			throw new HTTPError("Access denied", 403);
		}

		await BanListEntry.delete({
			ban_list_id,
			banned_user_id: In(body.user_ids),
		});

		banList.updated_at = new Date();
		await banList.save();

		res.status(204).send();
	},
);

export default router;
