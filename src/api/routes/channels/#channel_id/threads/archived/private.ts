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

function isArchivedThread(
	durationSec: number | undefined | null,
	inactivityMs: number,
): boolean {
	if (!durationSec && durationSec !== 0) durationSec = 86400;
	if (durationSec === 0) return false;
	return inactivityMs >= durationSec * 1000;
}

router.get(
	"/",
	route({
		responses: { 200: { body: "Object" } },
		query: {
			before: { type: "string", required: false },
			limit: { type: "number", required: false },
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };
		const { before } = req.query as { before?: string; limit?: number };
		const qLimit = (req.query as { limit?: number }).limit;
		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const limits = getGuildLimits(guildId).threads;
		const limit = resolveLimit(
			qLimit,
			limits.maxArchivedPageSize,
			limits.defaultArchivedPageSize,
			limits.maxArchivedPageSize,
		);

		const now = Date.now();
		const threads = await Channel.find({
			where: [
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

		let archived = withActivity
			.filter(({ t, inactivityMs }) =>
				isArchivedThread(t.default_auto_archive_duration, inactivityMs),
			)
			.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

		if (before) {
			const beforeTs = Number.isNaN(Number(before))
				? Date.parse(before)
				: Number(before);
			if (!Number.isNaN(beforeTs)) {
				archived = archived.filter(
					(x) => x.lastAt.getTime() < beforeTs,
				);
			}
		}

		const page = archived.slice(0, limit).map((x) => x.t);
		const has_more = archived.length > page.length;

		res.status(200).json({
			threads: page.map((c) => c.toJSON()),
			has_more,
		});
	},
);

export default router;
