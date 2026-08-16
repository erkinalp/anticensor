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

import { route } from "#harmony/api";
import { Request, Response, Router } from "express";
import { getGifProvider } from "#harmony/util";

const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        query: {
            locale: {
                type: "string",
                description: "Locale",
            },
        },
        responses: {
            200: {
                body: "TrendingResponse",
            },
        },
        permission: null,
    }),
    async (req: Request, res: Response) => {
        const { media_format, locale, provider } = req.query as Record<string, string>;

        const p = getGifProvider(provider);

        res.json(await p.trending({ media_format: media_format ?? "gif", locale })).status(200);
    },
);

export default router;
