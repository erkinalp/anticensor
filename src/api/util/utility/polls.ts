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

import { sendMessage } from "@spacebar/api";
import { EmbedType, MessageReferenceType, MessageType, PollAnswerCount } from "@spacebar/schemas";
import { emitEvent, MessageUpdateEvent, pendingPolls } from "@spacebar/util";
import { Message } from "@spacebar/database";
import { MessageOptions } from "@spacebar/util/dtos/MessageOptions";

export async function generatePollResultsMessage(options: MessageOptions): Promise<MessageOptions | null> {
    // TODO: shouldnt this get saved?
    const message = Message.create({
        ...options,
        message_reference: options.message_reference ?? undefined,
        poll: options.poll,
        // sticker_items: stickers,
        // guild_id: options.guild_id,
        channel_id: options.channel_id,
        attachments: [],
        embeds: options.embeds || [],
        reactions: [],
        type: MessageType.POLL_RESULT,
        mentions: [],
        components: [],
    });

    if (!message.poll?.results) {
        return null;
    }

    const allAnswerCounts = message.poll.results.answer_counts as unknown as (Omit<PollAnswerCount, "me_voted"> & { voters: string[] })[];

    const totalVotes = allAnswerCounts.reduce((n, a) => n + (a.voters?.length ?? a.count ?? 0), 0);
    const maxVotes = Math.max(0, ...allAnswerCounts.map((a) => a.count ?? 0));
    const winningAnswerCounts = allAnswerCounts.filter((a) => a.count > 0 && a.count === maxVotes);

    const pollResultsMessage = {
        type: MessageType.POLL_RESULT,
        channel_id: message.channel_id,
        author_id: message.author_id,
        message_reference: {
            type: MessageReferenceType.DEFAULT,
            message_id: message.id,
            channel_id: message.channel_id,
        },
        embeds: [
            {
                type: EmbedType.poll_result,
                id: message.id,
                fields: [
                    {
                        name: "poll_question_text",
                        value: message.poll.question.text!,
                    },
                    {
                        name: "total_votes",
                        value: totalVotes.toString(),
                    },
                ],
            },
        ],
    };

    if (winningAnswerCounts) {
        const winningAnswer = message.poll.answers.find((a) => a.answer_id === Number(winningAnswerCounts[0]?.id))!;

        if (winningAnswerCounts.length === 0) {
            pollResultsMessage.embeds[0].fields.push({
                name: "victor_answer_votes",
                value: "0",
            });
        } else if (winningAnswerCounts.length === 1) {
            pollResultsMessage.embeds[0].fields.push(
                {
                    name: "victor_answer_votes",
                    value: winningAnswerCounts[0].count.toString(),
                },
                {
                    name: "victor_answer_id",
                    value: winningAnswerCounts[0].id,
                },
                {
                    name: "victor_answer_text",
                    value: winningAnswer.poll_media.text!,
                },
            );
        } else if (winningAnswerCounts.length > 1) {
            pollResultsMessage.embeds[0].fields.push({
                name: "victor_answer_votes",
                value: winningAnswerCounts[0].count.toString(),
            });
        }

        if (winningAnswer?.poll_media.emoji) {
            pollResultsMessage.embeds[0].fields.push(
                {
                    name: "victor_answer_emoji_id",
                    value: winningAnswer.poll_media.emoji.id!.toString()!,
                },
                {
                    name: "victor_answer_emoji_name",
                    value: winningAnswer.poll_media.emoji.name!,
                },
                {
                    name: "victor_answer_emoji_animated",
                    value: `${winningAnswer.poll_media.emoji.animated}`,
                },
            );
        }
    }

    return pollResultsMessage;
}

// setTimeout clamps delays > 2^31-1 ms (~596h) to ~1ms; Discord allows poll
// durations up to 768h, so long polls must re-arm chained timeouts.
const MAX_TIMEOUT_DELAY = 2_147_483_647;

export async function addPendingPoll(message: Message, timeoutTime: number) {
    const expiry = Date.now() + timeoutTime;
    const arm = () => {
        pendingPolls.set(message.id, {
            timeout: setTimeout(
                async () => {
                    const remaining = expiry - Date.now();
                    if (remaining > 0) return arm();

                    // Re-fetch: the armed-time entity snapshot is stale — votes written
                    // since via fresh instances would be invisible to the results.
                    const fresh = await Message.findOne({ where: { id: message.id } });
                    if (!fresh?.poll) {
                        pendingPolls.delete(message.id);
                        return;
                    }

                    if (fresh.poll.results) fresh.poll.results.is_finalized = true;
                    await fresh.save();
                    await emitEvent({
                        channel_id: fresh.channel_id!,
                        data: fresh.toJSON(),
                        event: "MESSAGE_UPDATE",
                    } satisfies MessageUpdateEvent);

                    const pollResultsMessage = await generatePollResultsMessage(fresh);
                    if (pollResultsMessage) await sendMessage(pollResultsMessage);
                    pendingPolls.delete(message.id);
                },
                Math.min(timeoutTime, MAX_TIMEOUT_DELAY),
            ),
        });
    };
    arm();
}
