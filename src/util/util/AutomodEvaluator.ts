import { AutomodRule, Channel, ChannelType, User } from "../entities";
import { AutomodTriggerTypes } from "./Constants";

// AutomodEvaluator: Evaluates messages against guild automod rules.
// Architecture: Main evaluateMessage() -> getActiveRules() -> evaluateRule() -> specific evaluators.
// Supports keyword matching (wildcards/regex), spam detection, and mention spam rules.

interface AutomodEvaluationContext {
	content?: string;
	channel: Channel;
	author: User;
	guild_id?: string;
	member_roles?: string[];
}

interface AutomodEvaluationResult {
	triggered: boolean;
	rule?: AutomodRule;
	matched_content?: string;
	keyword?: string;
	actions: AutomodAction[];
}

interface AutomodAction {
	type: number;
	metadata?: Record<string, unknown>;
}

export class AutomodEvaluator {
	// Performance cache: Automod rules are queried on every message send, which can cause
	// significant database load in active guilds. This cache reduces DB queries while ensuring
	// rules are refreshed periodically and immediately when modified via clearCache().
	// Cache is invalidated on rule create/update/delete in the automod rules route.
	private static ruleCache = new Map<string, AutomodRule[]>();
	private static cacheExpiry = new Map<string, number>();
	private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	static async evaluateMessage(
		context: AutomodEvaluationContext,
	): Promise<AutomodEvaluationResult> {
		if (
			context.channel.type === ChannelType.ENCRYPTED ||
			context.channel.type === ChannelType.ENCRYPTED_THREAD
		) {
			return { triggered: false, actions: [] };
		}

		if (!context.guild_id) {
			return { triggered: false, actions: [] };
		}

		const rules = await this.getActiveRules(context.guild_id);

		for (const rule of rules) {
			if (!rule.enabled) continue;

			if (this.isExempt(rule, context)) continue;

			const result = await this.evaluateRule(rule, context);
			if (result.triggered) {
				return result;
			}
		}

		return { triggered: false, actions: [] };
	}

	private static async getActiveRules(
		guild_id: string,
	): Promise<AutomodRule[]> {
		const now = Date.now();
		const cacheKey = guild_id;

		if (
			this.ruleCache.has(cacheKey) &&
			this.cacheExpiry.get(cacheKey)! > now
		) {
			return this.ruleCache.get(cacheKey)!;
		}

		const rules = await AutomodRule.find({
			where: { guild_id, enabled: true },
			order: { position: "ASC" },
		});

		this.ruleCache.set(cacheKey, rules);
		this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

		return rules;
	}

	private static isExempt(
		rule: AutomodRule,
		context: AutomodEvaluationContext,
	): boolean {
		if (rule.exempt_channels?.includes(context.channel.id)) {
			return true;
		}

		if (rule.exempt_roles?.length && context.member_roles?.length) {
			return rule.exempt_roles.some((roleId) =>
				context.member_roles!.includes(roleId),
			);
		}

		return false;
	}

	private static async evaluateRule(
		rule: AutomodRule,
		context: AutomodEvaluationContext,
	): Promise<AutomodEvaluationResult> {
		switch (rule.trigger_type) {
			case AutomodTriggerTypes.CUSTOM_WORDS:
				return this.evaluateKeywordRule(rule, context);
			case AutomodTriggerTypes.SUSPECTED_SPAM_CONTENT:
				return this.evaluateSpamRule(rule, context);
			case AutomodTriggerTypes.MENTION_SPAM:
				return this.evaluateMentionSpamRule(rule, context);
			default:
				return { triggered: false, actions: [] };
		}
	}

	private static evaluateKeywordRule(
		rule: AutomodRule,
		context: AutomodEvaluationContext,
	): AutomodEvaluationResult {
		if (!context.content) {
			return { triggered: false, actions: [] };
		}

		const metadata = rule.trigger_metadata as Record<string, unknown>;
		const content = context.content.toLowerCase();

		if (metadata.allow_list) {
			for (const allowedKeyword of metadata.allow_list as string[]) {
				if (this.matchesKeyword(content, allowedKeyword)) {
					return { triggered: false, actions: [] };
				}
			}
		}

		if (metadata.keyword_filter) {
			for (const keyword of metadata.keyword_filter as string[]) {
				if (this.matchesKeyword(content, keyword)) {
					return {
						triggered: true,
						rule,
						keyword,
						matched_content: this.extractMatchedContent(
							content,
							keyword,
						),
						actions: rule.actions as AutomodAction[],
					};
				}
			}
		}

		if (metadata.regex_patterns) {
			for (const pattern of metadata.regex_patterns as string[]) {
				try {
					const regex = new RegExp(pattern, "i");
					const match = content.match(regex);
					if (match) {
						return {
							triggered: true,
							rule,
							keyword: pattern,
							matched_content: match[0],
							actions: rule.actions as AutomodAction[],
						};
					}
				} catch (e) {
					console.error(`Invalid regex pattern: ${pattern}`, e);
				}
			}
		}

		return { triggered: false, actions: [] };
	}

	private static matchesKeyword(content: string, keyword: string): boolean {
		const lowerKeyword = keyword.toLowerCase();

		if (lowerKeyword.startsWith("*") && lowerKeyword.endsWith("*")) {
			const cleanKeyword = lowerKeyword.slice(1, -1);
			return content.includes(cleanKeyword);
		} else if (lowerKeyword.startsWith("*")) {
			const cleanKeyword = lowerKeyword.slice(1);
			return content
				.split(/\s+/)
				.some((word) => word.endsWith(cleanKeyword));
		} else if (lowerKeyword.endsWith("*")) {
			const cleanKeyword = lowerKeyword.slice(0, -1);
			return content
				.split(/\s+/)
				.some((word) => word.startsWith(cleanKeyword));
		} else {
			const wordBoundaryRegex = new RegExp(
				`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
				"i",
			);
			return wordBoundaryRegex.test(content);
		}
	}

	private static extractMatchedContent(
		content: string,
		keyword: string,
	): string {
		const index = content
			.toLowerCase()
			.indexOf(keyword.toLowerCase().replace(/\*/g, ""));
		if (index === -1) return content.substring(0, 50);

		const start = Math.max(0, index - 25);
		const end = Math.min(content.length, index + 25);
		return content.substring(start, end);
	}

	private static evaluateSpamRule(
		rule: AutomodRule,
		context: AutomodEvaluationContext,
	): AutomodEvaluationResult {
		if (!context.content) return { triggered: false, actions: [] };

		const content = context.content;
		const spamIndicators = [
			content.length > 1000,
			(content.match(/[A-Z]/g) || []).length / content.length > 0.7,
			content.split("").filter((c) => c === "!").length > 10,
		];

		if (spamIndicators.filter(Boolean).length >= 2) {
			return {
				triggered: true,
				rule,
				matched_content: content.substring(0, 100),
				actions: rule.actions as AutomodAction[],
			};
		}

		return { triggered: false, actions: [] };
	}

	private static evaluateMentionSpamRule(
		rule: AutomodRule,
		context: AutomodEvaluationContext,
	): AutomodEvaluationResult {
		if (!context.content) return { triggered: false, actions: [] };

		const metadata = rule.trigger_metadata as Record<string, unknown>;
		const mentionLimit = (metadata.mention_total_limit as number) || 5;

		const userMentions = (context.content.match(/<@!?\d+>/g) || []).length;
		const roleMentions = (context.content.match(/<@&\d+>/g) || []).length;
		const totalMentions = userMentions + roleMentions;

		if (totalMentions > mentionLimit) {
			return {
				triggered: true,
				rule,
				matched_content: `${totalMentions} mentions (limit: ${mentionLimit})`,
				actions: rule.actions as AutomodAction[],
			};
		}

		return { triggered: false, actions: [] };
	}

	static clearCache(guild_id?: string) {
		if (guild_id) {
			this.ruleCache.delete(guild_id);
			this.cacheExpiry.delete(guild_id);
		} else {
			this.ruleCache.clear();
			this.cacheExpiry.clear();
		}
	}
}
