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

import { Router, Response, Request } from "express";
import { route } from "@spacebar/api";
import { AuditLog, getGuildLimits, resolveLimit } from "@spacebar/util";

const router = Router({ mergeParams: true });

router.get(
	"/",
	route({
		query: {
			user_id: {
				type: "string",
				required: false,
				description: "Filter by user id",
			},
			action_type: {
				type: "number",
				required: false,
				description: "Filter by action type",
			},
			before: {
				type: "string",
				required: false,
				description: "Entries before this id",
			},
			limit: {
				type: "number",
				required: false,
				description: "Max number of entries to return",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const { user_id, action_type, before } = req.query as {
			user_id?: string;
			action_type?: number;
			before?: string;
			limit?: number;
		};
		const qLimit = (req.query as { limit?: number }).limit;
		const limits = getGuildLimits(guildId).auditLogs;
		const effectiveLimit = resolveLimit(
			qLimit,
			limits.maxLimit,
			limits.defaultLimit,
			limits.maxLimit,
		);

		const qb = AuditLog.createQueryBuilder("audit").orderBy(
			"audit.id",
			"DESC",
		);

		if (user_id) qb.andWhere("audit.user_id = :user_id", { user_id });
		if (typeof action_type === "number")
			qb.andWhere("audit.action_type = :action_type", { action_type });
		if (before) qb.andWhere("audit.id < :before", { before });

		qb.limit(effectiveLimit);

		const audit_log_entries = await qb.getMany();

		res.json({
			audit_log_entries,
			users: [],
			integrations: [],
			webhooks: [],
			guild_scheduled_events: [],
			threads: [],
			application_commands: [],
		});
	},
);

export default router;
