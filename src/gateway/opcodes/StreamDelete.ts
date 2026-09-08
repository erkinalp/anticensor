import { parseStreamKey, Payload, WebSocket } from "#harmony/gateway";
import { emitEvent, Member, Stream, StreamDeleteEvent, VoiceState, VoiceStateUpdateEvent } from "#harmony/util";
import { ajv, StreamDeleteSchema } from "#harmony/schemas";

export async function onStreamDelete(this: WebSocket, data: Payload) {
    const startTime = Date.now();

    const s = ajv.getSchema("StreamDeleteSchema");
    if (!s?.(data.d)) throw new Error("bad schema " + JSON.stringify(s?.errors));

    const body = data.d as StreamDeleteSchema;

    let parsedKey: {
        type: "guild" | "call";
        channelId: string;
        guildId?: string;
        userId: string;
    };

    try {
        parsedKey = parseStreamKey(body.stream_key);
    } catch (e) {
        return this.close(4000, "Invalid stream key");
    }

    // noinspection JSUnusedLocalSymbols - TODO: what is type here?
    const { userId, channelId, guildId, type } = parsedKey;

    // when a user selects to stop watching another user stream, this event gets triggered
    // just disconnect user without actually deleting stream
    if (this.user_id !== userId) {
        await emitEvent({
            event: "STREAM_DELETE",
            data: {
                stream_key: body.stream_key,
            },
            user_id: this.user_id,
        } satisfies StreamDeleteEvent);
        return;
    }

    const stream = await Stream.findOne({
        where: { channel_id: channelId, owner_id: userId },
    });

    if (!stream) return;

    await stream.remove();

    const voiceState = await VoiceState.findOne({
        where: { user_id: this.user_id },
    });

    if (voiceState) {
        voiceState.self_stream = false;
        await voiceState.save();
        if (guildId !== "@me")
            voiceState.member = await Member.findOneOrFail({
                where: {
                    id: voiceState.user_id,
                    guild_id: guildId,
                },
            });

        await emitEvent({
            event: "VOICE_STATE_UPDATE",
            data: voiceState.toPublicVoiceState(),
            guild_id: guildId,
            channel_id: channelId,
        } satisfies VoiceStateUpdateEvent);
    }

    await emitEvent({
        event: "STREAM_DELETE",
        data: {
            stream_key: body.stream_key,
        },
        guild_id: guildId,
        channel_id: channelId,
    } satisfies StreamDeleteEvent);

    console.log(`[Gateway/${this.user_id}] STREAM_DELETE for user ${this.user_id} in channel ${channelId} with stream key ${body.stream_key} in ${Date.now() - startTime}ms`);
}
