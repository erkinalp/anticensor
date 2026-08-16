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

import { BulkDeleteSchema } from "#harmony/schemas";
import { route } from "#harmony/api";
import { Channel, Config, emitEvent, getPermission, getRights, Message, MessageDeleteBulkEvent } from "#harmony/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "#lambert-server";
import { In, Not } from "typeorm";

const router: Router = Router({ mergeParams: true });

export default router;

// should users be able to bulk delete messages or only bots? ANSWER: all users
// should this request fail, if you provide messages older than 14 days/invalid ids? ANSWER: NO
// https://discord.com/developers/docs/resources/channel#bulk-delete-messages
router.post(
    "/",
    route({
        requestBody: "BulkDeleteSchema",
        right: "SELF_DELETE_MESSAGES",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            403: {},
            404: {},
        },
        permission: null,
    }),
    async (req: Request, res: Response) => {
        const { channel_id } = req.params as { [key: string]: string };
        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });
        if (!channel.guild_id) throw new HTTPError("Can't bulk delete dm channel messages", 400);

        const rights = req.rights ?? (await getRights(req.user_id));

        const permission = await getPermission(req.user_id, channel?.guild_id, channel_id);

        const { maxBulkDelete } = Config.get().limits.message;

        const { messages } = req.body as BulkDeleteSchema;
        if (messages.length === 0) throw new HTTPError("You must specify messages to bulk delete");

        if (!rights.has("MANAGE_MESSAGES")) {
            permission.hasThrow("MANAGE_MESSAGES");
            if (messages.length > maxBulkDelete) throw new HTTPError(`You cannot delete more than ${maxBulkDelete} messages`);
        }
        if (
            await Message.exists({
                where: {
                    id: In(messages),
                    channel_id: Not(channel_id),
                },
            })
        ) {
            throw new HTTPError("Messages not found");
        }

        await Message.delete({
            id: In(messages),
            channel_id,
        });

        await emitEvent({
            event: "MESSAGE_DELETE_BULK",
            channel_id,
            data: { ids: messages, channel_id, guild_id: channel.guild_id },
        } satisfies MessageDeleteBulkEvent);

        res.sendStatus(204);
    },
);
