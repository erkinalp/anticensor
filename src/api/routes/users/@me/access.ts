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
		right: "SELF_DELETE_DISABLE",
		responses: {
			200: { body: "UserIpAccessDTO" },
			403: { body: "APIErrorResponse" },
			404: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const ipAccess = await UserIpAccess.findOne({
			where: { user_id: req.user_id },
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
		right: "SELF_DELETE_DISABLE",
		requestBody: "UserIpAccessSchema",
		responses: {
			200: { body: "UserIpAccessDTO" },
			400: { body: "APIErrorResponse" },
			403: { body: "APIErrorResponse" },
			422: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const body = req.body as UserIpAccessSchema;
		const currentIp = getIpAdress(req);

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

		if (body.ips.length > 0 && !isIpInRange(currentIp, body.ips)) {
			return res.status(422).json({
				message: "Current IP address would be blocked by this policy",
				code: 50035,
			});
		}

		let ipAccess = await UserIpAccess.findOne({
			where: { user_id: req.user_id },
		});
		if (!ipAccess) {
			ipAccess = UserIpAccess.create({
				user_id: req.user_id,
				ips: body.ips,
			});
		} else {
			ipAccess.ips = body.ips;
		}

		await ipAccess.save();
		res.json(new UserIpAccessDTO(ipAccess));
	},
);

router.delete(
	"/",
	route({
		right: "SELF_DELETE_DISABLE",
		responses: {
			204: { body: "null" },
			403: { body: "APIErrorResponse" },
			404: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const ipAccess = await UserIpAccess.findOne({
			where: { user_id: req.user_id },
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
