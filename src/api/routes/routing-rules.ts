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
	RoutingRule,
	Snowflake,
	Channel,
	getPermission,
	getRights,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router();

router.get(
	"/",
	route({
		responses: {
			200: {
				body: "RoutingRule[]",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const user_id = req.user_id;
		if (!user_id) throw new HTTPError("Unauthorized", 401);

		const rights = await getRights(user_id);
		const hasManageRoutingRight = rights.has("MANAGE_ROUTING");

		let rules: RoutingRule[];

		if (hasManageRoutingRight) {
			rules = await RoutingRule.find({
				relations: [
					"source_channel",
					"storage_channel",
					"sink_channel",
				],
			});
		} else {
			const allRules = await RoutingRule.find({
				relations: [
					"source_channel",
					"storage_channel",
					"sink_channel",
				],
			});

			rules = [];
			for (const rule of allRules) {
				try {
					if (rule.source_channel?.guild_id) {
						const permission = await getPermission(
							user_id,
							rule.source_channel.guild_id,
							rule.source_channel_id,
						);
						if (permission.has("VIEW_CHANNEL")) {
							rules.push(rule);
						}
					}
				} catch (e) {
					continue;
				}
			}
		}

		return res.json(rules);
	},
);

router.post(
	"/",
	route({
		right: "MANAGE_ROUTING",
		responses: {
			201: {
				body: "RoutingRule",
			},
			400: {
				body: "APIErrorResponse",
			},
			403: {
				body: "APIErrorResponse",
			},
			404: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const {
			source_channel_id,
			storage_channel_id,
			sink_channel_id,
			source_users,
			target_users,
			valid_since,
			valid_until,
		} = req.body;

		if (
			!source_channel_id ||
			!storage_channel_id ||
			!sink_channel_id ||
			!source_users ||
			!target_users ||
			!valid_since ||
			!valid_until
		) {
			throw new HTTPError("Missing required fields", 400);
		}

		const sourceChannel = await Channel.findOne({
			where: { id: source_channel_id },
		});
		const storageChannel = await Channel.findOne({
			where: { id: storage_channel_id },
		});
		const sinkChannel = await Channel.findOne({
			where: { id: sink_channel_id },
		});

		if (!sourceChannel || !storageChannel || !sinkChannel) {
			throw new HTTPError("One or more channels not found", 404);
		}

		const rule = RoutingRule.create({
			registration_timestamp: Snowflake.generate(),
			source_channel_id,
			storage_channel_id,
			sink_channel_id,
			source_users: Array.isArray(source_users)
				? source_users
				: [source_users],
			target_users: Array.isArray(target_users)
				? target_users
				: [target_users],
			valid_since,
			valid_until,
		});

		await RoutingRule.validateInvariants(rule);

		await rule.save();

		return res.status(201).json(rule);
	},
);

router.patch(
	"/:rule_id",
	route({
		right: "MANAGE_ROUTING",
		responses: {
			200: {
				body: "RoutingRule",
			},
			400: {
				body: "APIErrorResponse",
			},
			403: {
				body: "APIErrorResponse",
			},
			404: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { rule_id } = req.params;
		const { valid_until } = req.body;

		if (!valid_until) {
			throw new HTTPError(
				"Only valid_until can be updated on routing rules",
				400,
			);
		}

		const rule = await RoutingRule.findOne({
			where: { id: rule_id },
		});

		if (!rule) {
			throw new HTTPError("Routing rule not found", 404);
		}

		const now = Snowflake.generate();
		if (
			BigInt(rule.valid_since) > BigInt(now) ||
			BigInt(now) > BigInt(rule.valid_until)
		) {
			throw new HTTPError(
				"Cannot update routing rule that is not currently in effect",
				400,
			);
		}

		if (BigInt(valid_until) < BigInt(rule.valid_since)) {
			throw new HTTPError(
				"valid_until cannot be earlier than valid_since",
				400,
			);
		}

		rule.valid_until = valid_until;
		await rule.save();

		return res.json(rule);
	},
);

router.delete(
	"/:rule_id",
	route({
		right: "MANAGE_ROUTING",
		responses: {
			204: {},
			400: {
				body: "APIErrorResponse",
			},
			403: {
				body: "APIErrorResponse",
			},
			404: {
				body: "APIErrorResponse",
			},
		},
	}),
	async (req: Request, res: Response) => {
		const { rule_id } = req.params;

		const canDelete = await RoutingRule.canDelete(rule_id);

		if (!canDelete) {
			throw new HTTPError(
				"Cannot delete routing rule: rule is in effect or has affected messages",
				400,
			);
		}

		await RoutingRule.delete({ id: rule_id });

		return res.status(204).send();
	},
);

export default router;
