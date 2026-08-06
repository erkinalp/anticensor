import { WebSocket } from "@harmony/gateway";
import type { WebRtcClient } from "harmony-webrtc-types";

export interface WebRtcWebSocket extends WebSocket {
    type: "guild-voice" | "dm-voice" | "stream";
    webRtcClient?: WebRtcClient<WebRtcWebSocket>;
}
