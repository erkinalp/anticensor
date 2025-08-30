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

import { DiscoveryConfiguration, AutoJoinConfiguration } from ".";

export interface GuildThreadLimitsConfiguration {
	defaultThreadPageSize?: number;
	maxThreadPageSize?: number | null;
	defaultArchivedPageSize?: number;
	maxArchivedPageSize?: number | null;
	privateThreadMaxMembers?: number | null;
}

export interface GuildCrosspostLimitsConfiguration {
	crosspostMaxTargets?: number | null;
}

export interface GuildFollowersLimitsConfiguration {
	followersMaxPerChannel?: number | null;
}

export class GuildConfiguration {
	discovery: DiscoveryConfiguration = new DiscoveryConfiguration();
	autoJoin: AutoJoinConfiguration = new AutoJoinConfiguration();
	defaultFeatures: string[] = [];
	limits?: {
		threads?: GuildThreadLimitsConfiguration;
		crosspost?: GuildCrosspostLimitsConfiguration;
		followers?: GuildFollowersLimitsConfiguration;
	};
}
