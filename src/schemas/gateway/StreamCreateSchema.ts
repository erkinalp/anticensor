export interface StreamCreateSchema {
    type: "guild" | "call";
    channel_id: string;
    guild_id?: string;
    preferred_region?: string;
}
