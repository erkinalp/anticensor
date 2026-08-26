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

import { Router, Response, Request } from "express";
import { Config } from "@harmony/util";
import { storage } from "@harmony/cdn";
import { detectBufferMime } from "mime-detect";
import { HTTPError } from "lambert-server";
import crypto from "crypto";
import { multer } from "./multer";
import { cache, cacheNotFound } from "./cache";

const ANIMATED_MIME_TYPES = ["image/apng", "image/gif", "image/gifv"];
const STATIC_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/svg"];
const IMG_MIME_TYPES = [...ANIMATED_MIME_TYPES, ...STATIC_MIME_TYPES];
interface RouteSettings {
    getonly?: boolean;
    noHash?: boolean;
    ids?: number;
    customPath?: (id: string, hash?: string, id2?: string) => string;
}
export function registerRoute(name: string, settings: RouteSettings = {}) {
    const router = Router({ mergeParams: true });
    const endpoint = Config.get().cdn.endpointPublic;

    settings.ids ??= 1;

    const ids = settings.ids ? "/:id" : "/:id/:id2";
    const idsWithhash = settings.noHash ? ids : ids + "/:hash";

    router.get(idsWithhash, cache, async (req: Request, res: Response) => {
        const { id, id2 } = req.params as { [key: string]: string };
        let { hash } = req.params as { [key: string]: string };
        hash = hash.split(".")[0]; // remove .file extension
        const path = `${name}/${toPath(id, hash, id2)}`;
        console.log(path);

        const file = await storage.get(path);
        if (!file) return cacheNotFound(req, res);
        const mime = await detectBufferMime(file);

        res.set("Content-Type", mime);

        return res.send(file);
    });

    if (settings?.getonly) return router;
    const toPath = (id: string, hash?: string, id2?: string) => {
        const build = id2 ? `${id}/${id2}` : `${id}`;
        return !hash || settings?.noHash ? `${build}` : `${build}/${hash}`;
    };

    router.post(idsWithhash, multer.single("file"), async (req: Request, res: Response) => {
        if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");
        if (!req.file) throw new HTTPError("Missing file");
        const { buffer, size } = req.file;
        const { id, id2 } = req.params as { [key: string]: string };

        let hash = crypto.createHash("md5").update(buffer).digest("hex");

        const mime = await detectBufferMime(buffer);
        if (!IMG_MIME_TYPES.includes(mime)) throw new HTTPError("Invalid file type");
        if (ANIMATED_MIME_TYPES.includes(mime)) hash = `a_${hash}`; // animated icons have a_ infront of the hash

        const path = `${name}/${toPath(id, hash, id2)}`;

        await storage.set(path, buffer);

        return res.json({
            id: hash,
            content_type: mime,
            size,
            url: `${endpoint}${req.baseUrl}/${toPath(id, hash)}`,
        });
    });

    router.delete(idsWithhash, async (req: Request, res: Response) => {
        if (req.headers.signature !== Config.get().security.requestSignature) throw new HTTPError("Invalid request signature");
        const { id, id2, hash } = req.params as { [key: string]: string };
        const path = `${name}/${toPath(id, hash, id2)}`;

        await storage.delete(path);

        return res.send({ success: true });
    });

    return router;
}
