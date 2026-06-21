import { Request, Response, Router } from "express";
import { handleMessage, postHandleMessage, route } from "@harmony/api";
import { MessageEditSchema,} from "@harmony/schemas";
import {
    DiscordApiErrors,
    Message,
    MessageUpdateEvent,
    Webhook,
    emitEvent,
    getPermission,
    getRights,
} from "@harmony/util";
const router = Router({ mergeParams: true });
console.log("file *was* ran")
router.patch(
    "/",
    route({
        requestBody: "MessageEditSchema"
    }),
    async (req: Request, res: Response) => {
		const { webhook_id, token,message_id } = req.params as { [key: string]: string };

		const webhook = await Webhook.findOne({
			where: {
				id: webhook_id,
			},
			relations: { channel: true, guild: true, application: true },
		});

		if (!webhook) {
			throw DiscordApiErrors.UNKNOWN_WEBHOOK;
		}

		if (webhook.token !== token) {
			throw DiscordApiErrors.INVALID_WEBHOOK_TOKEN_PROVIDED;
		}
        const body = req.body as MessageEditSchema;

        const message = await Message.findOneOrFail({
            where: { id: message_id, channel_id:webhook.channel_id, webhook_id:webhook.id },
            relations: { attachments: true },
        });

        // no longer necessary, somehow resolved by updating the type of `attachments`...?
        // //@ts-expect-error Something is wrong with message_reference here, TS complains since "channel_id" is optional in MessageCreateSchema
        const new_message = await handleMessage({
            ...message,
            // TODO: should message_reference be overridable?
            message_reference: message.message_reference,
            ...body,
            author_id: undefined,
            channel_id:webhook.channel_id,
            id: message_id,
            edited_timestamp: new Date(),
        });

        await new_message.save();
        await emitEvent({
            event: "MESSAGE_UPDATE",
            channel_id:webhook.channel_id,
            data: {
                ...new_message.toJSON(),
                nonce: undefined,
            },
        } satisfies MessageUpdateEvent);

        postHandleMessage(new_message).catch((e) => console.error("[Message] post-message handler failed", e));

        // TODO: a DTO?
        return res.json({
            ...new_message.toJSON(),
            id: new_message.id,
            type: new_message.type,
            channel_id: new_message.channel_id,
            member: new_message.member?.toPublicMember(),
            author: new_message.author?.toPublicUser(),
            attachments: new_message.attachments,
            embeds: new_message.embeds,
            mentions: new_message.embeds,
            mention_roles: new_message.mention_roles,
            mention_everyone: new_message.mention_everyone,
            pinned: new_message.pinned,
            timestamp: new_message.timestamp,
            edited_timestamp: new_message.edited_timestamp,

            // these are not in the Discord.com response
            mention_channels: new_message.mention_channels,
        });
    },
);
export default router;
