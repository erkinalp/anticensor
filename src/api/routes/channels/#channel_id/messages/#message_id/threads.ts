import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";
import { 
	resolveLimit, 
	getGuildLimits,
	Channel, 
	Message, 
	ChannelType, 
	getPermission, 
	Snowflake,
	DiscordApiErrors,
	ThreadMember
} from "@spacebar/util";

const router = Router({ mergeParams: true });

router.post(
	"/",
	route({
		permission: "CREATE_PUBLIC_THREADS",
		body: "ThreadCreateSchema",
		responses: { 201: { body: "Channel" } },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, message_id } = req.params as {
			channel_id: string;
			message_id: string;
		};

		const message = await Message.findOneOrFail({
			where: { id: message_id, channel_id },
		});

		const existingThread = await Channel.findOne({
			where: { parent_id: channel_id, last_message_id: message_id }
		});

		if (existingThread) {
			throw DiscordApiErrors.THREAD_ALREADY_CREATED_FOR_THIS_MESSAGE;
		}

		const { name, auto_archive_duration } = req.body as {
			name: string;
			auto_archive_duration?: number;
		};

		const thread = await Channel.create({
			id: Snowflake.generate(),
			type: ChannelType.GUILD_PUBLIC_THREAD,
			name: name || `Thread from ${message.author?.username || 'Unknown'}`,
			parent_id: channel_id,
			guild_id: message.guild_id,
			owner_id: req.user_id,
			last_message_id: message_id,
			default_auto_archive_duration: auto_archive_duration || 1440,
			created_at: new Date(),
		}).save();

		await ThreadMember.create({
			thread_id: thread.id,
			user_id: req.user_id!,
			created_at: new Date(),
			flags: 0
		}).save();

		res.status(201).json(thread);
	},
);

router.get(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: { 200: { body: "Object" } },
		query: {
			before: { type: "string", required: false },
			after: { type: "string", required: false },
			limit: { type: "number", required: false },
		},
	}),
	async (req: Request, res: Response) => {
		const { channel_id, message_id } = req.params as {
			channel_id: string;
			message_id: string;
		};
		const qLimit = (req.query as { limit?: number }).limit;
		const guildId = (req as Request & { guild_id?: string }).guild_id;
		const limits = getGuildLimits(guildId).threads;
		const limit = resolveLimit(
			qLimit,
			limits.maxThreadPageSize,
			limits.defaultThreadPageSize,
			limits.maxThreadPageSize,
		);

		const threads = await Channel.find({
			where: { parent_id: channel_id, last_message_id: message_id },
			select: ["id", "name", "type", "created_at", "default_auto_archive_duration", "last_message_id"],
			take: limit
		});

		const threadsWithRemaining = threads.map((thread) => {
			const lastActivityAt = thread.last_message_id ? new Date() : thread.created_at;
			const inactivityMs = Date.now() - lastActivityAt.getTime();
			const durationMs = (thread.default_auto_archive_duration || 1440) * 60 * 1000;
			const remainingAutoArchive = Math.max(0, durationMs - inactivityMs);

			return {
				...thread,
				remainingAutoArchive: Math.floor(remainingAutoArchive / 1000)
			};
		});

		res.status(200).json({ 
			threads: threadsWithRemaining, 
			has_more: threads.length >= limit 
		});
	},
);

export default router;
