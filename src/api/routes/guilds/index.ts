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
	DiscordApiErrors,
	Guild,
	GuildCreateSchema,
	Member,
	getRights,
	Template,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import fetch from "node-fetch-commonjs";

const router: Router = Router();

//TODO: create default channel

router.post(
	"/",
	route({
		requestBody: "GuildCreateSchema",
		right: "CREATE_GUILDS",
		responses: {
			201: {
				body: "GuildCreateResponse",
			},
			400: {
				body: "APIErrorResponse",
			},
			403: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const body = req.body as GuildCreateSchema;

		const { maxGuilds } = Config.get().limits.user;
		const guild_count = await Member.count({ where: { id: req.user_id } });
		const rights = await getRights(req.user_id);
		if (guild_count >= maxGuilds && !rights.has("MANAGE_GUILDS")) {
			throw DiscordApiErrors.MAXIMUM_GUILDS.withParams(maxGuilds);
		}

		let template_serialized: unknown | null = null;
		let template_guild_id: string | null = null;

		if (body.guild_template_code) {
			const { enabled, allowDiscordTemplates, allowRaws } =
				Config.get().templates;

			if (!enabled) {
				return res.status(403).json({
					code: 403,
					message:
						"Template creation & usage is disabled on this instance.",
				});
			}

			const code = body.guild_template_code;

			if (code.startsWith("discord:")) {
				if (!allowDiscordTemplates) {
					return res.status(403).json({
						code: 403,
						message:
							"Discord templates cannot be used on this instance.",
					});
				}
				const discordTemplateID = code.split("discord:", 2)[1];
				const resp = await fetch(
					`https://discord.com/api/v10/guilds/templates/${discordTemplateID}`,
					{
						method: "get",
						headers: { "Content-Type": "application/json" },
					},
				);
				const data = (await resp.json()) as {
					serialized_source_guild?: unknown;
					source_guild_id?: string | null;
				};
				template_serialized = data?.serialized_source_guild ?? null;
				template_guild_id = data?.source_guild_id ?? null;
			} else if (code.startsWith("external:")) {
				if (!allowRaws) {
					return res.status(403).json({
						code: 403,
						message: "Importing raws is disabled on this instance.",
					});
				}
				const raw = code.split("external:", 2)[1];
				try {
					const parsed = JSON.parse(raw);
					if (parsed?.serialized_source_guild) {
						template_serialized = parsed.serialized_source_guild;
						template_guild_id = parsed?.source_guild_id ?? null;
					} else {
						template_serialized = parsed;
					}
				} catch {
					template_serialized = null;
					template_guild_id = null;
				}
			} else {
				const template = await Template.findOneOrFail({
					where: { code },
				});
				template_serialized = template.serialized_source_guild;
				template_guild_id = template.source_guild_id ?? null;
			}
		}

		const guild = await Guild.createGuild({
			...(template_serialized ?? {}),
			...body,
			owner_id: req.user_id,
			template_guild_id: template_guild_id,
		});

		const { autoJoin } = Config.get().guild;
		if (autoJoin.enabled && !autoJoin.guilds?.length) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			await Config.set({ guild: { autoJoin: { guilds: [guild.id] } } });
		}

		await Member.addToGuild(req.user_id, guild.id);

		res.status(201).json(guild);
	},
);

export default router;
