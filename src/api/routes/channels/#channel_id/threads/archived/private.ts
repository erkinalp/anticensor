import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import {
	resolveLimit,
	getGuildLimits,
	Channel,
	ChannelType,
} from "@spacebar/util";
import { listArchivedThreadsFor } from "../../../../../util/thread-utils";

const router = Router({ mergeParams: true });

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

		const threads = await Channel.find({
			where: [
				{
					parent_id: channel_id,
					type: ChannelType.GUILD_PRIVATE_THREAD,
				},
			],
			order: { id: "DESC" },
		});

		const { threads: page, has_more } = await listArchivedThreadsFor(
			threads,
			before,
			limit,
		);

		res.status(200).json({
			threads: page.map((c: Channel) => c.toJSON()),
			has_more,
		});
	},
);

export default router;
