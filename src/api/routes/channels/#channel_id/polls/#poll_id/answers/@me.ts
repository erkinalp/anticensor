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

import { Request, Response, Router } from "express";
import { route } from "@spacebar/api/middlewares";
import { PollAnswerCount, PollUserAnswersSchema } from "@spacebar/schemas";
import { getDatabase, Message } from "@spacebar/database";
import { DiscordApiErrors, emitEvent, ErrorList, FieldError, makeObjectErrorContent, MessagePollVoteAddEvent, MessagePollVoteRemoveEvent } from "@spacebar/util";

const router: Router = Router({ mergeParams: true });

router.put("/", route({ requestBody: "PollUserAnswersSchema", permission: "VIEW_CHANNEL" }), async (req: Request, res: Response) => {
    const payload = req.body as PollUserAnswersSchema;
    const { poll_id } = req.params as { [key: string]: string };

    // The vote update is a read-modify-write on the message row: pessimistic_write
    // locks it for the whole transaction so concurrent votes don't overwrite
    // each other's voters arrays.
    await getDatabase()!.transaction(async (em) => {
        const message = await em.findOne(Message, { where: { id: poll_id }, lock: { mode: "pessimistic_write" } });

        if (!message || !message.poll || !message.poll.results) {
            throw DiscordApiErrors.UNKNOWN_MESSAGE;
        }

        if (new Date() > new Date(message.poll.expiry)) {
            throw DiscordApiErrors.POLL_EXPIRED;
        }

        if (!message.poll.allow_multiselect && payload.answer_ids.length > 1) {
            const errors: ErrorList = {};
            errors["answer_ids"] = makeObjectErrorContent("CANNOT_ADD_MULTIPLE_POLL_ANSWERS", "Multiple votes are not allowed for this poll.");
            throw new FieldError(50035, "Invalid form body", errors);
        }

        // Answer ids that aren't in poll.answers would create phantom
        // answer_counts entries (then crash result generation on the missing
        // poll_media); drop them.
        const validAnswerIds = new Set((message.poll.answers ?? []).map((a) => String(a.answer_id)));
        const answer_ids = payload.answer_ids.filter((id) => validAnswerIds.has(id));

        const channel_id = message.channel_id!;
        const guild_id = message.guild_id;

        const allAnswerCounts = message.poll.results.answer_counts as unknown as (Omit<PollAnswerCount, "me_voted"> & { voters: string[] })[];

        for (const answer_id of answer_ids) {
            let answerCount = allAnswerCounts.find((a) => a.id === answer_id);

            if (!answerCount) {
                allAnswerCounts.push({ id: answer_id, count: 0, voters: [] });
                answerCount = allAnswerCounts.find((a) => a.id === answer_id)!;
            }

            if (!answerCount.voters.includes(req.user_id)) {
                answerCount.voters.push(req.user_id);
                answerCount.count = answerCount.voters.length;

                await emitEvent({
                    event: "MESSAGE_POLL_VOTE_ADD",
                    channel_id,
                    data: {
                        answer_id: Number(answerCount.id),
                        channel_id: channel_id,
                        message_id: poll_id,
                        user_id: req.user_id,
                        guild_id,
                    },
                } satisfies MessagePollVoteAddEvent);
            }
        }

        for (const answerCount of allAnswerCounts.filter((a) => !answer_ids.includes(a.id) && a.voters.includes(req.user_id))) {
            answerCount.voters = answerCount.voters.filter((voter) => voter != req.user_id);
            answerCount.count = answerCount.voters.length;

            await emitEvent({
                event: "MESSAGE_POLL_VOTE_REMOVE",
                channel_id,
                data: {
                    answer_id: Number(answerCount.id),
                    channel_id,
                    message_id: poll_id,
                    user_id: req.user_id,
                    guild_id,
                },
            } satisfies MessagePollVoteRemoveEvent);
        }

        await em.save(message);
    });
    res.send();
});

export default router;
