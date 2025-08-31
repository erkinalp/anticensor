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

import { route, getIpAdress } from "@spacebar/api";
import {
	UserIpAccess,
	UserIpAccessSchema,
	UserIpAccessDTO,
	User,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import {
	isValidIpAddress,
	isLocalhostIp,
	isIpInRange,
} from "../../../util/utility/ipValidation";

const router: Router = Router();

router.get(
	"/",
	route({
		right: "OPERATOR",
		responses: {
			200: { body: "UserIpAccessDTO" },
			403: { body: "APIErrorResponse" },
			404: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const targetUserId = req.params.id;

		const targetUser = await User.findOne({ where: { id: targetUserId } });
		if (!targetUser) {
			return res
				.status(404)
				.json({ message: "User not found", code: 10013 });
		}

		const ipAccess = await UserIpAccess.findOne({
			where: { user_id: targetUserId },
		});
		if (!ipAccess) {
			return res
				.status(404)
				.json({ message: "IP access policy not found", code: 10013 });
		}
		res.json(new UserIpAccessDTO(ipAccess));
	},
);

router.put(
	"/",
	route({
		right: "OPERATOR",
		requestBody: "UserIpAccessSchema",
		responses: {
			200: { body: "UserIpAccessDTO" },
			400: { body: "APIErrorResponse" },
			403: { body: "APIErrorResponse" },
			404: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const body = req.body as UserIpAccessSchema;
		const targetUserId = req.params.id;

		const targetUser = await User.findOne({ where: { id: targetUserId } });
		if (!targetUser) {
			return res
				.status(404)
				.json({ message: "User not found", code: 10013 });
		}

		for (const ip of body.ips) {
			if (!isValidIpAddress(ip)) {
				return res.status(400).json({
					message: "Invalid IP address format",
					code: 50035,
				});
			}
			if (isLocalhostIp(ip)) {
				return res.status(400).json({
					message: "Localhost IPs are not allowed",
					code: 50035,
				});
			}
		}

		for (const ip of body.banned_ips) {
			if (!isValidIpAddress(ip)) {
				return res.status(400).json({
					message: "Invalid IP address format",
					code: 50035,
				});
			}
			if (isLocalhostIp(ip)) {
				return res.status(400).json({
					message: "Localhost IPs are not allowed",
					code: 50035,
				});
			}
		}

		let ipAccess = await UserIpAccess.findOne({
			where: { user_id: targetUserId },
		});
		if (!ipAccess) {
			ipAccess = UserIpAccess.create({
				user_id: targetUserId,
				ips: body.ips,
				banned_ips: body.banned_ips,
			});
		} else {
			ipAccess.ips = body.ips;
			ipAccess.banned_ips = body.banned_ips;
		}

		await ipAccess.save();
		res.json(new UserIpAccessDTO(ipAccess));
	},
);

router.delete(
	"/",
	route({
		right: "OPERATOR",
		responses: {
			204: { body: "null" },
			403: { body: "APIErrorResponse" },
			404: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const targetUserId = req.params.id;

		const targetUser = await User.findOne({ where: { id: targetUserId } });
		if (!targetUser) {
			return res
				.status(404)
				.json({ message: "User not found", code: 10013 });
		}

		const ipAccess = await UserIpAccess.findOne({
			where: { user_id: targetUserId },
		});
		if (!ipAccess) {
			return res
				.status(404)
				.json({ message: "IP access policy not found", code: 10013 });
		}
		await ipAccess.remove();
		res.status(204).send();
	},
);

export default router;
