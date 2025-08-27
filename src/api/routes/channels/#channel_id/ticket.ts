import { route } from "@spacebar/api";
import {
	Channel,
	ChannelType,
	ChannelUpdateEvent,
	emitEvent,
	getPermission,
	TicketFlags,
	DiscordApiErrors,
} from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router();

router.patch(
	"/ticket",
	route({
		requestBody: "TicketPatchSchema",
		responses: { 200: { body: "Channel" }, 400: {}, 403: {}, 404: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params;
		const payload = req.body as {
			owner_id?: string | null;
			resolved?: boolean | null;
			public?: boolean | null;
			closed?: boolean | null;
		};

		const ticket = await Channel.findOneOrFail({
			where: { id: channel_id },
		});
		if (!ticket.parent_id)
			return res.status(400).send({ message: "Not a thread" });
		if (
			ticket.type !== ChannelType.GUILD_PRIVATE_THREAD &&
			ticket.type !== ChannelType.GUILD_PUBLIC_THREAD
		)
			return res.status(400).send({ message: "Not a ticket thread" });

		const parent = await Channel.findOneOrFail({
			where: { id: ticket.parent_id },
		});
		if (parent.type !== ChannelType.TICKET_TRACKER)
			return res.status(400).send({ message: "Parent is not a tracker" });

		const perm = await getPermission(
			req.user_id,
			ticket.guild_id,
			ticket.id,
		);

		const isClosed =
			(ticket.flags & TicketFlags.ARCHIVED) === TicketFlags.ARCHIVED;

		if (payload.owner_id !== undefined) {
			if (!perm.has("MANAGE_TICKETS"))
				return res
					.status(403)
					.send({ message: "Missing MANAGE_TICKETS" });
			if (isClosed && !perm.has("MANAGE_TICKETS"))
				return res.status(403).send({
					message:
						DiscordApiErrors.CANNOT_EDIT_ARCHIVED_THREAD.message,
				});
			ticket.owner_id = payload.owner_id || undefined;
		}

		if (payload.resolved !== undefined) {
			const canResolve =
				perm.has("MANAGE_TICKETS") || ticket.owner_id === req.user_id;
			if (!canResolve)
				return res
					.status(403)
					.send({ message: "Missing permission to resolve" });
			if (payload.resolved)
				ticket.flags = (ticket.flags || 0) | TicketFlags.RESOLVED;
			else ticket.flags = (ticket.flags || 0) & ~TicketFlags.RESOLVED;
		}

		if (payload.public !== undefined) {
			if (!perm.has("MANAGE_TICKETS"))
				return res
					.status(403)
					.send({ message: "Missing MANAGE_TICKETS" });
			if (isClosed && !perm.has("MANAGE_TICKETS"))
				return res.status(403).send({
					message:
						DiscordApiErrors.CANNOT_EDIT_ARCHIVED_THREAD.message,
				});
			if (payload.public) {
				if (ticket.type === ChannelType.GUILD_PRIVATE_THREAD)
					ticket.type = ChannelType.GUILD_PUBLIC_THREAD;
			} else {
				if (ticket.type === ChannelType.GUILD_PUBLIC_THREAD)
					ticket.type = ChannelType.GUILD_PRIVATE_THREAD;
			}
		}

		if (payload.closed !== undefined) {
			if (!perm.has("MANAGE_TICKETS"))
				return res
					.status(403)
					.send({ message: "Missing MANAGE_TICKETS" });
			if (payload.closed)
				ticket.flags = (ticket.flags || 0) | TicketFlags.ARCHIVED;
			else ticket.flags = (ticket.flags || 0) & ~TicketFlags.ARCHIVED;
		}

		await Promise.all([
			ticket.save(),
			emitEvent({
				event: "CHANNEL_UPDATE",
				data: ticket,
				channel_id: ticket.id,
			} as ChannelUpdateEvent),
		]);

		return res.send(ticket);
	},
);

export default router;
