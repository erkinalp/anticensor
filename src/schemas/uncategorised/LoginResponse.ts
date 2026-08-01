import { TokenResponse } from "../responses/index.js";

export interface MFAResponse {
    ticket: string;
    mfa: true;
    sms: false; // TODO
    token: null;
}

export interface WebAuthnResponse extends MFAResponse {
    webauthn: string;
}

export type LoginResponse = TokenResponse | MFAResponse | WebAuthnResponse;
