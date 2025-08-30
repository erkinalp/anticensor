import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import {
	resolveLimit,
	getGuildLimits,
	Channel,
	ChannelType,
	Message,
} from "@spacebar/util";

const router = Router({ mergeParams: true });

async function computeLastActivityAt(thread: Channel): Promise<Date> {
	if (thread.last_message_id) {
		const msg = await Message.findOne({
			where: { id: thread.last_message_id },
		});
		if (msg?.timestamp) return msg.timestamp;
	}
	return thread.created_at;
}

function isActiveThread(
	durationSec: number | undefined | null,
	inactivityMs: number,
): boolean {
	if (!durationSec && durationSec !== 0) durationSec = 86400;
	if (durationSec === 0) return true;
	return inactivityMs < durationSec * 1000;
}

router.get(
	"/",
	route({
		responses: { 200: { body: "Object" } },
		query: {
			after: { type: "string", required: false },
			limit: { type: "number", required: false },
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };
		const { after } = req.query as { after?: string; limit?: number };
		const qLimit = (req.query as { limit?: number }).limit;
		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const limits = getGuildLimits(guildId).threads;
		const limit = resolveLimit(
			qLimit,
			limits.maxThreadPageSize,
			limits.defaultThreadPageSize,
			limits.maxThreadPageSize,
		);

		const now = Date.now();
		const threads = await Channel.find({
			where: [
				{ parent_id: channel_id, type: ChannelType.GUILD_NEWS_THREAD },
				{
					parent_id: channel_id,
					type: ChannelType.GUILD_PUBLIC_THREAD,
				},
				{
					parent_id: channel_id,
					type: ChannelType.GUILD_PRIVATE_THREAD,
				},
			],
			order: { id: "DESC" },
		});

		const withActivity = await Promise.all(
			threads.map(async (t) => {
				const lastAt = await computeLastActivityAt(t);
				return { t, lastAt, inactivityMs: now - lastAt.getTime() };
			}),
		);

		const active = withActivity
			.filter(({ t, inactivityMs }) =>
				isActiveThread(t.default_auto_archive_duration, inactivityMs),
			)
			.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

		let filtered = active;
		if (after) {
			const afterTs = Number.isNaN(Number(after))
				? Date.parse(after)
				: Number(after);
			if (!Number.isNaN(afterTs)) {
				filtered = active.filter((x) => x.lastAt.getTime() < afterTs);
			}
		}

		const page = filtered.slice(0, limit).map((x) => x.t);
		const has_more = filtered.length > page.length;

		res.status(200).json({
			threads: page.map((c) => c.toJSON()),
			member_counts: {},
			has_more,
		});
	},
);

export default router;
