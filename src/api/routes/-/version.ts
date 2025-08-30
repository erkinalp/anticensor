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
import { Config } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router();

router.get(
	"/",
	route({
		responses: {
			200: {},
		},
	}),
	async (_req: Request, res: Response) => {
		const cfg = Config.get ? Config.get() : ({} as Record<string, unknown>);
		const version =
			(typeof (cfg as Record<string, unknown>).version === "string"
				? ((cfg as Record<string, unknown>).version as string)
				: typeof (cfg as Record<string, unknown>).appVersion ===
					  "string"
					? ((cfg as Record<string, unknown>).appVersion as string)
					: process.env.npm_package_version) || "unknown";
		const api_compatibility =
			(typeof (cfg as Record<string, unknown>).apiCompatibility ===
			"string"
				? ((cfg as Record<string, unknown>).apiCompatibility as string)
				: null) ?? null;
		const extensions = (
			Array.isArray(
				(cfg as Record<string, unknown>).extensions as unknown[],
			)
				? ((cfg as { extensions: unknown[] }).extensions as unknown[])
				: []
		) as unknown[];

		res.json({
			version,
			api_compatibility,
			extensions,
		});
	},
);

export default router;
