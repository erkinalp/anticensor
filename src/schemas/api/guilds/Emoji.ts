import { Snowflake } from "../../Identifiers.js";
import { PartialUser } from "../users/index.js";

export type EmojisResponse = EmojiResponse[];

// why is almost everything optional?
export interface EmojiResponse {
    id: Snowflake | null;
    // null only when deleted
    name: string | null;
    roles?: Snowflake[];
    user?: PartialUser;
    require_colons?: boolean;
    managed?: boolean;
    animated?: boolean;
    available?: boolean;
}
