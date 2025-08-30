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

import { emitEvent } from "../util/Event";
import { LobbyMemberDTO } from "../dtos";

declare global {
	function setInterval(callback: () => void, ms: number): NodeJS.Timeout;
	function clearInterval(id: NodeJS.Timeout): void;
	function clearTimeout(id: NodeJS.Timeout): void;
}

export interface Lobby {
	id: string;
	application_id: string;
	metadata?: Record<string, string> | null;
	members: LobbyMemberDTO[];
	linked_channel?: string;
	idle_timeout_seconds: number;
	created_at: Date;
	last_activity: Date;
	timeout_handle?: NodeJS.Timeout;
}

export class LobbyStore {
	public static lobbies: Map<string, Lobby> = new Map();
	private static cleanupInterval?: NodeJS.Timeout;

	public static init() {
		this.cleanupInterval = setInterval(() => {
			const now = new Date();
			this.lobbies.forEach((lobby, lobbyId) => {
				const idleTime = now.getTime() - lobby.last_activity.getTime();
				if (idleTime > lobby.idle_timeout_seconds * 1000) {
					this.deleteLobby(lobbyId);
				}
			});
		}, 60000);
	}

	public static createLobby(
		lobby: Omit<Lobby, "created_at" | "last_activity">,
	): Lobby {
		const now = new Date();
		const fullLobby: Lobby = {
			...lobby,
			created_at: now,
			last_activity: now,
		};
		this.lobbies.set(lobby.id, fullLobby);

		emitEvent({
			event: "LOBBY_CREATE",
			data: this.toLobbyResponse(fullLobby),
			guild_id: lobby.application_id,
		});

		return fullLobby;
	}

	public static getLobby(id: string): Lobby | undefined {
		return this.lobbies.get(id);
	}

	public static updateLobby(
		id: string,
		updates: Partial<
			Pick<
				Lobby,
				| "metadata"
				| "members"
				| "idle_timeout_seconds"
				| "linked_channel"
			>
		>,
	): Lobby | undefined {
		const lobby = this.lobbies.get(id);
		if (!lobby) return undefined;

		Object.assign(lobby, updates);
		lobby.last_activity = new Date();

		emitEvent({
			event: "LOBBY_UPDATE",
			data: this.toLobbyResponse(lobby),
			guild_id: lobby.application_id,
		});

		return lobby;
	}

	public static updateLobbyActivity(id: string) {
		const lobby = this.lobbies.get(id);
		if (lobby) {
			lobby.last_activity = new Date();
		}
	}

	public static addMember(lobbyId: string, member: LobbyMemberDTO): boolean {
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) return false;

		const existingIndex = lobby.members.findIndex(
			(m) => m.id === member.id,
		);
		if (existingIndex >= 0) {
			lobby.members[existingIndex] = member;
		} else {
			lobby.members.push(member);
		}

		lobby.last_activity = new Date();

		emitEvent({
			event: "LOBBY_MEMBER_ADD",
			data: {
				lobby_id: lobbyId,
				member: member,
			},
			user_id: member.id,
		});

		return true;
	}

	public static removeMember(lobbyId: string, userId: string): boolean {
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) return false;

		const memberIndex = lobby.members.findIndex((m) => m.id === userId);
		if (memberIndex === -1) return false;

		const removedMember = lobby.members[memberIndex];
		lobby.members.splice(memberIndex, 1);
		lobby.last_activity = new Date();

		emitEvent({
			event: "LOBBY_MEMBER_REMOVE",
			data: {
				lobby_id: lobbyId,
				member: removedMember,
			},
			user_id: userId,
		});

		if (lobby.members.length === 0) {
			this.deleteLobby(lobbyId);
		}

		return true;
	}

	public static deleteLobby(id: string): boolean {
		const lobby = this.lobbies.get(id);
		if (!lobby) return false;

		if (lobby.timeout_handle) {
			clearTimeout(lobby.timeout_handle);
		}

		emitEvent({
			event: "LOBBY_DELETE",
			data: { lobby_id: id },
			guild_id: lobby.application_id,
		});

		return this.lobbies.delete(id);
	}

	public static toLobbyResponse(lobby: Lobby) {
		return {
			id: lobby.id,
			application_id: lobby.application_id,
			metadata: lobby.metadata,
			members: lobby.members,
			linked_channel: lobby.linked_channel
				? { id: lobby.linked_channel }
				: undefined,
		};
	}

	public static shutdown() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.lobbies.clear();
	}
}
