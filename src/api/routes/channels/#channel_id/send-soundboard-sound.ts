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

import { emitEvent } from "@spacebar/util";
import { Channel, SoundboardSound, VoiceState } from "@spacebar/database";
import { route } from "@spacebar/api";
import { SendSoundSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        permission: "VIEW_CHANNEL",
        requestBody: "SendSoundSchema",
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };

        await VoiceState.findOneOrFail({ where: { user_id: req.user_id, channel_id } });

        const channel = await Channel.findOneOrFail({ where: { id: channel_id } });
        const body = req.body as SendSoundSchema;
        const sound = await SoundboardSound.findOneOrFail({
            where: {
                id: body.sound_id,
            },
            relations: {
                emoji: true,
            },
        });
        emitEvent({
            event: "VOICE_CHANNEL_EFFECT_SEND",
            channel_id,
            data: {
                channel_id,
                guild_id: channel.guild_id ?? "@me",
                user_id: req.user_id,
                //TODO huh?
                animation_type: 1,
                animation_id: Math.floor(Math.random() * 21),
                emoji: sound.emoji?.toJSON(),
                sound_id: sound.id,
                sound_volume: sound.volume,
            },
        });
        res.send(204);
    },
);

export default router;
