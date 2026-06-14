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

import { APIConnectionsConfiguration } from "#schemas";
import { route } from "@spacebar/api";
import { ConnectionConfig, ConnectionStore } from "@spacebar/util";
import { Request, Response, Router } from "express";
const router = Router({ mergeParams: true });

function makeRes() {
    const config = structuredClone(ConnectionConfig.get());

    Object.keys(config).forEach((key) => {
        delete config[key].clientId;
        delete config[key].clientSecret;
    });

    const connections = new Map([...ConnectionStore.connections.values()].map((_) => [_.id, _] as const));
    Object.entries(config as APIConnectionsConfiguration).forEach(([key, value]) => {
        const con = connections.get(key);
        console.log(key, con);
        if (!con) return;

        value.icon_url = con.icon_url;
    });

    resp = config;
    return resp;
}
let resp: unknown;
router.get(
    "/",
    route({
        responses: {
            200: {
                body: "APIConnectionsConfiguration",
            },
        },
    }),
    (req: Request, res: Response) => {
        if (resp) {
            res.json(resp);
            return;
        }
        res.json(makeRes());
    },
);

export default router;
