import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import { ThreadMember, Channel, ChannelType, DiscordApiErrors } from "@spacebar/util";

const router = Router({ mergeParams: true });

router.get(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: { 200: { body: "Object" } },
	}),
	async (req: Request, res: Response) => {
		const { channel_id } = req.params as { channel_id: string };

		const channel = await Channel.findOneOrFail({
			where: { id: channel_id },
			select: ["id", "type", "guild_id"],
		});

		if (![ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD, ChannelType.GUILD_NEWS_THREAD].includes(channel.type)) {
			throw DiscordApiErrors.INVALID_CHANNEL_TYPE;
		}

		const members = await ThreadMember.find({
			where: { thread_id: channel_id },
			relations: ["user"],
			select: {
				user_id: true,
				created_at: true,
				flags: true,
				user: { id: true, username: true, avatar: true, discriminator: true }
			}
		});

		res.json(members.map(m => ({
			id: m.user_id,
			user_id: m.user_id,
			join_timestamp: m.created_at,
			flags: m.flags
		})));
	},
);

export default router;
