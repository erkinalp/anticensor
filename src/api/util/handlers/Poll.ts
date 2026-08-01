import { handleMessage, sendMessage } from "./Message.js";
import { Embed, EmbedType, MessageType, PollAnswer } from "#harmony/schemas";
import { Message, RunningPolls } from "#harmony/util";
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
                await poll.endPoll();
            }),
        );

        await RunningPolls.remove(polls);
    }, 1000 * 60);
};
