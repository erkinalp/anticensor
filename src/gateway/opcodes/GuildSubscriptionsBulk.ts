import { WebSocket, Payload } from "#harmony/gateway";
import { onLazyRequest } from "./LazyRequest.js";
import { GuildSubscriptionsBulkSchema } from "#harmony/schemas";
import { check } from "./instanceOf.js";

export async function onGuildSubscriptionsBulk(this: WebSocket, payload: Payload) {
    const startTime = Date.now();
    check.call(this, GuildSubscriptionsBulkSchema, payload.d);
    const body = payload.d as GuildSubscriptionsBulkSchema;

    let guildId: keyof GuildSubscriptionsBulkSchema["subscriptions"];

    for (guildId in body.subscriptions) {
        await onLazyRequest.call(this, {
            ...payload,
            d: {
                guild_id: guildId,
                ...body.subscriptions[guildId],
            },
        });
    }
    console.log(
        `[Gateway/${this.user_id}] GuildSubscriptionsBulk processed ${Object.keys(body.subscriptions).length} subscriptions for user ${this.user_id} in ${Date.now() - startTime}ms`,
    );
}
