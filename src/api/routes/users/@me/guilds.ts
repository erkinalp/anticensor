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

import { route } from "@spacebar/api";
import {
	Config,
	Guild,
	GuildDeleteEvent,
	GuildMemberRemoveEvent,
	Member,
	User,
	emitEvent,
	Role,
	Permissions,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router();

router.get(
	"/",
	route({
		responses: {
			200: {
				body: "APIGuildArray",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const members = await Member.find({
			relations: ["guild"],
			where: { id: req.user_id },
		});

		const guilds = members.map((x) => x.guild);

		if ("with_counts" in req.query && req.query.with_counts == "true") {
			const user = await User.findOneOrFail({
				where: { id: req.user_id },
				select: ["id"],
			});
			const results = await Promise.all(
				members.map(async (m) => {
					const roles = await Role.find({
						where: { guild_id: m.guild.id },
					});
					const perms =
						m.guild.owner_id === user.id
							? new Permissions(Permissions.FLAGS.ADMINISTRATOR)
							: Permissions.finalPermission({
									user: {
										id: user.id,
										roles: (
											await Member.findOneOrFail({
												where: {
													id: user.id,
													guild_id: m.guild.id,
												},
												relations: ["roles"],
											})
										).roles.map((r) => r.id),
									},
									guild: { roles },
								});
					return {
						...m.guild,
						permissions: perms.bitfield.toString(),
					};
				}),
			);
			return res.json(results);
		}

		res.json(guilds);
	},
);

// user send to leave a certain guild
router.delete(
	"/:guild_id",
	route({
		responses: {
			204: {},
			400: {
				body: "APIErrorResponse",
			},
			404: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { autoJoin } = Config.get().guild;
		const { guild_id } = req.params;
		const guild = await Guild.findOneOrFail({
			where: { id: guild_id },
			select: ["owner_id"],
		});

		if (!guild) throw new HTTPError("Guild doesn't exist", 404);
		if (guild.owner_id === req.user_id)
			throw new HTTPError("You can't leave your own guild", 400);
		if (
			autoJoin.enabled &&
			autoJoin.guilds.includes(guild_id) &&
			!autoJoin.canLeave
		) {
			throw new HTTPError(
				"You can't leave instance auto join guilds",
				400,
			);
		}

		await Promise.all([
			Member.delete({ id: req.user_id, guild_id: guild_id }),
			emitEvent({
				event: "GUILD_DELETE",
				data: {
					id: guild_id,
				},
				user_id: req.user_id,
			} as GuildDeleteEvent),
		]);

		const user = await User.getPublicUser(req.user_id);

		await emitEvent({
			event: "GUILD_MEMBER_REMOVE",
			data: {
				guild_id: guild_id,
				user: user,
			},
			guild_id: guild_id,
		} as GuildMemberRemoveEvent);

		return res.sendStatus(204);
	},
);

export default router;
