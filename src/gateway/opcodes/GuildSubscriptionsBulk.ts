import { WebSocket, Payload } from "@spacebar/gateway";
import { onLazyRequest } from "./LazyRequest";
import { ajv, GuildSubscriptionsBulkSchema } from "@spacebar/schemas";

export async function onGuildSubscriptionsBulk(this: WebSocket, payload: Payload) {
    const startTime = Date.now();

    const s = ajv.getSchema("GuildSubscriptionsBulkSchema");
    if (!s?.(payload.d)) throw new Error("bad schema " + JSON.stringify(s?.errors));

    const body = payload.d as GuildSubscriptionsBulkSchema;

    await Promise.all(
        Object.entries(body.subscriptions).map(async ([guildId, sub]) => {
            await onLazyRequest.call(this, {
                ...payload,
                d: {
                    guild_id: guildId,
                    ...sub,
                },
            });
        }),
    );

    console.log(
        `[Gateway/${this.user_id}] GuildSubscriptionsBulk processed ${Object.keys(body.subscriptions).length} subscriptions for user ${this.user_id} in ${Date.now() - startTime}ms`,
    );
}
