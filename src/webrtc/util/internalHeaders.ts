import { Config } from "@harmony/util";

export const getHeaders = () => {
    const config = Config.get();
    if (!config.webrtc.authtoken) throw new Error("Authentication not provided for WebRTC server, please provide token");
    return {
        "Content-Type": "application/json",
        authorization: config.webrtc.authtoken,
    };
};
