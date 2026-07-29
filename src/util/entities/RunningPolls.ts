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

import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseClass } from "./BaseClass";
import { Message } from "./Message";
import { sendMessage } from "@harmony/api";
import { Embed, EmbedType, MessageType, PollAnswer } from "@harmony/schemas";
import { emitEvent } from "@harmony/util";

@Entity({
    name: "running_polls",
})
export class RunningPolls extends BaseClass {
    @JoinColumn({ name: "message_id" })
    @ManyToOne(() => Message, { onDelete: "CASCADE" })
    message: Message;

    @Column()
    closes: Date;
    async endPoll() {
        const m = this.message;
        if (!m.poll || m.poll.results?.is_finalized) return;
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
            emitEvent({
                channel_id: this.message.channel_id,
                data: this.message.toJSON(),
                event: "MESSAGE_UPDATE",
            }),
        ]);
    }
}
