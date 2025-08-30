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
import { LobbyStore, DiscordApiErrors } from "@spacebar/util";

const router = Router();

router.put(
	"/",
	route({
		requestBody: "LobbyMemberUpdateSchema",
		responses: {
			200: {},
			400: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { lobby_id, user_id } = req.params;
		const body = req.body as {
			metadata?: Record<string, string>;
			flags?: number;
		};

		const lobby = LobbyStore.getLobby(lobby_id);
		if (!lobby) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		const member = {
			id: user_id,
			metadata: body.metadata,
			flags: body.flags,
		};

		const success = LobbyStore.addMember(lobby_id, member);
		if (!success) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		return res.json(member);
	},
);

router.delete(
	"/",
	route({
		responses: {
			204: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { lobby_id, user_id } = req.params;

		const lobby = LobbyStore.getLobby(lobby_id);
		if (!lobby) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		const success = LobbyStore.removeMember(lobby_id, user_id);
		if (!success) {
			throw new Error("Unknown member");
		}

		return res.status(204).send();
	},
);

export default router;
