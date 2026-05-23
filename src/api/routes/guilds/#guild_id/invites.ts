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

import { route } from "@harmony/api";
import { Invite, PublicInviteRelation } from "@harmony/util";
import { Request, Response, Router } from "express";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        permission: "MANAGE_GUILD",
        responses: {
            200: {
                body: "APIInviteArray",
            },
        },
    }),
    async (req: Request, res: Response) => {
        const { guild_id } = req.params as { [key: string]: string };

        // TODO(typeorm-v1): `relations` no longer accepts a string array. This value references a variable whose shape can't be determined statically — if it holds `string[]`, wrap it: `Object.fromEntries(<expr>?.map(r => [r, true]) ?? [])` (dot-paths need extra nesting handling). If it already holds the v1 object shape, no change needed.
        const invites = await Invite.find({
            where: { guild_id },
            relations: PublicInviteRelation,
        });

        await Promise.all(
            invites
                .filter((i) => i.isExpired())
                .map(async (i) => {
                    await Invite.delete({ code: i.code });
                }),
        );

        return res.json(invites.filter((i) => !i.isExpired()));
    },
);

export default router;
