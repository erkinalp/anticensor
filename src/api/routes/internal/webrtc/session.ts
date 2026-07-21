/*
	Harmony: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Harmony and Harmony Contributors

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

import { StreamSession, VoiceState } from "@harmony/util";
import { route } from "@harmony/api";
import { Request, Response, Router } from "express";
import { WebRTCDeleteSessionSchema, WebRTCSessionFindSchema } from "@harmony/schemas";

const router = Router({ mergeParams: true });

router.post(
    "/",
    route({
        requestBody: "WebRTCSessionFindSchema",
    }),
    async (req: Request, res: Response) => {
        console.log("test");
        let type: "guild-voice" | "dm-voice" | "stream" = "guild-voice";
        let authenticated = false;
        let stream_id: undefined | string = undefined;
        let channel_id: undefined | string = undefined;
        const { server_id, user_id, token, session_id } = req.body as WebRTCSessionFindSchema;

        // first check if its a guild voice connection or DM voice call
        const voiceState = await VoiceState.findOne({
            where: [
                { guild_id: server_id, user_id, token, session_id },
                { channel_id: server_id, user_id, token, session_id },
            ],
        });

        if (voiceState) {
            channel_id = voiceState.channel_id;
            type = voiceState.guild_id === server_id ? "guild-voice" : "dm-voice";
            authenticated = true;
        } else {
            // if its not a guild/dm voice connection, check if it is a go live stream
            const streamSession = await StreamSession.findOne({
                where: {
                    stream_id: server_id,
                    user_id,
                    token,
                    session_id,
                    used: false,
                },
                relations: { stream: true },
            });

            if (streamSession) {
                type = "stream";
                stream_id = streamSession.id;
                authenticated = true;
                streamSession.used = true;
                await streamSession.save();
            }
        }
        console.log(authenticated, type);
        res.json({ authenticated, type, stream_id, channel_id });
    },
);

router.delete(
    "/",
    route({
        requestBody: "WebRTCDeleteSessionSchema",
    }),
    async (req: Request, res: Response) => {
        const { stream_id } = req.body as WebRTCDeleteSessionSchema;
        await StreamSession.delete({ id: stream_id });
        res.send(204);
    },
);

export default router;
