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

import { Message, RunningPolls } from "@harmony/util";
import { route } from "@harmony/api";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
const router = Router({ mergeParams: true });

router.post("/", route({}), async (req: Request, res: Response) => {
    const { message_id, channel_id } = req.params as { [key: string]: string };
    const poll = await RunningPolls.findOneOrFail({
        where: {
            id: message_id,
        },
        relations: {
            message: Message.stdRelations,
        },
    });
    if (poll.message.author_id !== req.user_id) throw new HTTPError("You did not create this poll");
    if (poll.message.channel_id !== channel_id) throw new HTTPError("Message not found");
    await poll.endPoll();
    await poll.remove();

    res.send(poll.message.toUserSafeJSON(req.user_id));
});

export default router;
