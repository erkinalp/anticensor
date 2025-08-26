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
import {
	Channel,
	ChannelType,
	Guild,
	Permissions,
	emitEvent,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { ChannelPromoteSchema } from "@spacebar/util/schemas/ChannelPromoteSchema";

const router: Router = Router();

router.post(
	"/",
	route({
		requestBody: "ChannelPromoteSchema",
		permission: "MANAGE_CHANNELS",
		responses: {
			200: { body: "Channel" },
			400: { body: "APIErrorResponse" },
			403: {},
			404: {},
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params;
		const body = (req.body || {}) as ChannelPromoteSchema;

		const channel = await Channel.findOneOrFail({
			where: { id: channel_id },
		});

		if (!channel.guild_id) {
			throw new HTTPError("Only guild threads can be promoted", 400);
		}
		if (channel.parent_id == null) {
			throw new HTTPError("Channel is not a thread", 400);
		}

		let newType: ChannelType | null = null;
		switch (channel.type) {
			case ChannelType.GUILD_PUBLIC_THREAD:
				newType = ChannelType.GUILD_TEXT;
				break;
			case ChannelType.GUILD_NEWS_THREAD:
				newType = ChannelType.GUILD_NEWS;
				break;
			case ChannelType.ENCRYPTED_THREAD:
				newType = ChannelType.ENCRYPTED;
				break;
			case ChannelType.GUILD_PRIVATE_THREAD:
				throw new HTTPError("Private threads cannot be promoted", 400);
			default:
				throw new HTTPError(
					"Unsupported channel type for promotion",
					400,
				);
		}

		const oldParentId = channel.parent_id;
		const guildId = channel.guild_id;

		const guild = await Guild.findOneOrFail({
			where: { id: guildId },
			relations: ["roles"],
		});

		const threadOverwrites = channel.permission_overwrites ?? [];
		const computedOverwrites = [] as NonNullable<
			Channel["permission_overwrites"]
		>;

		for (const role of guild.roles) {
			const base = BigInt(role.permissions);
			const desired = Permissions.channelPermission(
				threadOverwrites.filter(
					(ow) => ow.type === 0 && ow.id === role.id,
				),
				base,
			);

			const allow = desired & ~base;
			const deny = base & ~desired;

			if (allow !== 0n || deny !== 0n) {
				computedOverwrites.push({
					id: role.id,
					type: 0,
					allow: String(allow),
					deny: String(deny),
				});
			}
		}

		for (const ow of threadOverwrites.filter((o) => o.type === 1)) {
			const allow = BigInt(ow.allow || "0");
			const deny = BigInt(ow.deny || "0");
			if (allow === 0n && deny === 0n) continue;
			computedOverwrites.push({
				id: ow.id,
				type: 1,
				allow: String(allow),
				deny: String(deny),
			});
		}

		channel.type = newType;
		channel.parent_id = null;
		channel.permission_overwrites = computedOverwrites;

		await channel.save();

		if (typeof body.position === "number") {
			await Guild.insertChannelInOrder(
				guildId,
				channel.id,
				body.position,
			);
		} else {
			await Guild.insertChannelInOrder(
				guildId,
				channel.id,
				oldParentId as string,
			);
		}

		channel.position = await Channel.calculatePosition(
			channel.id,
			guildId,
			channel.guild,
		);

		await emitEvent({
			event: "CHANNEL_UPDATE",
			data: channel,
			channel_id: channel.id,
			guild_id: guildId,
		});

		return res.json(channel);
	},
);

export default router;
