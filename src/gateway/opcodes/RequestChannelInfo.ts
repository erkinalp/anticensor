/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors

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

import { WebSocket, Payload, OPCODES, Send } from "@harmony/gateway";
import { ChannelType } from "@harmony/schemas";
import { Channel, Member } from "@harmony/util";

export async function onRequestChannelInfo(this: WebSocket, { d }: Payload) {
    // Schema validation can only accept either string or array, so transforming it here to support both
    if (!d.guild_id) throw new Error('"guild_id" is required');
    if (!d.fields) throw new Error('"fields" is required');
    const guild_id = d.guild_id as unknown;
    const fields = d.fields as unknown;
    if (fields instanceof Array) {
        fields.forEach((_) => {
            if (typeof _ !== "string") throw new Error("bad schema");
        });
    } else throw new Error("bad schema");

    if (typeof guild_id !== "string") throw new Error("bad schema");

    if (!(await Member.exists({ where: { id: this.user_id, guild_id } }))) {
        throw new Error("not found");
    }

    const channels = (
        await Channel.find({
            where: { guild_id, type: ChannelType.GUILD_VOICE },
            relations: {
                voice_states: true,
            },
        })
    )
        .filter((c) => c.voice_states && c.voice_states.length > 0)
        .filter((c) => {
            return this.permissions[c.id]?.has("VIEW_CHANNEL");
        });

    await Send(this, {
        op: OPCODES.Dispatch,
        t: "CHANNEL_INFO", // This is an educated guess...
        d: {
            guild_id: guild_id,
            channels: channels.map((c) => ({
                id: c.id,
                status: fields.includes("status") ? null : undefined, // TODO: we dont track this
                voice_start_time: fields.includes("voice_start_time") ? new Date().toISOString() : undefined, // TODO: we dont track this
            })),
        },
    });
}
