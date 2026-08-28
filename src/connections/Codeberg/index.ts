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

import { Config, ConnectedAccount, Connection, ConnectionLoader } from "@harmony/util";
import { CodebergSettings } from "./CodebergSettings";
import { ConnectionCallbackSchema } from "@harmony/schemas";

export default class CodebergConnection extends Connection {
    public readonly id = "codeberg";
    public readonly authorizeUrl = "https://codeberg.org/login/oauth/authorize";
    settings: CodebergSettings = new CodebergSettings();
    init(): void {
        this.icon_url = "https://simpleicons.org/icons/codeberg.svg";
        this.settings = ConnectionLoader.getConnectionConfig<CodebergSettings>(this.id, this.settings);

        if (this.settings.enabled && !this.settings.clientSecret) throw new Error(`Invalid settings for connection ${this.id}`);
    }

    getAuthorizationUrl(userId: string): string {
        const state = this.createState(userId);

        const url = new URL(this.authorizeUrl);

        url.searchParams.append("response_type", "code");
        url.searchParams.append("redirect_uri", this.getRedirectUri());
        url.searchParams.append("client_id", this.settings.clientID ?? "");
        url.searchParams.append("state", state);

        return url.toString();
    }

    getTokenUrl(): string {
        return ""; //this.tokenUrl;
    }

    async handleCallbackGet(params: Record<string, string>): Promise<ConnectedAccount | null> {
        const { state, code } = params;

        const body = {
            client_id: this.settings.clientID,
            client_secret: this.settings.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: this.getRedirectUri(),
        };

        const j = (await (
            await fetch("https://codeberg.org/login/oauth/access_token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            })
        ).json()) as { access_token: string };

        const userId = this.getUserId(state);

        const user = (await (await fetch(`https://codeberg.org/api/v1/user?token=${j.access_token}`)).json()) as { login: string; created: string; id: number };

        return await this.createConnection({
            user_id: userId,
            external_id: user.id + "",
            metadata_: {
                created_at: new Date(user.created).toISOString().replace("Z", "+00:00"),
            },
            friend_sync: false,
            name: user.login,
            type: this.id,
        });
    }

    async handleCallback(_: ConnectionCallbackSchema): Promise<ConnectedAccount | null> {
        throw new Error("This is not used by codeberg, you should never see this message");
    }
}
