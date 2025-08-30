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
import { getGuildLimits } from "@spacebar/util";

const router = Router({ mergeParams: true });

router.get(
	"/",
	route({
		responses: { 200: { body: "Object" } },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };
		res.status(200).json({ followers: [] });
	},
);

router.post(
	"/",
	route({
		responses: { 200: { body: "Object" } },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };
		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const cap = getGuildLimits(guildId).followers.followersMaxPerChannel;
		res.status(200).json({ channel_id, webhook_id: "0" });
	},
);

router.delete(
	"/:webhook_id",
	route({
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, webhook_id } = req.params as {
			channel_id: string;
			webhook_id: string;
		};
		res.sendStatus(204);
	},
);
export default router;

/**
 *
 * @param {"webhook_channel_id":"754001514330062952"}
 *
 * Creates a WebHook in the channel and returns the id of it
 *
 * @returns {"channel_id": "816382962056560690", "webhook_id": "834910735095037962"}
 */
