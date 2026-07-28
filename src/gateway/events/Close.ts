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

import { WebSocket } from "@harmony/gateway";
import { emitEvent, Member, PresenceUpdateEvent, Session, SessionsReplace, User, VoiceState, VoiceStateUpdateEvent } from "@harmony/util";
import { IsNull, Not } from "typeorm";

export async function Close(this: WebSocket, code: number, reason: Buffer) {
    console.log("[WebSocket] closed", code, reason.toString());
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    if (this.readyTimeout) clearTimeout(this.readyTimeout);
    this.deflate?.close();
    this.inflate?.close();
    this.removeAllListeners();

    if (this.session_id) {
        // await Session.delete({ session_id: this.session_id });

        const voiceState = await VoiceState.findOne({
            where: { user_id: this.user_id, session_id: this.session_id, channel_id: Not(IsNull()) },
        });

        // clear the voice state for this session if user was in voice channel
        if (voiceState) {
            const prevGuildId = voiceState.guild_id;
            const prevChannelId = voiceState.channel_id as string;

            voiceState.channel_id = null;
            voiceState.guild_id = null;
            voiceState.self_stream = false;
            voiceState.self_video = false;
            await voiceState.save();
            if (prevGuildId) {
                voiceState.member = await Member.findOneOrFail({
                    where: {
                        id: voiceState.user_id,
                        guild_id: prevGuildId,
                    },
                });
            }
            // let the users in previous guild/channel know that user disconnected
            await emitEvent({
                event: "VOICE_STATE_UPDATE",
                data: {
                    ...voiceState.toPublicVoiceState(),
                    guild_id: prevGuildId, // have to send the previous guild_id because that's what client expects for disconnect messages
                    member: voiceState.member.toPublicMember(),
                },
                guild_id: prevGuildId ?? "@me",
                channel_id: prevChannelId,
            } satisfies VoiceStateUpdateEvent);
        }
    }

    if (this.user_id) {
        const sessions = await Session.find({
            where: { user_id: this.user_id },
        });
        const acitveSession = sessions.find((_) => _.session_id === this.session_id);
        if (acitveSession) {
            acitveSession.status = "offline";
            await acitveSession.save();
        }
        await emitEvent({
            event: "SESSIONS_REPLACE",
            user_id: this.user_id,
            data: sessions.map((x) => x.toPrivateGatewayDeviceInfo()),
        } as SessionsReplace);

        const session = Session.findActiveSession(sessions);

        const user = await User.getPublicUser(this.user_id).catch(() => undefined);

        // Special case: dont emit a presence update for deleted users
        if (user !== undefined)
            await emitEvent({
                event: "PRESENCE_UPDATE",
                user_id: this.user_id,
                data: {
                    user: user,
                    activities: session?.activities ?? [],
                    client_status: session?.client_status ?? {},
                    status: session?.getPublicStatus?.() ?? session?.status ?? "offline",
                },
            } satisfies PresenceUpdateEvent);
    }
}
