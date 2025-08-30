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

export const LobbyMemberSchema = {
	type: "object",
	properties: {
		id: { type: "string" },
		metadata: {
			type: "object",
			additionalProperties: { type: "string" },
			nullable: true,
		},
		flags: { type: "integer" },
	},
	required: ["id"],
	additionalProperties: false,
};

export const LobbyCreateSchema = {
	type: "object",
	properties: {
		metadata: {
			type: "object",
			additionalProperties: { type: "string" },
			nullable: true,
		},
		members: {
			type: "array",
			items: LobbyMemberSchema,
			maxItems: 25,
		},
		idle_timeout_seconds: {
			type: "integer",
			minimum: 5,
			maximum: 604800,
		},
	},
	required: ["idle_timeout_seconds"],
	additionalProperties: false,
};

export const LobbyUpdateSchema = {
	type: "object",
	properties: {
		metadata: {
			type: "object",
			additionalProperties: { type: "string" },
			nullable: true,
		},
		members: {
			type: "array",
			items: LobbyMemberSchema,
			maxItems: 25,
		},
		idle_timeout_seconds: {
			type: "integer",
			minimum: 5,
			maximum: 604800,
		},
	},
	additionalProperties: false,
};

export const LobbyMemberUpdateSchema = {
	type: "object",
	properties: {
		metadata: {
			type: "object",
			additionalProperties: { type: "string" },
			nullable: true,
		},
		flags: { type: "integer" },
	},
	additionalProperties: false,
};

export const LobbyChannelLinkSchema = {
	type: "object",
	properties: {
		channel_id: { type: "string" },
	},
	additionalProperties: false,
};
