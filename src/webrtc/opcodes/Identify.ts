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

import { CLOSECODES } from "@harmony/gateway";
import { Config, StreamSession, VoiceState } from "@harmony/util";
import { validateSchema, VoiceIdentifySchema, WebRTCDeleteSessionSchema, WebRTCSessionFindSchema } from "@harmony/schemas";
import { generateSsrc, mediaServer, Send, VoiceOPCodes, VoicePayload, WebRtcWebSocket } from "@harmony/webrtc";
import { SSRCs } from "@spacebarchat/spacebar-webrtc-types";
import { subscribeToProducers } from "./Video";
import { getHeaders } from "../util/internalHeaders";

export async function onIdentify(this: WebRtcWebSocket, data: VoicePayload) {
    clearTimeout(this.readyTimeout);
    const config = Config.get();
    const headers = getHeaders();
    // noinspection JSUnusedLocalSymbols - TODO: use video?
    const { server_id, user_id, session_id, token, streams, video } = validateSchema("VoiceIdentifySchema", data.d) as VoiceIdentifySchema;

    // server_id can be one of the following: a unique id for a GO Live stream, a channel id for a DM voice call, or a guild id for a guild voice channel
    // not sure if there's a way to determine whether a snowflake is a channel id or a guild id without checking if it exists in db
    // luckily we will only have to determine this once
    const resp = (await (
        await fetch(config.api.endpointPrivate + "/api/internal/webrtc/session", {
            body: JSON.stringify({ server_id, user_id, token, session_id } satisfies WebRTCSessionFindSchema),
            method: "POST",
            headers: headers,
        })
    ).json()) as { type: "guild-voice" | "dm-voice" | "stream"; authenticated: boolean; stream_id?: string; channel_id?: string };
    const { type, authenticated, stream_id, channel_id } = resp;
    if (stream_id) {
        this.once("close", async () => {
            await fetch(config.api.endpointPrivate + "/api/internal/webrtc/session", {
                method: "DELETE",
                body: JSON.stringify({ stream_id } satisfies WebRTCDeleteSessionSchema),
                headers: headers,
            });
        });
    }

    // if it doesnt match any then not valid token
    if (!authenticated) return this.close(CLOSECODES.Authentication_failed);

    this.user_id = user_id;
    this.session_id = session_id;

    this.type = type;

    const voiceRoomId = type === "stream" ? server_id : channel_id!;

    this.webRtcClient = await mediaServer.join(voiceRoomId, this.user_id, this, type!);

    this.on("close", () => {
        // ice-lite media server relies on this to know when the peer went away
        mediaServer.onClientClose(this.webRtcClient!);
    });

    // once connected subscribe to tracks from other users
    this.webRtcClient.emitter.once("connected", async () => {
        await subscribeToProducers.call(this);
    });

    // the server generates a unique ssrc for the audio and video stream. Must be unique among users connected to same server
    // UDP clients will respect this ssrc, but webrtc clients will generate and replace it with their own
    const generatedSsrc: SSRCs = {
        audio_ssrc: generateSsrc(),
        video_ssrc: generateSsrc(),
        rtx_ssrc: generateSsrc(),
    };
    this.webRtcClient.initIncomingSSRCs(generatedSsrc);

    await Send(this, {
        op: VoiceOPCodes.READY,
        d: {
            ssrc: generatedSsrc.audio_ssrc,
            port: mediaServer.port,
            modes: [
                "aead_aes256_gcm_rtpsize",
                "aead_aes256_gcm",
                "aead_xchacha20_poly1305_rtpsize",
                "xsalsa20_poly1305_lite_rtpsize",
                "xsalsa20_poly1305_lite",
                "xsalsa20_poly1305_suffix",
                "xsalsa20_poly1305",
            ],
            ip: mediaServer.ip,
            experiments: [],
            streams: streams?.map((x) => ({
                ...x,
                ssrc: generatedSsrc.video_ssrc,
                rtx_ssrc: generatedSsrc.rtx_ssrc,
                type: "video", // client expects this to be overriden for some reason???
            })),
        },
    });
}
