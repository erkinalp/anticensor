import path from "path";
export const CurrentTokenFormatVersion: number = 3;

import type { UserTokenData } from "./Token.js";
import jwt from "jsonwebtoken";
import { existsSync } from "fs";
import fs from "fs/promises";
import crypto from "node:crypto";

let lastFsCheck: number;
let cachedKeypair: {
    privateKey: crypto.KeyObject;
    publicKey: crypto.KeyObject;
    fingerprint: string;
};
// Get ECDSA keypair from file or generate it
export async function loadOrGenerateKeypair() {
    if (cachedKeypair) {
        // check for file deletion every minute
        if (Date.now() - lastFsCheck > 60000) {
            if (!existsSync("jwt.key") || !existsSync("jwt.key.pub")) {
                console.log("[JWT] Keypair files disappeared... Saving them again.");
                await Promise.all([
                    fs.writeFile("jwt.key", cachedKeypair.privateKey.export({ format: "pem", type: "sec1" })),
                    fs.writeFile("jwt.key.pub", cachedKeypair.publicKey.export({ format: "pem", type: "spki" })),
                ]);
            }
            lastFsCheck = Date.now();
        }

        return cachedKeypair;
    }

    let privateKey: crypto.KeyObject;
    let publicKey: crypto.KeyObject;

    if (existsSync("jwt.key") && existsSync("jwt.key.pub")) {
        const [loadedPrivateKey, loadedPublicKey] = await Promise.all([fs.readFile("jwt.key"), fs.readFile("jwt.key.pub")]);

        privateKey = crypto.createPrivateKey(loadedPrivateKey);
        publicKey = crypto.createPublicKey(loadedPublicKey);
    } else {
        console.log("[JWT] Generating new keypair:", path.resolve("jwt.key"), "- PWD:", process.cwd());
        const res = crypto.generateKeyPairSync("ec", {
            namedCurve: "secp521r1",
        });
        privateKey = res.privateKey;
        publicKey = res.publicKey;

        await Promise.all([
            fs.writeFile("jwt.key", privateKey.export({ format: "pem", type: "sec1" })),
            fs.writeFile("jwt.key.pub", publicKey.export({ format: "pem", type: "spki" })),
        ]);
    }

    const fingerprint = crypto
        .createHash("sha256")
        .update(publicKey.export({ format: "pem", type: "spki" }))
        .digest("hex");

    lastFsCheck = Date.now();
    return (cachedKeypair = { privateKey, publicKey, fingerprint });
}

export async function unsafeMakeToken(id: string, session_id: string, intents = 0): Promise<string | undefined> {
    const keyPair = await loadOrGenerateKeypair();
    const iat = Math.floor(Date.now() / 1000);
    return new Promise((res, rej) => {
        const payload = { id, iat, kid: keyPair.fingerprint, ver: CurrentTokenFormatVersion, did: session_id, intents } as UserTokenData["decoded"];
        jwt.sign(
            payload,
            keyPair.privateKey,
            {
                algorithm: "ES512",
            },
            (err, token) => {
                if (err) return rej(err);
                return res(token);
            },
        );
    });
}
