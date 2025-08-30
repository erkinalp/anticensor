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

export interface ThreadLimitsConfiguration {
	defaultThreadPageSize: number;
	maxThreadPageSize: number | null;
	defaultArchivedPageSize: number;
	maxArchivedPageSize: number | null;
	privateThreadMaxMembers: number | null;
}

export interface CrosspostLimitsConfiguration {
	crosspostMaxTargets: number | null;
}

export interface FollowersLimitsConfiguration {
	followersMaxPerChannel: number | null;
}

export class ApiConfiguration {
	defaultVersion: string = "9";
	activeVersions: string[] = ["6", "7", "8", "9"];
	endpointPublic: string | null = null;
	limits: {
		threads: ThreadLimitsConfiguration;
		crosspost: CrosspostLimitsConfiguration;
		followers: FollowersLimitsConfiguration;
	} = {
		threads: {
			defaultThreadPageSize: 25,
			maxThreadPageSize: 100,
			defaultArchivedPageSize: 25,
			maxArchivedPageSize: 100,
			privateThreadMaxMembers: null,
		},
		crosspost: {
			crosspostMaxTargets: null,
		},
		followers: {
			followersMaxPerChannel: null,
		},
	};
}
