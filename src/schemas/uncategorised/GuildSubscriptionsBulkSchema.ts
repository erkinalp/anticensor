import { LazyRequestSchema } from "./LazyRequestSchema";

export type GuildSubscriptionSchema = Omit<LazyRequestSchema, "guild_id">;

export interface GuildSubscriptionsBulkSchema {
    subscriptions: { [key: string]: GuildSubscriptionSchema };
}
