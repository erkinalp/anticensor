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

import { WebSocket, Payload } from "#harmony/gateway";
import { onHeartbeat } from "./Heartbeat.js";
import { onIdentify } from "./Identify.js";
import { onLazyRequest } from "./LazyRequest.js";
import { onPresenceUpdate } from "./PresenceUpdate.js";
import { onRequestGuildMembers } from "./RequestGuildMembers.js";
import { onResume } from "./Resume.js";
import { onVoiceStateUpdate } from "./VoiceStateUpdate.js";
import { onGuildSubscriptionsBulk } from "./GuildSubscriptionsBulk.js";
import { onStreamCreate } from "./StreamCreate.js";
import { onStreamDelete } from "./StreamDelete.js";
import { onStreamWatch } from "./StreamWatch.js";
import { onGuildSync } from "./GuildSync.js";
import { onRequestChannelStatuses } from "./RequestChannelStatuses.js";
import { onRequestChannelInfo } from "./RequestChannelInfo.js";

export type OPCodeHandler = (this: WebSocket, data: Payload) => unknown;

export default {
    1: onHeartbeat,
    2: onIdentify,
    3: onPresenceUpdate,
    4: onVoiceStateUpdate,
    // 5: Voice Server Ping
    6: onResume,
    // 7: Reconnect: You should attempt to reconnect and resume immediately.
    8: onRequestGuildMembers,
    // 9: Invalid Session
    // 10: Hello
    12: onGuildSync, // technically deprecated, bt should be less finnicky?
    // 13: Dm_update
    14: onLazyRequest,
    18: onStreamCreate,
    19: onStreamDelete,
    20: onStreamWatch,
    36: onRequestChannelStatuses,
    37: onGuildSubscriptionsBulk,
    40: onHeartbeat, // same as 1, except with extra data
    41: () => {}, // "Update Time Spent Session ID", just tracking nonsense
    43: onRequestChannelInfo, // extended op36...?
} as { [key: number]: OPCodeHandler };
