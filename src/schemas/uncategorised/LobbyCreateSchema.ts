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

export interface LobbyMemberSchema {
	id: string;
	metadata?: Record<string, string> | null;
	flags?: number;
}

export interface LobbyCreateSchema {
	metadata?: Record<string, string> | null;
	/**
	 * @maxItems 25
	 */
	members?: LobbyMemberSchema[];
	/**
	 * @minimum 5
	 * @maximum 604800
	 */
	idle_timeout_seconds: number;
}

export interface LobbyUpdateSchema {
	metadata?: Record<string, string> | null;
	/**
	 * @maxItems 25
	 */
	members?: LobbyMemberSchema[];
	/**
	 * @minimum 5
	 * @maximum 604800
	 */
	idle_timeout_seconds?: number;
}

export interface LobbyMemberUpdateSchema {
	metadata?: Record<string, string> | null;
	flags?: number;
}

export interface LobbyChannelLinkSchema {
	channel_id?: string;
}
