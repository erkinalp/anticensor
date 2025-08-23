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
import { BanList, BanListCreatorType } from "@spacebar/util";
import { BanListCreateSchema } from "@spacebar/util";
import { HTTPError } from "lambert-server";

const router = Router();

router.get("/", route({}), async (req: Request, res: Response) => {
	const user_id = req.user_id;

	const banLists = await BanList.find({
		where: [
			{ is_public: true },
			{ creator_id: user_id, creator_type: BanListCreatorType.user },
		],
		order: { created_at: "DESC" },
	});

	res.json(banLists.map((list) => list.toPublicBanList()));
});

router.post(
	"/",
	route({ requestBody: "BanListCreateSchema" }),
	async (req: Request, res: Response) => {
		const user_id = req.user_id;
		const body = req.body as BanListCreateSchema;

		const banList = BanList.create({
			name: body.name,
			description: body.description,
			creator_id: user_id,
			creator_type: BanListCreatorType.user,
			is_public: body.is_public ?? false,
			created_at: new Date(),
			updated_at: new Date(),
		});

		await banList.save();

		res.status(201).json(banList.toPublicBanList());
	},
);

router.get("/:ban_list_id", route({}), async (req: Request, res: Response) => {
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

	res.json(banList.toPublicBanList());
});

router.put(
	"/:ban_list_id",
	route({ requestBody: "BanListCreateSchema" }),
	async (req: Request, res: Response) => {
		const { ban_list_id } = req.params;
		const user_id = req.user_id;
		const body = req.body as BanListCreateSchema;

		const banList = await BanList.findOne({
			where: { id: ban_list_id },
		});

		if (!banList) {
			throw new HTTPError("Ban list not found", 404);
		}

		if (banList.creator_id !== user_id) {
			throw new HTTPError("Access denied", 403);
		}

		banList.name = body.name;
		banList.description = body.description;
		banList.is_public = body.is_public ?? banList.is_public;
		banList.updated_at = new Date();

		await banList.save();

		res.json(banList.toPublicBanList());
	},
);

router.delete(
	"/:ban_list_id",
	route({}),
	async (req: Request, res: Response) => {
		const { ban_list_id } = req.params;
		const user_id = req.user_id;

		const banList = await BanList.findOne({
			where: { id: ban_list_id },
		});

		if (!banList) {
			throw new HTTPError("Ban list not found", 404);
		}

		if (banList.creator_id !== user_id) {
			throw new HTTPError("Access denied", 403);
		}

		await banList.remove();

		res.status(204).send();
	},
);

export default router;
