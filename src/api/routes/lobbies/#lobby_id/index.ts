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
	Channel,
	Member,
	Lobby,
	LobbyMemberDTO,
	LobbyDTO,
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

router.get(
	"/",
	route({
		responses: {
			200: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { lobby_id } = req.params;

		const lobby = LobbyStore.getLobby(lobby_id);
		if (!lobby) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		LobbyStore.updateLobbyActivity(lobby_id);
		const lobbyResponse: LobbyDTO = LobbyStore.toLobbyResponse(lobby);
		return res.json(lobbyResponse);
	},
);

router.patch(
	"/",
	route({
		requestBody: "LobbyUpdateSchema",
		responses: {
			200: {},
			400: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { lobby_id } = req.params;
		const body = req.body as {
			metadata?: Record<string, string>;
			members?: LobbyMemberDTO[];
			idle_timeout_seconds?: number;
		};

		const lobby = LobbyStore.getLobby(lobby_id);
		if (!lobby) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		validateMetadata(body.metadata);
		validateIdleTimeout(body.idle_timeout_seconds);

		if (body.members && body.members.length > 25) {
			throw new Error("Cannot update lobby with more than 25 members");
		}

		const updates: Partial<Omit<Lobby, "id" | "created_at">> = {};
		if (body.metadata !== undefined) updates.metadata = body.metadata;
		if (body.members !== undefined) updates.members = body.members;
		if (body.idle_timeout_seconds !== undefined)
			updates.idle_timeout_seconds = body.idle_timeout_seconds;

		const updatedLobby = LobbyStore.updateLobby(lobby_id, updates);
		const lobbyResponse: LobbyDTO = LobbyStore.toLobbyResponse(
			updatedLobby!,
		);
		return res.json(lobbyResponse);
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
		const { lobby_id } = req.params;

		const deleted = LobbyStore.deleteLobby(lobby_id);
		if (!deleted) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		return res.status(204).send();
	},
);

router.patch(
	"/channel-linking",
	route({
		requestBody: "LobbyChannelLinkSchema",
		responses: {
			200: {},
			400: {},
			403: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { lobby_id } = req.params;
		const body = req.body as { channel_id?: string };

		const lobby = LobbyStore.getLobby(lobby_id);
		if (!lobby) {
			throw DiscordApiErrors.UNKNOWN_LOBBY;
		}

		const member = lobby.members.find((m) => m.id === req.user_id);
		if (!member) {
			throw new Error("Unknown member");
		}

		if (!(member.flags && member.flags & 1)) {
			throw new Error("Missing permissions");
		}

		if (body.channel_id) {
			try {
				const channel = await Channel.findOneOrFail({
					where: { id: body.channel_id },
				});

				if (channel.guild_id) {
					const memberInGuild = await Member.findOne({
						where: { id: req.user_id, guild_id: channel.guild_id },
					});
					if (!memberInGuild) {
						throw new Error("Missing permissions");
					}
				}
			} catch (error) {
				throw new Error("Unknown channel");
			}
		}

		const updatedLobby = LobbyStore.updateLobby(lobby_id, {
			linked_channel: body.channel_id || undefined,
		});

		const lobbyResponse: LobbyDTO = LobbyStore.toLobbyResponse(
			updatedLobby!,
		);
		return res.json(lobbyResponse);
	},
);

export default router;
