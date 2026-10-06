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

import { emitEvent, Permissions } from "@spacebar/util";
import { SoundboardSound } from "@spacebar/database";
import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { UpdateSoundboardSoundSchema } from "@spacebar/schemas";
import { HTTPError } from "lambert-server/HTTPError";

const router: Router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        permission: [],
    }),
    async (req: Request, res: Response) => {
        const { guild_id, sound_id } = req.params as { [key: string]: string };
        const perms = req.permission?.has(Permissions.FLAGS.CREATE_GUILD_EXPRESSIONS) || req.permission?.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS);

        const sound = await SoundboardSound.findOneOrFail({
            where: { guild_id, id: sound_id },
            relations: {
                user: !!perms,
            },
        });

        return sound.toJSON(perms);
    },
);

router.patch(
    "/",
    route({
        permission: [],

        requestBody: "UpdateSoundboardSoundSchema",
    }),
    async (req: Request, res: Response) => {
        const { guild_id, sound_id } = req.params as { [key: string]: string };
        const body = req.body as UpdateSoundboardSoundSchema;
        const perms = req.permission!;

        const sound = await SoundboardSound.findOneOrFail({
            where: { guild_id, id: sound_id },
            relations: {
                user: true,
            },
        });

        const allowed = perms.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS) || (sound.user_id === req.user_id && perms.has(Permissions.FLAGS.CREATE_GUILD_EXPRESSIONS));
        if (!allowed) throw new HTTPError(req.t("common:missing_permissions.SOUNDBOARD"));
        Object.assign(sound, body);
        await sound.save();
        emitEvent({
            event: "GUILD_SOUNDBOARD_SOUND_UPDATE",
            guild_id,
            data: sound.toJSON(true),
        });
        res.json(sound.toJSON(true));
    },
);

router.delete(
    "/",
    route({
        permission: [],
    }),
    async (req: Request, res: Response) => {
        const { guild_id, sound_id } = req.params as { [key: string]: string };
        const perms = req.permission!;

        const sound = await SoundboardSound.findOneOrFail({
            where: { guild_id, id: sound_id },
        });

        const allowed = perms.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS) || (sound.user_id === req.user_id && perms.has(Permissions.FLAGS.CREATE_GUILD_EXPRESSIONS));
        if (!allowed) throw new HTTPError(req.t("common:missing_permissions.SOUNDBOARD"));
        await sound.remove();
        emitEvent({
            event: "GUILD_SOUNDBOARD_SOUND_DELETE",
            guild_id,
            data: { sound_id, guild_id },
        });
        res.send(204);
    },
);

export default router;
