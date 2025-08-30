import { Config } from "../util/Config";

type MaybeNum = number | null | undefined;

export function resolveLimit(
	requested: MaybeNum,
	guildOverride: MaybeNum,
	globalDefault: number,
	globalMax: MaybeNum,
): number {
	const overrideMax = guildOverride ?? globalMax;
	const maxUnlimited = overrideMax == null ? true : overrideMax < 0;
	const limit = requested ?? guildOverride ?? globalDefault;
	if (limit == null) return globalDefault;
	if (limit < 0)
		return maxUnlimited ? Number.MAX_SAFE_INTEGER : (overrideMax as number);
	if (maxUnlimited) return limit;
	return Math.min(limit, overrideMax as number);
}

export function getGuildLimits(_guildId?: string) {
	const cfg = Config.get();
	return {
		threads: {
			defaultThreadPageSize:
				cfg.api.limits.threads.defaultThreadPageSize ?? 25,
			maxThreadPageSize: cfg.api.limits.threads.maxThreadPageSize ?? 100,
			defaultArchivedPageSize:
				cfg.api.limits.threads.defaultArchivedPageSize ?? 25,
			maxArchivedPageSize:
				cfg.api.limits.threads.maxArchivedPageSize ?? 100,
			privateThreadMaxMembers:
				cfg.api.limits.threads.privateThreadMaxMembers ?? null,
		},
		crosspost: {
			crosspostMaxTargets:
				cfg.api.limits.crosspost.crosspostMaxTargets ?? null,
		},
		followers: {
			followersMaxPerChannel:
				cfg.api.limits.followers.followersMaxPerChannel ?? null,
		},
		auditLogs: {
			defaultLimit: cfg.api.limits.auditLogs?.defaultLimit ?? 50,
			maxLimit: cfg.api.limits.auditLogs?.maxLimit ?? 100,
		},
	};
}
