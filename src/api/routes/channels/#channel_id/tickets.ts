/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
*/
import { route } from "@spacebar/api";
import {
	Channel,
	ChannelCreateEvent,
	ChannelType,
	emitEvent,
	Snowflake,
	getPermission,
} from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router();

router.post(
	"/tickets",
	route({
		requestBody: "TicketCreateSchema",
		responses: { 200: { body: "Channel" }, 400: {}, 403: {}, 404: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params;

		const tracker = await Channel.findOneOrFail({
			where: { id: channel_id },
		});

		if (tracker.type !== ChannelType.TICKET_TRACKER)
			return res
				.status(400)
				.send({ message: "Channel is not a ticket tracker" });

		const perm = await getPermission(
			req.user_id,
			tracker.guild_id,
			tracker.id,
		);
		if (!perm.has("SEND_MESSAGES"))
			return res
				.status(403)
				.send({ message: "Missing SEND_MESSAGES in tracker" });

		const name =
			(req.body?.name as string | undefined)?.trim() ||
			`ticket-${Snowflake.generate()}`;

		const ticket = await Channel.createChannel(
			{
				id: Snowflake.generate(),
				name,
				type: ChannelType.GUILD_PRIVATE_THREAD,
				parent_id: tracker.id,
				guild_id: tracker.guild_id!,
				owner_id: req.user_id,
				nsfw: false,
				position: 0,
				topic: `ticket:initiator:${req.user_id}`,
			},
			req.user_id,
			{ skipNameChecks: false },
		);

		if (ticket.guild_id) {
			await emitEvent({
				event: "CHANNEL_CREATE",
				data: ticket,
				guild_id: ticket.guild_id,
			} as ChannelCreateEvent);
		}

		return res.send(ticket);
	},
);

export default router;
