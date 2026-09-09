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

import { ConnectedAccount, Connection, ConnectionLoader, DiscordApiErrors } from "#harmony/util";
import { YoutubeSettings } from "./YoutubeSettings.js";
import { ConnectedAccountCommonOAuthTokenResponse, ConnectionCallbackSchema } from "#harmony/schemas";

interface YouTubeConnectionChannelListResult {
    items: {
        snippet: {
            // thumbnails: Thumbnails;
            title: string;
            country: string;
            publishedAt: string;
            // localized: Localized;
            description: string;
        };
        kind: string;
        etag: string;
        id: string;
    }[];
    kind: string;
    etag: string;
    pageInfo: {
        resultsPerPage: number;
        totalResults: number;
    };
}

export default class YoutubeConnection extends Connection {
    public readonly id = "youtube";
    public readonly authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    public readonly tokenUrl = "https://oauth2.googleapis.com/token";
    public readonly userInfoUrl = "https://www.googleapis.com/youtube/v3/channels?mine=true&part=snippet";
    public readonly scopes = ["https://www.googleapis.com/auth/youtube.readonly"];
    settings: YoutubeSettings = new YoutubeSettings();

    init(): void {
        this.icon_url = "https://simpleicons.org/icons/youtube.svg";
        this.settings = ConnectionLoader.getConnectionConfig<YoutubeSettings>(this.id, this.settings);

        if (this.settings.enabled && (!this.settings.clientId || !this.settings.clientSecret)) throw new Error(`Invalid settings for connection ${this.id}`);
    }

    getAuthorizationUrl(userId: string): string {
        const state = this.createState(userId);
        const url = new URL(this.authorizeUrl);

        url.searchParams.append("client_id", this.settings.clientId as string);
        url.searchParams.append("redirect_uri", this.getRedirectUri());
        url.searchParams.append("response_type", "code");
        url.searchParams.append("scope", this.scopes.join(" "));
        url.searchParams.append("state", state);
        return url.toString();
    }

    getTokenUrl(): string {
        return this.tokenUrl;
    }

    async exchangeCode(state: string, code: string): Promise<ConnectedAccountCommonOAuthTokenResponse> {
        this.validateState(state);

        const url = new URL(this.getTokenUrl());
        url.searchParams.append("grant_type", "authorization_code");
        url.searchParams.append("code", code);
        url.searchParams.append("client_id", this.settings.clientId as string);
        url.searchParams.append("client_secret", this.settings.clientSecret as string);
        url.searchParams.append("redirect_uri", this.getRedirectUri());
        console.log(url.toString());
        const res = await fetch(url, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method: "POST",
        });

        if (!res.ok) {
            throw DiscordApiErrors.GENERAL_ERROR;
        }

        return res.json() as Promise<ConnectedAccountCommonOAuthTokenResponse>;
    }

    async getUser(token: string): Promise<YouTubeConnectionChannelListResult> {
        const url = new URL(this.userInfoUrl);
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            method: "GET",
        });
        if (!res.ok) {
            throw DiscordApiErrors.GENERAL_ERROR;
        }
        return res.json() as Promise<YouTubeConnectionChannelListResult>;
    }

    async handleCallback(): Promise<null> {
        throw new Error("bad");
    }
    async handleCallbackGet(params: Record<string, string>): Promise<ConnectedAccount | null> {
        const { state, code } = params;
        if (!code) throw new Error("No code provided");

        const userId = this.getUserId(state);
        const tokenData = await this.exchangeCode(state, code);
        const userInfo = await this.getUser(tokenData.access_token);

        const exists = await this.hasConnection(userId, userInfo.items[0].id);

        if (exists) return null;

        return await this.createConnection({
            token_data: { ...tokenData, fetched_at: Date.now() },
            user_id: userId,
            external_id: userInfo.items[0].id,
            friend_sync: false,
            name: userInfo.items[0].snippet.title,
            type: this.id,
        });
    }
}
