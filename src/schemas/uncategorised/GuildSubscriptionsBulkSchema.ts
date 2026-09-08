import { LazyRequestSchema } from "./LazyRequestSchema.js";

export type GuildSubscriptionSchema = Omit<LazyRequestSchema, "guild_id">;

export interface GuildSubscriptionsBulkSchema {
    subscriptions: { [key: string]: GuildSubscriptionSchema };
}
