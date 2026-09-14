/*
	Harmony: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Harmony and Harmony Contributors

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

import { emitEvent, Permissions, SoundboardSound } from "#harmony/util";
import { WebSocket, Payload } from "#harmony/gateway";
import { ajv, RequestSoundboardSoundsSchema } from "#harmony/schemas";
import { In } from "typeorm";

export async function onRequestSoundboardSounds(this: WebSocket, { d }: Payload) {
    const s = ajv.getSchema("RequestSoundboardSoundsSchema");
    if (!s?.(d)) throw new Error("bad schema " + JSON.stringify(s?.errors));

    const body = d as RequestSoundboardSoundsSchema;

    const sounds = await SoundboardSound.find({
        where: {
            guild_id: In(body.guild_ids),
        },
        relations: {
            user: true,
        },
    });
    const guilds = Object.groupBy(sounds, (s) => s.guild_id as string);
    await Promise.all(
        body.guild_ids.map(async (guild_id) => {
            const p = this.permissions[guild_id];
            const perms = p?.has(Permissions.FLAGS.CREATE_GUILD_EXPRESSIONS) || p?.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS);
            await emitEvent({
                event: "SOUNDBOARD_SOUNDS",
                user_id: this.user_id,
                data: {
                    guild_id,
                    soundboard_sounds: guilds[guild_id]?.map((_) => _.toJSON(perms)) || [],
                },
            });
        }),
    );
}
