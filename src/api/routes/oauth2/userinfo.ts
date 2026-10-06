/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors
	
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

import { Router, Request, Response } from "express";
import { route } from "@spacebar/api/middlewares";
import { Config } from "@spacebar/util";
import { OAuth2UserInfoResponse } from "@spacebar/schemas/api/oauth2/OAuth2UserInfo";
const router = Router({ mergeParams: true });

router.get(
    "/",
    route({
        description: "Get standard OAuth2 user info",
        responses: {
            200: {
                body: "OAuth2UserInfoResponse",
            },
        },
        // TODO: scopes: openid
    }),
    (req: Request, res: Response) => {
        // Tokens minted without a scopes claim are first-party session tokens and get
        // every claim; scoped tokens (OAuth grants, reset tokens) only get the claims
        // their scopes entitle.
        const scopes = req.token.scopes;
        const hasScope = (scope: string) => !scopes || scopes.includes(scope);

        res.json({
            sub: req.user_id,
            ...(hasScope("email") && {
                email: req.user.email ?? null,
                email_verified: req.user.verified,
            }),
            ...(hasScope("identify") && {
                preferred_username: req.user.username,
                nickname: req.user.username, // TODO: pomelo
                picture: `${Config.get().cdn.endpointPublic}/avatars/${req.user.id}/${req.user.avatar}.png`,
                locale: req.user.settings?.locale ?? "en-US",
            }),
        } satisfies OAuth2UserInfoResponse);
    },
);

export default router;
