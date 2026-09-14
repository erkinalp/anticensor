/*
    This file is part of Harmony.

    Copyright (C) 2026 Harmony and Harmony Contributors

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

import { Config, ConnectedAccount, Connection } from "#harmony/util";
import { ConnectionCallbackSchema } from "#harmony/schemas";

export default class LichessConnection extends Connection {
    public readonly id = "lichess";
    public readonly authorizeUrl = "https://lichess.org/oauth";
    private challengeMap = new Map<string, string>();
    get clientID() {
        return Config.get().general.instanceName;
    }
    init(): void {
        this.settings = { enabled: true };
        this.icon_url = "https://simpleicons.org/icons/lichess.svg";
    }

    async getAuthorizationUrl(userId: string): Promise<string> {
        const state = this.createState(userId);
        const buf = Buffer.alloc(64);
        crypto.getRandomValues(buf);
        const challenge = buf.toString("hex");
        this.challengeMap.set(state, challenge);

        const url = new URL(this.authorizeUrl);

        url.searchParams.append("response_type", "code");
        url.searchParams.append("redirect_uri", this.getRedirectUri());
        url.searchParams.append("client_id", this.clientID);
        url.searchParams.append("state", state);
        const buf2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(challenge));
        url.searchParams.append("code_challenge_method", "S256");
        url.searchParams.append("code_challenge", Buffer.from(buf2).toString("base64url"));

        return url.toString();
    }

    getTokenUrl(): string {
        return ""; //this.tokenUrl;
    }

    async handleCallbackGet(params: Record<string, string>): Promise<ConnectedAccount | null> {
        const { state, code } = params;
        const code_verifier = this.challengeMap.get(state);

        const body = {
            client_id: this.clientID,
            code_verifier,
            code,
            grant_type: "authorization_code",
            redirect_uri: this.getRedirectUri(),
        };

        const j = (await (
            await fetch("https://lichess.org/api/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            })
        ).json()) as { access_token: string };

        const userId = this.getUserId(state);

        const user = (await (
            await fetch(`https://lichess.org/api/account`, {
                headers: {
                    Authorization: `Bearer ${j.access_token}`,
                },
            })
        ).json()) as {
            username: string;
            id: number;
            perfs: Record<string, { games: number; rating: number }>;
        };
        const games = Object.entries(user.perfs);
        const game = games.reduce((prev, cur) => (prev[1].games > cur[1].games ? prev : cur), games[0]);

        return await this.createConnection({
            user_id: userId,
            external_id: user.id + "",
            metadata_: game[1].games < 5 ? {} : { rating: game[1].rating, game: game[0] },
            friend_sync: false,
            name: user.username,
            type: this.id,
        });
    }

    async handleCallback(_: ConnectionCallbackSchema): Promise<ConnectedAccount | null> {
        throw new Error("This is not used by lichess, you should never see this message");
    }
}
