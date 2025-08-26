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

import { getIpAdress, route } from "@spacebar/api";
import {
	Ban,
	Guild,
	User,
	Member,
	emitEvent,
	GuildBanAddEvent,
	AuditLog,
	AuditLogEvents,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { getRights, Rights } from "@spacebar/util";
const router = Router();

router.get(
	"/",
	route({
		responses: {
			404: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		res.status(404).json({
			message: "Unknown Guild Member Verification Form",
			code: 10068,
		});
	},
);

router.post(
	"/decide",
	route({
		requestBody: "MemberVerificationDecisionSchema",
		responses: {
			204: {},
			400: {
				body: "APIErrorResponse",
			},
			403: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { guild_id } = req.params as { guild_id: string };
		const {
			user_id: targetId,
			decision,
			reason,
		} = req.body as {
			user_id: string;
			decision: "accept" | "reject";
			reason?: string;
		};

		if (!targetId || !decision) throw new HTTPError("Invalid body", 400);

		const rights = await getRights(req.user_id);
		const perm = req.permission;

		const canModerate =
			rights.has(Rights.FLAGS.MANAGE_USERS) ||
			perm?.has("BAN_MEMBERS") ||
			perm?.has("MANAGE_GUILD") ||
			perm?.has("ADMINISTRATOR");

		if (!canModerate)
			throw new HTTPError(
				"Missing permission to decide membership verification",
				403,
			);

		if (decision === "reject") {
			const guild = await Guild.findOneOrFail({
				where: { id: guild_id },
				select: { features: true, owner_id: true },
			});

			const enabled = (guild.features || []).includes(
				"BAN_QUESTIONNAIRE_REJECTS",
			);

			if (enabled) {
				if (req.user_id === targetId && targetId === guild.owner_id) {
					throw new HTTPError(
						"You are the guild owner, hence can't ban yourself",
						403,
					);
				}
				if (guild.owner_id === targetId)
					throw new HTTPError("You can't ban the owner", 400);

				const existingBan = await Ban.findOne({
					where: { guild_id, user_id: targetId },
				});
				if (!existingBan) {
					const banned_user = await User.getPublicUser(targetId);
					const ban = Ban.create({
						user_id: targetId,
						guild_id,
						ip: getIpAdress(req),
						executor_id: req.user_id,
						reason,
					});
					await Promise.all([
						Member.removeFromGuild(targetId, guild_id),
						ban.save(),
						AuditLog.insert({
							action_type: AuditLogEvents.MEMBER_BAN_ADD,
							user_id: req.user_id,
							reason: reason || "Membership screening rejected",
							changes: [],
							target: { id: targetId },
						}),
						emitEvent({
							event: "GUILD_BAN_ADD",
							data: {
								guild_id,
								user: banned_user,
							},
							guild_id,
						} as GuildBanAddEvent),
					]);
				}
			}
		}

		return res.status(204).send();
	},
);

export default router;
