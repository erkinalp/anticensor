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

import { SendActivitySchema } from "../uncategorised/index.js";

export interface IdentifySchema {
    token: string;
    properties: {
        // bruh discord really uses $ in the property key, so we need to double prefix it, because instanceOf treats $ (prefix) as a optional key
        os?: string;
        os_arch?: string;
        app_arch?: string;
        browser?: string;
        device?: string;
        $os?: string;
        $browser?: string;
        $device?: string;
        browser_user_agent?: string;
        browser_version?: string;
        os_version?: string;
        referrer?: string;
        referring_domain?: string;
        referrer_current?: string;
        referring_domain_current?: string;
        release_channel?: string;
        client_build_number?: number;
        native_build_number?: number;
        client_event_source?: string;
        client_version?: string;
        system_locale?: string;
        has_client_mods?: boolean;
        client_launch_id?: string;
        launch_signature?: string;
        client_heartbeat_session_id?: string;
        client_app_state?: string;
        is_fast_connect?: boolean;
        gateway_connect_reasons?: string;
    };
    qos_token?: string;
    intents?: number; // this is a number, we can make it a bigint later
    presence?: SendActivitySchema;
    compress?: boolean;
    large_threshold?: number;
    largeThreshold?: number;
    /**
     * @minItems 2
     * @maxItems 2
     */
    shard?: number[]; // this is a number, we can make it a bigint later
    guild_subscriptions?: boolean;
    capabilities?: number;
    client_state?: {
        guild_hashes?: unknown;
        highest_last_message_id?: number;
        read_state_version?: number;
        user_guild_settings_version?: number;
        user_settings_version?: number;
        useruser_guild_settings_version?: number;
        private_channels_version?: number;
        guild_versions?: unknown;
        api_code_version?: number;
        initial_guild_id?: string;
    };
    clientState?: {
        guildHashes?: unknown;
        highestLastMessageId?: number;
        readStateVersion?: number;
        userGuildSettingsVersion?: number;
        useruserGuildSettingsVersion?: number;
        guildVersions?: unknown;
        apiCodeVersion?: number;
        initialGuildId?: string;
    };
    v?: number;
}
