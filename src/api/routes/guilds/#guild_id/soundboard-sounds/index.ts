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

import { checkUsername, emitEvent, handleFile, Permissions, SoundboardSound } from "#harmony/util";
import { route } from "#harmony/api";
import { Request, Response, Router } from "express";
import { CreateSoundboardSoundSchema } from "#harmony/schemas";
import { HTTPError } from "#lambert-server";

const router: Router = Router({ mergeParams: true });

/* TODO: Deleting the secrets is just a temporary go-around. Views should be implemented for both safety and better handling. */

router.get(
    "/",
    route({
        permission: [],
        responses: {
            200: {
                body: "GuildBansResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };
        const perms = req.permission?.has(Permissions.FLAGS.CREATE_GUILD_EXPRESSIONS) || req.permission?.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS);

        const sounds = await SoundboardSound.find({
            where: { guild_id },
            relations: {
                user: !!perms,
            },
        });

        return res.json(sounds.map((_) => _.toJSON(perms)));
    },
);
//https://cdn.discordapp.com/soundboard-sounds/2
router.post(
    "/",
    route({
        permission: "CREATE_GUILD_EXPRESSIONS",
        responses: {
            200: {
                body: "GuildBansResponse",
            },
            403: {
                body: "APIErrorResponse",
            },
        },
        requestBody: "CreateSoundboardSoundSchema",
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };
        const body = req.body as CreateSoundboardSoundSchema;
        body.volume ??= 1;
        if (body.volume < 0 || body.volume > 1) throw new HTTPError(req.i18n.field.VOLUME_OUT_OF_RANGE());
        checkUsername(body.name, req.i18n);
        const sound = SoundboardSound.create({
            name: body.name,
            volume: body.volume,
            emoji_id: body.emoji_id ?? undefined,
            emoji_name: body.emoji_name ?? undefined,
            guild_id,
            user: req.user,
        });
        await handleFile(`/soundboard-sounds/${sound.id}`, body.sound);
        await sound.save();
        emitEvent({
            event: "GUILD_SOUNDBOARD_SOUND_CREATE",
            guild_id,
            data: sound.toJSON(true),
        });
        res.json(sound.toJSON(true));
    },
);

export default router;
