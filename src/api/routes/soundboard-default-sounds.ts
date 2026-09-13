/*
	Harmony: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Harmony and Harmony Contributors

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

import { Request, Response, Router } from "express";
import { route } from "#harmony/api";
import { SoundboardSound } from "#harmony/util";
import { IsNull } from "typeorm";

const router: Router = Router({ mergeParams: true });
router.get("/", route({ permission: null }), async (req: Request, res: Response) => {
    const hasPerms = req.rights.has("OPERATOR");
    res.json((await SoundboardSound.find({ where: { guild_id: IsNull() }, relations: { user: hasPerms } })).map((_) => _.toJSON(hasPerms)));
});

export default router;
