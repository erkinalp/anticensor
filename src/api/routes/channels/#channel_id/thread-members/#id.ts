import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import { 
	ThreadMember, 
	Channel, 
	ChannelType, 
	getPermission, 
	getGuildLimits, 
	resolveLimit,
	emitEvent,
	DiscordApiErrors 
} from "@spacebar/util";

const router = Router({ mergeParams: true });

router.put(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, id } = req.params as {
			channel_id: string;
			id: string;
		};
		const user_id = id === "@me" ? req.user_id! : id;

		const channel = await Channel.findOneOrFail({
			where: { id: channel_id },
			select: ["id", "type", "guild_id", "parent_id"],
		});

		if (![ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD, ChannelType.GUILD_NEWS_THREAD].includes(channel.type)) {
			throw DiscordApiErrors.INVALID_CHANNEL_TYPE;
		}

		const permissions = await getPermission(req.user_id!, channel.guild_id, channel_id);
		if (channel.type === ChannelType.GUILD_PRIVATE_THREAD) {
			permissions.hasThrow("MANAGE_THREADS");
			
			const guildId = (req as Request & { guild_id?: string }).guild_id;
			const limits = getGuildLimits(guildId).threads;
			const memberCap = resolveLimit(null, limits.privateThreadMaxMembers, null, limits.privateThreadMaxMembers);
			
			if (memberCap !== null) {
				const currentMembers = await ThreadMember.count({
					where: { thread_id: channel_id }
				});
				if (currentMembers >= memberCap) {
					throw DiscordApiErrors.MAXIMUM_NUMBER_OF_THREAD_MEMBERS_REACHED;
				}
			}
		}

		let threadMember = await ThreadMember.findOne({
			where: { thread_id: channel_id, user_id }
		});

		if (!threadMember) {
			threadMember = ThreadMember.create({
				thread_id: channel_id,
				user_id,
				created_at: new Date(),
				flags: 0
			});
			await threadMember.save();
		}

		await emitEvent({
			event: "THREAD_MEMBERS_UPDATE",
			channel_id,
			guild_id: channel.guild_id,
			data: {
				id: channel_id,
				guild_id: channel.guild_id,
				member_count: await ThreadMember.count({ where: { thread_id: channel_id } }),
				added_members: [{ id: user_id, user_id, thread_id: channel_id, join_timestamp: threadMember.created_at }]
			}
		});

		res.sendStatus(204);
	},
);

router.delete(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, id } = req.params as {
			channel_id: string;
			id: string;
		};
		const user_id = id === "@me" ? req.user_id! : id;

		await ThreadMember.delete({ thread_id: channel_id, user_id });

		const channel = await Channel.findOne({
			where: { id: channel_id },
			select: ["guild_id"]
		});

		await emitEvent({
			event: "THREAD_MEMBERS_UPDATE",
			channel_id,
			guild_id: channel?.guild_id,
			data: {
				id: channel_id,
				guild_id: channel?.guild_id,
				member_count: await ThreadMember.count({ where: { thread_id: channel_id } }),
				removed_member_ids: [user_id]
			}
		});

		res.sendStatus(204);
	},
);

export default router;
