/*
    This file is part of Spacebar.

    Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { Config, ConnectedAccount, Connection, ConnectionLoader } from "@spacebar/util";
import { SteamSettings } from "./SteamSettings";
import { ConnectionCallbackSchema } from "@spacebar/schemas";

interface SteamProfile {
    response: {
        players: {
            steamid: string;
            personaname: string;
            profileurl: string;
            avatarmedium: string;
            lastlogoff: number;
            primaryclanid: string;
            timecreated: number; //time in seconds
        }[];
    };
}
const nameSpace = "http://specs.openid.net/auth/2.0";
const idSelect = "http://specs.openid.net/auth/2.0/identifier_select";
export default class SteamConnection extends Connection {
    public readonly id = "steam";
    public readonly friendlyName = "Steam";
    public readonly setupUrl = "https://steamcommunity.com/dev/apikey";
    public readonly requiredScopes: string[] = [];
    public readonly authorizeUrl = "https://steamcommunity.com/openid/login";
    settings: SteamSettings = new SteamSettings();

    public get isConfigured(): boolean {
        return !!this.settings.clientSecret;
    }

    init(): void {
        this.icon_url = "https://simpleicons.org/icons/steam.svg";
        this.settings = ConnectionLoader.getConnectionConfig<SteamSettings>(this.id, this.settings);

        if (this.settings.enabled && !this.settings.clientSecret) throw new Error(`Invalid settings for connection ${this.id}`);
    }

    getAuthorizationUrl(userId: string): string {
        const state = this.createState(userId);

        const url = new URL(this.authorizeUrl);

        url.searchParams.append("openid.ns", nameSpace);
        url.searchParams.append("openid.mode", "checkid_setup");
        url.searchParams.append("openid.identity", idSelect);
        url.searchParams.append("openid.claimed_id", idSelect);
        url.searchParams.append("openid.realm", Config.get().api.endpointPublic ?? "");
        url.searchParams.append("openid.return_to", this.getRedirectUri() + "?state=" + state);

        return url.toString();
    }

    getTokenUrl(): string {
        return ""; //this.tokenUrl;
    }

    async handleCallbackGet(params: Record<string, string>): Promise<ConnectedAccount | null> {
        const { state } = params;
        const userId = this.getUserId(state);
        params["openid.mode"] = "check_authentication";
        const url = "https://steamcommunity.com/openid/login?" + new URLSearchParams(Object.entries(params));
        const res = await fetch(url, { method: "POST" });
        const text = await res.text();
        if (!text.includes("is_valid:true")) throw new Error("unable to verify");
        const id = params["openid.claimed_id"].split("/").at(-1);
        const prof = await fetch("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=" + this.settings.clientSecret + "&steamids=" + id);
        const steamProfile = ((await prof.json()) as SteamProfile).response.players[0];

        return await this.createConnection({
            user_id: userId,
            external_id: steamProfile.steamid,
            metadata_: {
                created_at: new Date(steamProfile.timecreated * 1000).toISOString().replace("Z", "+00:00"),
            },
            friend_sync: false,
            name: steamProfile.personaname,
            type: this.id,
        });
    }

    async handleCallback(_: ConnectionCallbackSchema): Promise<ConnectedAccount | null> {
        throw new Error("This is not used by steam, you should never see this message");
    }
}
