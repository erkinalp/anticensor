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

import { Message, RoutingRule, Snowflake, Channel, getPermission } from "@spacebar/util";
import { HTTPError } from "lambert-server";
import { FindOperator, In, IsNull } from "typeorm";
import { Reaction } from "@spacebar/schemas";

export interface MessageProjection {
    channelId: string;
    allowedUserIds?: string[];
    isIntimacyBroadcast?: boolean;
    ruleId?: string;
}

export interface ProjectedMessagesQuery {
    around?: string;
    before?: string;
    after?: string;
    limit: number;
}

export async function computeProjectionsForMessage(message: Message): Promise<MessageProjection[]> {
    const projections: MessageProjection[] = [];
    const messageTimestamp = message.id;
    const sourceChannelId = message.source_channel_id || message.channel_id;

    if (!sourceChannelId) {
        return projections;
    }

    projections.push({
        channelId: sourceChannelId,
        allowedUserIds: undefined,
        isIntimacyBroadcast: false,
    });

    const rules = await RoutingRule.find({
        where: {
            source_channel_id: sourceChannelId,
        },
    });

    for (const rule of rules) {
        const isValid = BigInt(rule.valid_since) <= BigInt(messageTimestamp) && BigInt(messageTimestamp) <= BigInt(rule.valid_until);

        if (!isValid) {
            continue;
        }

        if (rule.source_users.length > 0 && message.author_id && !rule.source_users.includes(message.author_id)) {
            continue;
        }

        const isIntimacyBroadcast = rule.isIntimacyBroadcast();

        if (isIntimacyBroadcast) {
            projections[0].isIntimacyBroadcast = true;
            projections[0].ruleId = rule.id;
            continue;
        }

        if (rule.sink_channel_id) {
            projections.push({
                channelId: rule.sink_channel_id,
                allowedUserIds: rule.target_users.length > 0 ? rule.target_users : undefined,
                isIntimacyBroadcast: false,
                ruleId: rule.id,
            });
        }
    }

    return projections;
}

export async function isMessageVisibleInChannelForUser(message: Message, channelId: string, userId: string): Promise<boolean> {
    const projections = await computeProjectionsForMessage(message);

    for (const projection of projections) {
        if (projection.channelId === channelId) {
            const channel = await Channel.findOne({ where: { id: channelId } });
            if (!channel) {
                return false;
            }

            try {
                const permission = await getPermission(userId, channel.guild_id, channelId);
                if (!permission.has("VIEW_CHANNEL")) {
                    return false;
                }
            } catch (e) {
                return false;
            }

            if (!projection.allowedUserIds) {
                return true;
            }
            return projection.allowedUserIds.includes(userId);
        }
    }

    return false;
}

export async function resolveMessageInChannel(messageId: string, channelId: string, userId: string): Promise<Message> {
    const message = await Message.findOne({
        where: { id: messageId },
        relations: ["author", "webhook", "application", "attachments"],
    });

    if (!message) {
        throw new HTTPError("Message not found", 404);
    }

    const isVisible = await isMessageVisibleInChannelForUser(message, channelId, userId);

    if (!isVisible) {
        throw new HTTPError("Message not found", 404);
    }

    return message;
}

export async function getProjectedMessagesForChannel(channelId: string, userId: string, query: ProjectedMessagesQuery): Promise<Message[]> {
    const identityMessages = await Message.find({
        where: {
            channel_id: channelId,
            source_channel_id: channelId,
        },
        order: { timestamp: "DESC" },
        take: query.limit * 2,
        relations: [
            "author",
            "webhook",
            "application",
            "mentions",
            "mention_roles",
            "mention_channels",
            "sticker_items",
            "attachments",
            "referenced_message",
            "referenced_message.author",
        ],
    });

    const legacyMessages = await Message.find({
        where: {
            channel_id: channelId,
            source_channel_id: IsNull(),
        },
        order: { timestamp: "DESC" },
        take: query.limit * 2,
        relations: [
            "author",
            "webhook",
            "application",
            "mentions",
            "mention_roles",
            "mention_channels",
            "sticker_items",
            "attachments",
            "referenced_message",
            "referenced_message.author",
        ],
    });

    const sourceRules = await RoutingRule.find({
        where: {
            source_channel_id: channelId,
        },
    });

    const sourceProjectedMessages: Message[] = [];
    for (const rule of sourceRules) {
        const messages = await Message.find({
            where: {
                channel_id: rule.storage_channel_id,
                source_channel_id: channelId,
            },
            order: { timestamp: "DESC" },
            take: query.limit,
            relations: [
                "author",
                "webhook",
                "application",
                "mentions",
                "mention_roles",
                "mention_channels",
                "sticker_items",
                "attachments",
                "referenced_message",
                "referenced_message.author",
            ],
        });

        for (const message of messages) {
            const isValid = BigInt(rule.valid_since) <= BigInt(message.id) && BigInt(message.id) <= BigInt(rule.valid_until);

            if (isValid) {
                sourceProjectedMessages.push(message);
            }
        }
    }

    const sinkRules = await RoutingRule.find({
        where: {
            sink_channel_id: channelId,
        },
    });

    const sinkProjectedMessages: Message[] = [];
    for (const rule of sinkRules) {
        const messages = await Message.find({
            where: {
                channel_id: rule.storage_channel_id,
                source_channel_id: rule.source_channel_id,
            },
            order: { timestamp: "DESC" },
            take: query.limit,
            relations: [
                "author",
                "webhook",
                "application",
                "mentions",
                "mention_roles",
                "mention_channels",
                "sticker_items",
                "attachments",
                "referenced_message",
                "referenced_message.author",
            ],
        });

        for (const message of messages) {
            const isValid = BigInt(rule.valid_since) <= BigInt(message.id) && BigInt(message.id) <= BigInt(rule.valid_until);

            if (!isValid) {
                continue;
            }

            if (rule.source_users.length > 0 && message.author_id && !rule.source_users.includes(message.author_id)) {
                continue;
            }

            if (rule.target_users.length > 0 && !rule.target_users.includes(userId)) {
                continue;
            }

            sinkProjectedMessages.push(message);
        }
    }

    const allMessages = [...identityMessages, ...legacyMessages, ...sourceProjectedMessages, ...sinkProjectedMessages];

    const messageMap = new Map<string, Message>();
    for (const message of allMessages) {
        if (!messageMap.has(message.id)) {
            messageMap.set(message.id, message);
        }
    }

    const dedupedMessages = Array.from(messageMap.values());

    dedupedMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return dedupedMessages.slice(0, query.limit);
}

export function filterReactionsForIntimacyBroadcast(reactions: Reaction[], viewingUserId: string, messageAuthorId?: string): Reaction[] {
    if (!reactions || reactions.length === 0) {
        return [];
    }

    const isAuthor = viewingUserId === messageAuthorId;
    if (isAuthor) {
        return reactions;
    }

    return reactions
        .map((reaction) => {
            const userReacted = reaction.user_ids?.includes(viewingUserId);
            if (!userReacted) {
                return null;
            }
            return {
                ...reaction,
                count: 1,
                user_ids: [viewingUserId],
            };
        })
        .filter((r): r is Reaction => r !== null);
}

export async function getIntimacyBroadcastRuleForChannel(channelId: string): Promise<RoutingRule | null> {
    const rules = await RoutingRule.find({
        where: {
            source_channel_id: channelId,
        },
    });

    for (const rule of rules) {
        if (rule.isIntimacyBroadcast() && rule.isActive()) {
            return rule;
        }
    }

    return null;
}
