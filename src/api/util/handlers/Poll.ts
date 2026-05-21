import { handleMessage, sendMessage } from "./Message";
import { Embed, EmbedType, MessageType, PollAnswer } from "@harmony/schemas";
import { Message, RunningPolls } from "@harmony/util";
import { LessThan } from "typeorm";
// Run once a minute
// Checks for expired polls once a minute to expire them and send their results message
export const startPollReap = () => {
    setInterval(async () => {
        const polls = await RunningPolls.find({
            where: {
                closes: LessThan(new Date()),
            },
            relations: {
                message: true,
            },
        });
        await Promise.all(
            polls.map(async (poll) => {
                const m = poll.message;
                if (!m.poll) return;
                const counts = m.poll?.results?.answer_counts;
                let winner: undefined | number = undefined;
                let total = 0;
                let highest = 0;
                let winnerObj: PollAnswer | undefined;
                if (counts) {
                    for (const e of counts) {
                        total += e.count;
                        if (e.count > highest) {
                            winner = e.id;
                            highest = e.count;
                        } else if (e.count === highest) winner = undefined;
                    }
                    if (winner) {
                        winnerObj = m.poll.answers.find(({ answer_id }) => winner === answer_id);
                    }
                }
                const embed = {
                    type: EmbedType.poll_result,
                    fields: [
                        {
                            name: "poll_question_text",
                            value: m.poll.question.text,
                            inline: false,
                        },
                        {
                            name: "total_votes",
                            value: total + "",
                            inline: false,
                        },
                        ...(winnerObj
                            ? [
                                  {
                                      name: "victor_answer_votes",
                                      value: highest + "",
                                      inline: false,
                                  },

                                  {
                                      name: "victor_answer_id",
                                      value: winnerObj.answer_id + "",
                                      inline: false,
                                  },
                                  {
                                      name: "victor_answer_text",
                                      value: winnerObj.poll_media.text,
                                      inline: false,
                                  },
                              ]
                            : []),
                    ],
                } satisfies Embed;
                if (m.poll.results) m.poll.results.is_finalized = true;
                else m.poll.results = { is_finalized: true, answer_counts: [] };
                await Promise.all([
                    sendMessage({
                        channel_id: m.channel_id,
                        author_id: m.author_id,
                        type: MessageType.POLL_RESULT,
                        message_reference: { message_id: m.id, channel_id: m.channel_id },
                        embeds: [embed],
                    }),
                    m.save(),
                ]);
            }),
        );

        await RunningPolls.remove(polls);
    }, 1000 * 60);
};
