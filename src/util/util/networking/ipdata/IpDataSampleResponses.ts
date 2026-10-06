/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2025 Spacebar and Spacebar Contributors

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

export interface IpDataIpLookupResponse {
    ip: string;
    is_eu: boolean;
    city: string;
    region: string;
    region_code: string;
    country_name: string;
    country_code: string;
    continent_name: string;
    continent_code: string;
    latitude: number;
    longitude: number;
    postal: string;
    calling_code: string;
    flag: string;
    emoji_flag: string;
    emoji_unicode: string;
    asn?: {
        asn: string;
        name: string;
        domain: string;
        route: string;
        type: string;
    };
    languages: [
        {
            name: string;
            native: string;
        },
    ];
    currency: {
        name: string;
        code: string;
        symbol: string;
        native: string;
        plural: string;
    };
    time_zone: {
        name: string;
        abbr: string;
        offset: string;
        is_dst: true;
        current_time: string;
    };
    threat: {
        is_tor: boolean;
        is_icloud_relay: boolean;
        is_proxy: boolean;
        is_datacenter: boolean;
        is_anonymous: boolean;
        is_known_attacker: boolean;
        is_known_abuser: boolean;
        is_threat: boolean;
        is_bogon: boolean;
        blocklists: [];
    };
    count: number;
    status: number;
}
