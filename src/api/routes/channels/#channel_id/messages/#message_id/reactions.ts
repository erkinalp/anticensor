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

import { route } from "@spacebar/api";
import {
    Channel,
    emitEvent,
    Emoji,
    getPermission,
    Member,
    Message,
    MessageReactionAddEvent,
    MessageReactionRemoveAllEvent,
    MessageReactionRemoveEmojiEvent,
    MessageReactionRemoveEvent,
    User,
    ReactionType,
} from "@spacebar/util";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";
import { In } from "typeorm";
import { PartialEmoji, PublicMemberProjection, PublicUserProjection } from "@spacebar/schemas";
import {
    resolveMessageInChannel,
    computeProjectionsForMessage,
    getIntimacyBroadcastRuleForChannel,
    filterReactionsForIntimacyBroadcast,
} from "../../../../../util/helpers/MessageProjection";

const router = Router({ mergeParams: true });
// TODO: check if emoji is really an unicode emoji or a properly encoded external emoji

function getEmoji(emoji: string): PartialEmoji {
    emoji = decodeURIComponent(emoji);
    const parts = emoji.includes(":") && emoji.split(":");
    if (parts)
        return {
            name: parts[0],
            id: parts[1],
        };

    return {
        id: undefined,
        name: emoji,
    };
}

router.delete(
    "/",
    route({
        permission: "MANAGE_MESSAGES",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { message_id, channel_id } = req.params as { [key: string]: string };

        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });

        const message = await resolveMessageInChannel(message_id, channel_id, req.user_id);

        message.reactions = [];
        await message.save();

        const projections = await computeProjectionsForMessage(message);

        await Promise.all(
            projections.map((projection) =>
                emitEvent({
                    event: "MESSAGE_REACTION_REMOVE_ALL",
                    channel_id: projection.channelId,
                    data: {
                        channel_id: projection.channelId,
                        message_id,
                        guild_id: channel.guild_id,
                    },
                } satisfies MessageReactionRemoveAllEvent),
            ),
        );

        res.sendStatus(204);
    },
);

router.delete(
    "/:emoji",
    route({
        permission: "MANAGE_MESSAGES",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { message_id, channel_id } = req.params as { [key: string]: string };
        const emoji = getEmoji(req.params.emoji as string);

        const message = await resolveMessageInChannel(message_id, channel_id, req.user_id);

        const already_added = message.reactions.find((x) => (x.emoji.id === emoji.id && emoji.id) || x.emoji.name === emoji.name);
        if (!already_added) throw new HTTPError("Reaction not found", 404);
        message.reactions.splice(message.reactions.indexOf(already_added), 1);

        await message.save();

        const projections = await computeProjectionsForMessage(message);

        await Promise.all(
            projections.map((projection) =>
                emitEvent({
                    event: "MESSAGE_REACTION_REMOVE_EMOJI",
                    channel_id: projection.channelId,
                    data: {
                        channel_id: projection.channelId,
                        message_id,
                        guild_id: message.guild_id,
                        emoji,
                    },
                } satisfies MessageReactionRemoveEmojiEvent),
            ),
        );

        res.sendStatus(204);
    },
);

router.get(
    "/:emoji",
    route({
        permission: "VIEW_CHANNEL",
        responses: {
            200: {
                body: "PublicUser",
            },
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { message_id, channel_id } = req.params as { [key: string]: string };
        const emoji = getEmoji(req.params.emoji as string);

        const message = await resolveMessageInChannel(message_id, channel_id, req.user_id);

        const intimacyRule = await getIntimacyBroadcastRuleForChannel(message.source_channel_id || message.channel_id!);
        const isIntimacyBroadcast = intimacyRule !== null;

        let reactions = message.reactions;
        if (isIntimacyBroadcast) {
            reactions = filterReactionsForIntimacyBroadcast(reactions, req.user_id, message.author_id);
        }

        const reaction = reactions.find((x) => (x.emoji.id === emoji.id && emoji.id) || x.emoji.name === emoji.name);
        if (!reaction) throw new HTTPError("Reaction not found", 404);

        const users = (
            await User.find({
                where: {
                    id: In(reaction.user_ids),
                },
                select: PublicUserProjection,
            })
        ).map((user) => user.toPublicUser());

        res.json(users);
    },
);

router.put(
    "/:emoji/:user_id",
    route({
        permission: "READ_MESSAGE_HISTORY",
        right: "SELF_ADD_REACTIONS",
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        const { message_id, channel_id, user_id } = req.params as { [key: string]: string };
        if (user_id !== "@me") throw new HTTPError("Invalid user");
        const emoji = getEmoji(req.params.emoji as string);

        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });
        const message = await resolveMessageInChannel(message_id, channel_id, req.user_id);
        const already_added = message.reactions.find((x) => (x.emoji.id === emoji.id && emoji.id) || x.emoji.name === emoji.name);

        if (!already_added) req.permission?.hasThrow("ADD_REACTIONS");

        if (emoji.id) {
            const external_emoji = await Emoji.findOneOrFail({
                where: { id: emoji.id },
            });
            if (!already_added && channel.guild_id != external_emoji.guild_id) req.permission?.hasThrow("USE_EXTERNAL_EMOJIS");
            emoji.animated = external_emoji.animated;
            emoji.name = external_emoji.name;
        }

        if (already_added) {
            if (already_added.user_ids.includes(req.user_id)) return res.sendStatus(204); // Do not throw an error ¯\_(ツ)_/¯ as discord also doesn't throw any error
            already_added.count++;
            already_added.user_ids.push(req.user_id);
        } else
            message.reactions.push({
                count: 1,
                emoji,
                user_ids: [req.user_id],
            });

        await message.save();

        const member = channel.guild_id
            ? (
                  await Member.findOneOrFail({
                      where: { id: req.user_id, guild_id: channel.guild_id },
                      relations: { roles: true, user: true },
                      select: {
                          index: true,
                          ...Object.fromEntries(PublicMemberProjection.map((x) => [x, true])),
                          user: Object.fromEntries(PublicUserProjection.map((x) => [x, true])),
                          roles: {
                              id: true,
                          },
                      },
                  })
              ).toPublicMember()
            : undefined;

        const projections = await computeProjectionsForMessage(message);

        await Promise.all(
            projections.map((projection) =>
                emitEvent({
                    event: "MESSAGE_REACTION_ADD",
                    channel_id: projection.channelId,
                    data: {
                        user_id: req.user_id,
                        channel_id: projection.channelId,
                        message_id,
                        guild_id: channel.guild_id,
                        emoji,
                        member,
                        type: ReactionType.normal,
                    },
                } satisfies MessageReactionAddEvent),
            ),
        );

        res.sendStatus(204);
    },
);

router.delete(
    "/:emoji/:user_id",
    route({
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        let { user_id } = req.params as { [key: string]: string };
        const { message_id, channel_id } = req.params as { [key: string]: string };

        const emoji = getEmoji(req.params.emoji as string);

        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });
        const message = await resolveMessageInChannel(message_id, channel_id, req.user_id);

        if (user_id === "@me") user_id = req.user_id;
        else {
            const permissions = await getPermission(req.user_id, undefined, channel_id);
            permissions.hasThrow("MANAGE_MESSAGES");
        }

        const already_added = message.reactions.find((x) => (x.emoji.id === emoji.id && emoji.id) || x.emoji.name === emoji.name);
        if (!already_added || !already_added.user_ids.includes(user_id)) throw new HTTPError("Reaction not found", 404);

        already_added.count--;

        if (already_added.count <= 0) message.reactions.splice(message.reactions.indexOf(already_added), 1);
        else already_added.user_ids.splice(already_added.user_ids.indexOf(user_id), 1);

        await message.save();

        const projections = await computeProjectionsForMessage(message);

        await Promise.all(
            projections.map((projection) =>
                emitEvent({
                    event: "MESSAGE_REACTION_REMOVE",
                    channel_id: projection.channelId,
                    data: {
                        user_id: req.user_id,
                        channel_id: projection.channelId,
                        message_id,
                        guild_id: channel.guild_id,
                        emoji,
                        type: ReactionType.normal,
                    },
                } satisfies MessageReactionRemoveEvent),
            ),
        );

        res.sendStatus(204);
    },
);

router.delete(
    "/:emoji/:burst/:user_id",
    route({
        responses: {
            204: {},
            400: {
                body: "APIErrorResponse",
            },
            404: {},
            403: {},
        },
    }),
    async (req: Request, res: Response) => {
        let { user_id } = req.params as { [key: string]: string };
        const { message_id, channel_id } = req.params as { [key: string]: string };

        const emoji = getEmoji(req.params.emoji as string);

        const channel = await Channel.findOneOrFail({
            where: { id: channel_id },
        });
        const message = await resolveMessageInChannel(message_id, channel_id, req.user_id);

        if (user_id === "@me") user_id = req.user_id;
        else {
            const permissions = await getPermission(req.user_id, undefined, channel_id);
            permissions.hasThrow("MANAGE_MESSAGES");
        }

        const already_added = message.reactions.find((x) => (x.emoji.id === emoji.id && emoji.id) || x.emoji.name === emoji.name);
        if (!already_added || !already_added.user_ids.includes(user_id)) throw new HTTPError("Reaction not found", 404);

        already_added.count--;

        if (already_added.count <= 0) message.reactions.splice(message.reactions.indexOf(already_added), 1);
        else already_added.user_ids.splice(already_added.user_ids.indexOf(user_id), 1);

        await message.save();

        const projections = await computeProjectionsForMessage(message);

        await Promise.all(
            projections.map((projection) =>
                emitEvent({
                    event: "MESSAGE_REACTION_REMOVE",
                    channel_id: projection.channelId,
                    data: {
                        user_id: req.user_id,
                        channel_id: projection.channelId,
                        message_id,
                        guild_id: channel.guild_id,
                        emoji,
                        type: ReactionType.normal,
                    },
                } satisfies MessageReactionRemoveEvent),
            ),
        );

        res.sendStatus(204);
    },
);

export default router;
