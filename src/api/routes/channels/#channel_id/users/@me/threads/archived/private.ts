import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import { resolveLimit, getGuildLimits } from "@spacebar/util";

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
		const qLimit = (req.query as { limit?: number }).limit;
		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const limits = getGuildLimits(guildId).threads;
		const limit = resolveLimit(
			qLimit,
			limits.maxArchivedPageSize,
			limits.defaultArchivedPageSize,
			limits.maxArchivedPageSize,
		);
		res.status(200).json({ threads: [], has_more: false });
	},
);

export default router;

export {};
