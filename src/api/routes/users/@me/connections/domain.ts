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
import { route } from "@harmony/api";
import { Config, ConnectedAccount, ConnectedAccountDTO, Connection, emitEvent } from "@harmony/util";
import { HTTPError } from "#util/util/lambert-server";
import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import { ConnectedAccountSchema } from "@harmony/schemas";

const router: Router = Router({ mergeParams: true });
function domainToHash(domain: string, userId: string) {
    const conf = Config.get();
    const hash = createHash("sha256")
        .update(conf.general.instanceId + "-" + userId + "-" + domain)
        .digest("hex");
    return hash;
}

router.post("/:domain", route({ permission: null }), async (req: Request, res: Response) => {
    const { domain } = req.params as { [key: string]: string };
    const conf = Config.get();
    const hash = domainToHash(domain, req.user_id);
    if (
        await ConnectedAccount.exists({
            where: {
                user_id: req.user_id,
                type: "domain",
                external_id: domain,
            },
        })
    )
        throw new HTTPError("Domain is already linked");
    const proof = `hm${conf.general.instanceId}=${hash}`;
    try {
        const records = (await dns.resolveTxt("_harmony." + domain)).flat().flatMap((_) => _.split("\n"));
        for (const r of records) {
            if (r === proof) {
                const con = ConnectedAccount.create({
                    user_id: req.user_id,
                    verified: true,
                    type: "domain",
                    name: domain,
                    external_id: domain,
                } satisfies ConnectedAccountSchema);
                await con.save();

                await emitEvent({
                    event: "USER_CONNECTIONS_UPDATE",
                    data: { ...con, token_data: undefined },
                    user_id: req.user_id,
                });
                res.json(con.toJSON());
                return;
            }
        }
    } catch (e) {
        //console.error(e);
    }
    res.status(400);

    res.json({
        message: "Unable to validate domain.",
        code: 50187,
        proof: proof,
    });
});

export default router;
