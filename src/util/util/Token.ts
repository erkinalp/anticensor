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

import jwt from "jsonwebtoken";
import { Config } from "./Config";
import { InstanceBan, Session, User } from "../entities";
// TODO: dont use deprecated APIs lol
import { FindOptionsRelationByString, FindOptionsRelations, FindOptionsSelect, FindOptionsSelectByString } from "typeorm";
import { randomUpperString } from "@harmony/api";
import { TimeSpan } from "./Timespan";
import { HTTPError } from "lambert-server";
import { unsafeMakeToken, loadOrGenerateKeypair } from "./unsafeMakeToken";

/// Change history:
/// 1 - Initial version with HS256
/// 2 - Switched to ES512
/// 3 - Add version, device id to token payload

export type UserTokenData = {
    user?: User;
    session?: Session;
    internal?: boolean;
    tokenVersion: number;
    decoded: {
        id: string;
        iat: number;
        // token format version
        ver?: number;
        // device id
        did?: string;
    };
};

function logAuth(text: string) {
    if (process.env.LOG_AUTH !== "true") return;
    console.log(`[AUTH] ${text}`);
}

function rejectAndLog(rejectFunction: (reason?: unknown) => void, httpCode: number | undefined, reason: string) {
    console.error(reason);
    rejectFunction(new HTTPError(reason, httpCode ?? 400));
}
type userFull = Omit<UserTokenData, "user" | "internal"> & { user: User };
export const checkToken = async (
    token: string,
    opts?: {
        select?: FindOptionsSelect<User>;
        relations?: FindOptionsRelations<User>;
        ipAddress?: string;
        fingerprint?: string;
    },
): Promise<userFull> => {
    const ret = await checkTokenInt(token, opts);
    if (!ret.user) throw new HTTPError("Internal token not allowed");
    return ret as userFull;
};
export const checkTokenInt = (
    token: string,
    opts?: {
        select?: FindOptionsSelect<User>;
        relations?: FindOptionsRelations<User>;
        ipAddress?: string;
        fingerprint?: string;
    },
): Promise<UserTokenData> => {
    return new Promise((resolve, reject) => {
        token = token.replace("Bot ", ""); // there is no bot distinction in sb
        token = token.replace("Bearer ", ""); // allow bearer tokens

        let legacyVersion: number | undefined = undefined;
        const dec = jwt.decode(token, { complete: true });

        const validateUser: jwt.VerifyCallback = async (err, out) => {
            const decoded = out as UserTokenData["decoded"];
            if (decoded.id.startsWith("Internal")) {
                resolve({
                    decoded,
                    tokenVersion: decoded.ver ?? legacyVersion ?? 2,
                    internal: true,
                });
                return;
            }
            if (err || !decoded) {
                logAuth("validateUser rejected: " + err);
                return rejectAndLog(reject, 401, "Invalid Token meow " + err);
            }

            // eslint-disable-next-line prefer-const
            let [user, session] = await Promise.all([
                User.findOne({
                    where: { id: decoded.id },
                    select: { ...(opts?.select || {}), id: true, bot: true, disabled: true, deleted: true, rights: true, data: true },
                    relations: opts?.relations,
                }),
                decoded.did ? Session.findOne({ where: { session_id: decoded.did, user_id: decoded.id } }) : undefined,
            ]);

            if (!user) {
                logAuth("validateUser rejected: User not found");
                return rejectAndLog(reject, 401, "User not found");
            }

            if (decoded.did && !session) {
                // temporary hack: create new session
                session = Session.create({
                    session_id: decoded.did,
                    user_id: user.id,
                    is_admin_session: false,
                    client_status: {},
                    status: "online",
                    client_info: {},
                });
                await session.save();
                logAuth("validateUser rejected: Session not found");
                return rejectAndLog(reject, 401, "Invalid Token");
            }

            // we need to round it to seconds as it saved as seconds in jwt iat and valid_tokens_since is stored in milliseconds
            if (decoded.iat * 1000 < new Date(user.data.valid_tokens_since).setSeconds(0, 0)) {
                logAuth("validateUser rejected: Token not yet valid");
                return rejectAndLog(reject, 401, "Invalid Token");
            }

            if (user.disabled) {
                logAuth("validateUser rejected: User disabled");
                return rejectAndLog(reject, 401, "User disabled");
            }

            if (user.deleted) {
                logAuth("validateUser rejected: User deleted");
                return rejectAndLog(reject, 401, "User not found");
            }

            const banReasons = await InstanceBan.findInstanceBans({ userId: user.id, ipAddress: opts?.ipAddress, fingerprint: opts?.fingerprint, propagateBan: true });
            if (banReasons.length > 0) {
                logAuth("validateUser rejected: User banned for reasons: " + banReasons.join(", "));
                return rejectAndLog(reject, 418, "Invalid Token");
            }

            if (session && TimeSpan.fromDates(session.last_seen?.getTime() ?? 0, new Date().getTime()).totalSeconds >= 15) {
                session.last_seen = new Date();
                let updateIpInfoPromise;
                if (opts?.ipAddress && opts?.ipAddress !== session.last_seen_ip) {
                    session.last_seen_ip = opts.ipAddress;
                    updateIpInfoPromise = session.updateIpInfo();
                }
                await Promise.all([session.save(), updateIpInfoPromise]);
            }

            const result: UserTokenData = {
                decoded,
                session: session ?? undefined,
                user,
                // v1 can be told apart, v2 cant outside of missing device id and version
                tokenVersion: decoded.ver ?? legacyVersion ?? 2,
            };

            if (process.env.LOG_TOKEN_VERSION) console.log("User", user.id, "logged in with token version", result.tokenVersion);

            logAuth("validateUser success: " + JSON.stringify(result));
            return resolve(result);
        };

        if (!dec) return rejectAndLog(reject, 500, "Failed to decode token");
        logAuth("Decoded token: " + JSON.stringify(dec));

        if (dec.header.alg == "HS256" && Config.get().security.jwtSecret !== null) {
            legacyVersion = 1;
            jwt.verify(token, Config.get().security.jwtSecret!, { algorithms: ["HS256"] }, validateUser);
        } else if (dec.header.alg == "ES512") {
            loadOrGenerateKeypair().then((keyPair) => {
                jwt.verify(token, keyPair.publicKey, { algorithms: ["ES512"] }, validateUser);
            });
        } else return rejectAndLog(reject, 400, "Unsupported token algorithm: " + dec.header.alg);
    });
};

export async function generateToken(id: string, isAdminSession: boolean = false): Promise<string | undefined> {
    let newSession: Session;

    do {
        newSession = Session.create({
            session_id: randomUpperString(10), // readable at a glance
            user_id: id,
            is_admin_session: isAdminSession,
            client_status: {},
            status: "online",
            client_info: {},
        });
    } while (await Session.findOne({ where: { session_id: newSession.session_id } }));

    await newSession.save();

    return unsafeMakeToken(id, newSession.session_id);
}
