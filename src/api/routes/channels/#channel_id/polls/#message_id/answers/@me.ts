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

import { Message, Channel, emitEvent } from "#harmony/util";
import { route } from "#harmony/api";
import { PollPutSchema } from "#harmony/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "#lambert-server";
const router = Router({ mergeParams: true });

router.put(
    "/",
    route({
        requestBody: "PollPutSchema",
        permission: "VIEW_CHANNEL",
    }),
    async (req: Request, res: Response) => {
        const body = req.body as PollPutSchema;
        const { message_id, channel_id } = req.params as { [key: string]: string };
        const message = await Message.findOneOrFail({ where: { id: message_id } });
        if (!message.poll) throw new HTTPError("Message does not have poll");

        if (!message.poll.allow_multiselect && body.answer_ids.length > 1) throw new HTTPError("Only one answer is allowed");
        const ans = new Set(message.poll.answers.map((_) => _.answer_id));
        if (body.answer_ids.find((_) => !ans.has(_)) !== undefined) throw new HTTPError("Must be valid IDs");
        const newAn = new Set(body.answer_ids);
        if (!message.poll.results) message.poll.results = { is_finalized: false, answer_counts: [] };
        if (message.poll.results.is_finalized) throw new HTTPError("Poll is finalized, can't change votes");
        const oldAn = new Set(message.poll.results.answer_counts.filter((_) => _.user_ids.includes(req.user_id)).map((_) => _.id));

        await Promise.all([
            ...[...newAn.difference(oldAn)].map((answer_id) => {
                let f = message.poll!.results!.answer_counts.find((_) => _.id === answer_id);
                if (!f) {
                    f = {
                        id: answer_id,
                        count: 0,
                        user_ids: [],
                    };
                    console.log(f);
                    message.poll!.results!.answer_counts.push(f);
                }
                f.count++;
                f.user_ids.push(req.user_id);
                return emitEvent({
                    event: "MESSAGE_POLL_VOTE_ADD",
                    data: {
                        user_id: req.user_id,
                        channel_id,
                        message_id,
                        guild_id: message.guild_id,
                        answer_id,
                    },
                    channel_id,
                });
            }),
            ...[...oldAn.difference(newAn)].map((answer_id) => {
                const f = message.poll!.results!.answer_counts.find((_) => _.id === answer_id)!;
                f.count--;
                f.user_ids = f.user_ids.filter((id) => id !== req.user_id);
                return emitEvent({
                    event: "MESSAGE_POLL_VOTE_REMOVE",
                    data: {
                        user_id: req.user_id,
                        channel_id,
                        message_id,
                        guild_id: message.guild_id,
                        answer_id,
                    },
                    channel_id,
                });
            }),
            message.save(),
        ]);

        res.send(message.toJSON());
    },
);

export default router;
