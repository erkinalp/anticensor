import { unsafeMakeToken } from "../util/unsafeMakeToken.js";
unsafeMakeToken("InternalWebRTC" + Math.floor(Math.random() * 100000), "WEBRTC").then(console.log);
