export interface LazyRequestSchema {
    guild_id: string;
    channels?: {
        /**
         * @items.type integer
         * @minItems 2
         * @maxItems 2
         */
        [key: string]: number[][]; // puyo: changed from [number, number] because it breaks openapi
    };
    activities?: boolean;
    threads?: boolean;
    typing?: true;
    members?: string[];
    member_updates?: boolean;
    thread_member_lists?: [];
}
