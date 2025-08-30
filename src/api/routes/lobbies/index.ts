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
	LobbyStore,
	DiscordApiErrors,
	Snowflake,
	LobbyMember,
} from "@spacebar/util";

const router = Router();

function validateMetadata(metadata?: Record<string, string> | null): void {
	if (!metadata) return;

	const totalLength = Object.entries(metadata).reduce((sum, [key, value]) => {
		return sum + key.length + value.length;
	}, 0);

	if (totalLength > 1000) {
		throw new Error("Metadata total length cannot exceed 1000 characters");
	}
}

function validateIdleTimeout(seconds?: number): void {
	if (seconds !== undefined && (seconds < 5 || seconds > 604800)) {
		throw new Error("Idle timeout must be between 5 and 604800 seconds");
	}
}

router.post(
	"/",
	route({
		requestBody: "LobbyCreateSchema",
		responses: {
			200: {},
			400: {},
			401: {},
		},
	}),
	async (req: Request, res: Response) => {
		const body = req.body as {
			metadata?: Record<string, string>;
			members?: LobbyMember[];
			idle_timeout_seconds?: number;
		};

		validateMetadata(body.metadata);
		validateIdleTimeout(body.idle_timeout_seconds);

		if (body.members && body.members.length > 25) {
			throw new Error("Cannot create lobby with more than 25 members");
		}

		const lobbyId = Snowflake.generate();
		const lobby = LobbyStore.createLobby({
			id: lobbyId,
			application_id: req.user_id,
			metadata: body.metadata,
			members: body.members || [],
			idle_timeout_seconds: body.idle_timeout_seconds || 300,
		});

		return res.json(LobbyStore.toLobbyResponse(lobby));
	},
);

export default router;
