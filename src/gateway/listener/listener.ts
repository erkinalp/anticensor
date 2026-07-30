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

import {
    Ban,
    EVENTEnum,
    EventOpts,
    getPermission,
    listenEvent,
    ListenEventOpts,
    Member,
    Message,
    NewUrlUserSignatureData,
    Permissions,
    RabbitMQ,
    Recipient,
    Relationship,
} from "@harmony/util";
import { CLOSECODES, OPCODES, Send } from "../util";
import { WebSocket } from "@harmony/gateway";
import { Channel as AMQChannel } from "amqplib";
import { ChannelPermissionOverwrite, ChannelType, PublicMember, RelationshipType } from "@harmony/schemas";
import { bgRedBright } from "picocolors";

// TODO: close connection on Invalidated Token
// TODO: check intent
// TODO: Guild Member Update is sent for current-user updates regardless of whether the GUILD_MEMBERS intent is set.

// Sharding: calculate if the current shard id matches the formula: shard_id = (guild_id >> 22) % num_shards
// https://discord.com/developers/docs/topics/gateway#sharding

export function handlePresenceUpdate(this: WebSocket, { event, acknowledge, data }: EventOpts) {
    acknowledge?.();
    if (event === EVENTEnum.PresenceUpdate) {
        return Send(this, {
            op: OPCODES.Dispatch,
            t: event,
            d: data,
            s: this.sequence++,
        });
    }
}
function isThread(type: ChannelType) {
    return type === ChannelType.GUILD_NEWS_THREAD || type === ChannelType.GUILD_PUBLIC_THREAD || type === ChannelType.GUILD_PRIVATE_THREAD;
}
async function subGuildEvents(
    this: WebSocket,
    guild: {
        id: string;
        channels: {
            id: string;
            permission_overwrites?: ChannelPermissionOverwrite[];
            parent_id?: string | null;
            type: ChannelType;
        }[];
    },
    opts: object,
    consumer: (opts: EventOpts) => Promise<void>,
) {
    const permission = await getPermission(this.user_id, guild.id);
    this.permissions[guild.id] = permission;
    this.events[guild.id] = await listenEvent(guild.id, consumer, opts);

    await Promise.all(
        guild.channels.map(async (channel) => {
            if (isThread(channel.type)) return;
            if (permission.overwriteChannel(channel.permission_overwrites ?? []).has("VIEW_CHANNEL")) {
                this.events[channel.id] = await listenEvent(channel.id, consumer, opts);
            }
        }),
    );
    const threads = new Set(guild.channels.filter((_) => isThread(_.type)));
    let lastSize = 0;
    while (threads.size !== lastSize) {
        lastSize = threads.size;
        for (const thread of threads) {
            if (!thread.parent_id) continue;
            const parrent = this.parrentThreadMap.get(thread.parent_id) ?? thread.parent_id;
            let threads = this.threadMap.get(parrent);
            if (!threads) {
                threads = new Set();
                this.threadMap.set(parrent, threads);
            }
            threads.add(thread.id);
            this.parrentThreadMap.set(thread.id, parrent);
        }
    }
}
// TODO: use already queried guilds/channels of Identify and don't fetch them again
export async function setupListener(this: WebSocket) {
    const [members, recipients, relationships] = await Promise.all([
        Member.find({
            where: { id: this.user_id },
            relations: { guild: { channels: true } },
        }),
        Recipient.find({
            where: { user_id: this.user_id, closed: false },
            relations: { channel: true },
        }),
        Relationship.find({
            where: {
                from_id: this.user_id,
                type: RelationshipType.friends,
            },
        }),
    ]);

    const guilds = members.map((x) => x.guild);
    const dm_channels = recipients.map((x) => x.channel);

    const opts: {
        acknowledge: boolean;
        channel?: AMQChannel & { queues?: unknown; ch?: number };
    } = {
        acknowledge: true,
    };
    this.listen_options = opts;
    const consumer = consume.bind(this);

    const handleChannelError = (err: unknown) => {
        console.error(`[RabbitMQ] [user-${this.user_id}] Channel Error (Handled):`, err);
    };

    // Function to set up all event listeners (used for initial setup and reconnection)
    const setupEventListeners = async () => {
        if (RabbitMQ.connection) {
            console.log(`[RabbitMQ] [user-${this.user_id}] Setting up channel and event listeners`);
            opts.channel = await RabbitMQ.connection.createChannel();

            opts.channel.on("error", handleChannelError);
            opts.channel.queues = {};
            console.log("[RabbitMQ] channel created: ", typeof opts.channel, "with channel id", opts.channel?.ch);
        }

        this.events[this.user_id] = await listenEvent(this.user_id, consumer, opts);
        this.events[this.session_id] = await listenEvent(this.session_id, consumer, opts);

        await Promise.all(
            relationships.map(async (relationship) => {
                this.events[relationship.to_id] = await listenEvent(relationship.to_id, handlePresenceUpdate.bind(this), opts);
            }),
        );

        await Promise.all(
            dm_channels.map(async (channel) => {
                this.events[channel.id] = await listenEvent(channel.id, consumer, opts);
            }),
        );

        await Promise.all(
            guilds.map(async (guild) => {
                await subGuildEvents.call(this, guild, opts, consumer);
            }),
        );
    };

    // Initial setup
    await setupEventListeners();

    // Handle RabbitMQ reconnection - re-establish all subscriptions
    const handleReconnect = async () => {
        console.log(`[RabbitMQ] [user-${this.user_id}] Connection restored, re-establishing subscriptions`);
        try {
            // Clear old event handlers (they're now invalid)
            this.events = {};
            this.member_events = {};
            this.threadMap.clear();
            opts.channel = undefined;

            // re-establish all subscriptions
            await setupEventListeners();
            console.log(`[RabbitMQ] [user-${this.user_id}] Successfully re-established subscriptions`);
        } catch (e) {
            console.error(`[RabbitMQ] [user-${this.user_id}] Failed to re-establish subscriptions:`, e);
            // close the WebSocket - will force client to reconnect and redo subscription setup
            this.close(4000, "Failed to re-establish event subscriptions");
        }
    };

    const handleDisconnect = () => {
        console.log(`[RabbitMQ] [user-${this.user_id}] Connection lost, waiting for reconnection`);
        // mark channel invalid
        if (opts.channel) {
            opts.channel.off("error", handleChannelError);
        }
        opts.channel = undefined;
    };

    // Subscribe to RabbitMQ connection events
    RabbitMQ.on("reconnected", handleReconnect);
    RabbitMQ.on("disconnected", handleDisconnect);

    this.once("close", async () => {
        // Unsubscribe from RabbitMQ events
        RabbitMQ.off("reconnected", handleReconnect);
        RabbitMQ.off("disconnected", handleDisconnect);

        // wait for event consumer cancellation
        await Promise.all(
            Object.values(this.events).map((x) => {
                if (x) return x();
                else return Promise.resolve();
            }),
        );
        await Promise.all(Object.values(this.member_events).map((x) => x()));

        if (opts.channel) {
            try {
                await opts.channel.close();
            } catch {
                // Channel might already be closed
            }
            opts.channel.off("error", handleChannelError);
        }
    });
}
function figurePermissionForEvent(this: WebSocket, opts: EventOpts): { channelPerm: Permissions; guildPerm: Permissions } {
    let guild_id: string | undefined = undefined;
    let channel_id: string | undefined = undefined;
    switch (opts.event) {
        case "GUILD_MEMBER_ADD":
        case "GUILD_MEMBER_REMOVE":
        case "GUILD_MEMBER_UPDATE":
        case "INVITE_CREATE":
        case "INVITE_DELETE":
        case "GUILD_INTEGRATIONS_UPDATE":
        case "GUILD_BAN_ADD":
        case "GUILD_BAN_REMOVE":
        case "GUILD_ROLE_CREATE":
        case "GUILD_ROLE_UPDATE":
        case "GUILD_ROLE_DELETE":
            guild_id = opts.data.guild_id;
            break;
        case "TYPING_START":
        case "MESSAGE_REACTION_ADD":
        case "MESSAGE_REACTION_REMOVE":
        case "MESSAGE_REACTION_REMOVE_ALL":
        case "MESSAGE_REACTION_REMOVE_EMOJI":
        case "MESSAGE_CREATE":
        case "MESSAGE_DELETE":
        case "MESSAGE_UPDATE":
        case "MESSAGE_DELETE_BULK":
        case "CHANNEL_PINS_UPDATE":
        case "VOICE_STATE_UPDATE":
        case "WEBHOOKS_UPDATE":
            guild_id = opts.data.guild_id ?? undefined;
            channel_id = opts.data.channel_id ?? undefined;
            break;
        case "GUILD_CREATE":
        case "GUILD_DELETE":
        case "GUILD_UPDATE":
            guild_id = opts.data.id;
            break;
        case "CHANNEL_CREATE":
        case "CHANNEL_DELETE":
        case "CHANNEL_UPDATE":
        case "THREAD_MEMBER_UPDATE":
        case "THREAD_UPDATE":
        case "THREAD_CREATE":
        case "THREAD_DELETE":
        case "THREAD_MEMBERS_UPDATE":
            guild_id = opts.data.guild_id;
            channel_id = opts.data.id;
            break;

        case "GUILD_MEMBERS_CHUNK":
        case "CHANNEL_RECIPIENT_REMOVE":
        case "PRESENCE_UPDATE":
        case "GUILD_EMOJIS_UPDATE":
        case "READY":
        case "USER_UPDATE":
        case "APPLICATION_COMMAND_CREATE":
        case "APPLICATION_COMMAND_DELETE":
        case "APPLICATION_COMMAND_UPDATE":
        case "CHANNEL_RECIPIENT_ADD":
        case "GUILD_MEMBER_LIST_UPDATE":
        case "USER_DELETE":
        case "USER_CONNECTIONS_UPDATE":
        case "VOICE_SERVER_UPDATE":
        case "INTERACTION_CREATE":
        case "INTERACTION_SUCCESS":
        case "INTERACTION_FAILURE":
        case "MESSAGE_ACK":
        case "RELATIONSHIP_ADD":
        case "RELATIONSHIP_REMOVE":
        case "THREAD_LIST_SYNC":
        case "INVALIDATED":
        case "RATELIMIT":
        case "SB_SESSION_REMOVE":
        case "SB_SESSION_CLOSE":
            //unchecked events
            break;
        default:
            opts satisfies never;
    }
    if (channel_id) {
        channel_id = this.parrentThreadMap.get(channel_id) ?? channel_id;
    }
    const retObj = { channelPerm: new Permissions("ADMINISTRATOR"), guildPerm: new Permissions("ADMINISTRATOR") };
    if ((!guild_id && !channel_id) || guild_id === "@me") {
        return retObj;
    } else if (!channel_id && guild_id) {
        retObj.channelPerm = this.permissions[guild_id] ?? retObj.channelPerm;
        retObj.guildPerm = this.permissions[guild_id] ?? retObj.guildPerm;
    } else if (!guild_id && channel_id) {
        retObj.channelPerm = this.permissions[channel_id] ?? retObj.channelPerm;
        retObj.guildPerm = this.permissions[channel_id] ?? retObj.guildPerm;
    } else {
        retObj.channelPerm = this.permissions[channel_id as string] ?? retObj.channelPerm;
        retObj.guildPerm = this.permissions[guild_id as string] ?? retObj.channelPerm;
    }
    return retObj;
}
// TODO: only subscribe for events that are in the connection intents
async function consume(this: WebSocket, opts: EventOpts) {
    const id = opts.data.id;
    const { channelPerm, guildPerm } = figurePermissionForEvent.call(this, opts);
    const consumer = consume.bind(this);
    const listenOpts = opts as ListenEventOpts;
    opts.acknowledge?.();
    // console.log("event", event);

    // special codes
    switch (opts.event) {
        case "SB_SESSION_CLOSE":
            // TODO: what do we even send here?
            await Send(this, {
                op: OPCODES.Reconnect,
                s: this.sequence++,
                d: opts.reconnect_delay ?? opts.data ?? 1000,
            });
            this.close(1000); // not a discord close code, standard WS "Normal Closure"
            return;
        case "SB_SESSION_REMOVE":
            // TODO: what do we even send here?
            await Send(this, {
                op: OPCODES.Invalid_Session,
                s: this.sequence++,
            });
            this.close(CLOSECODES.Invalid_session); // TODO: this is deprecated?
            return;
    }

    // subscription managment
    switch (opts.event) {
        case "GUILD_MEMBER_REMOVE":
            this.member_events[opts.data.user.id]?.();
            delete this.member_events[opts.data.user.id];
            break;
        case "GUILD_MEMBER_ADD":
            if (this.member_events[opts.data.user.id]) break; // already subscribed
            this.member_events[opts.data.user.id] = await listenEvent(opts.data.user.id, handlePresenceUpdate.bind(this), this.listen_options);
            break;
        case "GUILD_MEMBER_UPDATE":
            if (!this.member_events[opts.data.user.id]) break;
            await this.member_events[opts.data.user.id]();
            break;
        case "THREAD_DELETE": {
            const parrent = this.parrentThreadMap.get(opts.data.id);
            if (parrent) {
                const threads = this.threadMap.get(parrent);
                threads?.delete(opts.data.id);
                this.parrentThreadMap.delete(opts.data.id);
            }
        }
        // eslint-disable-next-line no-fallthrough
        case "RELATIONSHIP_REMOVE":
        case "CHANNEL_DELETE":
        case "GUILD_DELETE":
            this.events[id]?.();
            delete this.events[id];
            if (opts.event === "GUILD_DELETE" && this.ipAddress) {
                const ban = await Ban.findOne({
                    where: { guild_id: id, user_id: this.user_id },
                });

                if (ban) {
                    ban.ip = this.ipAddress || undefined;
                    await ban.save();
                }
            }
            break;
        case "THREAD_CREATE":
            {
                if (!opts.data.parent_id) return;
                const parrent = this.parrentThreadMap.get(opts.data.parent_id) ?? opts.data.parent_id;
                let threads = this.threadMap.get(parrent);
                if (!threads) {
                    threads = new Set();
                    this.threadMap.set(parrent, threads);
                }
                threads.add(opts.data.id);
                this.parrentThreadMap.set(opts.data.id, parrent);
            }
            break;
        case "CHANNEL_CREATE":
            if (!guildPerm.overwriteChannel(opts.data.permission_overwrites || []).has("VIEW_CHANNEL")) return;
            this.events[id] = await listenEvent(id, consumer, listenOpts);
            break;
        case "RELATIONSHIP_ADD":
            this.events[opts.data.user.id] = await listenEvent(opts.data.user.id, handlePresenceUpdate.bind(this), this.listen_options);
            break;
        case "GUILD_CREATE":
            await subGuildEvents.call(this, opts.data, opts, consumer);
            break;
        case "CHANNEL_UPDATE": {
            const exists = this.events[id];
            const threads = this.threadMap.get(id);
            const perms = guildPerm.overwriteChannel(opts.data.permission_overwrites || []);
            if (perms.has("VIEW_CHANNEL")) {
                if (exists) break;

                if (threads)
                    await Promise.all(
                        [...threads].map(async (t) => {
                            this.events[t] = await listenEvent(t, consumer, listenOpts);
                        }),
                    );
                this.events[id] = await listenEvent(id, consumer, listenOpts);
            } else {
                if (!exists) return; // return -> do not send channel update events for hidden channels
                opts.cancel(id);
                if (threads)
                    [...threads].forEach((t) => {
                        opts.cancel(t);
                        delete this.events[t];
                    });
                delete this.events[id];
            }
            break;
        }
    }

    // permission checking
    switch (opts.event) {
        case "INVITE_CREATE":
        case "INVITE_DELETE":
        case "GUILD_INTEGRATIONS_UPDATE":
            if (!channelPerm.has("MANAGE_GUILD")) return;
            break;
        case "WEBHOOKS_UPDATE":
            if (!channelPerm.has("MANAGE_WEBHOOKS")) return;
            break;
        case "GUILD_MEMBER_ADD":
        case "GUILD_MEMBER_REMOVE":
        case "GUILD_MEMBER_UPDATE": // only send them, if the user subscribed for this part of the member list, or is a bot
        case "PRESENCE_UPDATE": // exception if user is friend
            if (opts.data.user.id === this.user_id) return;
            break;
        case "GUILD_BAN_ADD":
        case "GUILD_BAN_REMOVE":
            if (!channelPerm.has("BAN_MEMBERS")) return;
            break;
        case "VOICE_STATE_UPDATE":
        case "MESSAGE_CREATE":
        case "MESSAGE_DELETE":
        case "MESSAGE_DELETE_BULK":
        case "MESSAGE_UPDATE":
        case "CHANNEL_PINS_UPDATE":
        case "MESSAGE_REACTION_ADD":
        case "MESSAGE_REACTION_REMOVE":
        case "MESSAGE_REACTION_REMOVE_ALL":
        case "MESSAGE_REACTION_REMOVE_EMOJI":
        case "TYPING_START":
            // only gets send if the user is alowed to view the current channel
            if (!channelPerm.has("VIEW_CHANNEL")) return;
            break;
        case "GUILD_CREATE":
        case "GUILD_DELETE":
        case "GUILD_UPDATE":
        case "GUILD_ROLE_CREATE":
        case "GUILD_ROLE_UPDATE":
        case "GUILD_ROLE_DELETE":
        case "CHANNEL_CREATE":
        case "CHANNEL_DELETE":
        case "CHANNEL_UPDATE":
        case "GUILD_EMOJIS_UPDATE":
        case "READY": // will be sent by the gateway
        case "USER_UPDATE":
        case "APPLICATION_COMMAND_CREATE":
        case "APPLICATION_COMMAND_DELETE":
        case "APPLICATION_COMMAND_UPDATE":
        default:
            // always gets sent
            // Any events not defined in an intent are considered "passthrough" and will always be sent
            break;
    }

    // data rewrites, e.g. signed attachment URLs
    switch (opts.event) {
        case "MESSAGE_CREATE":
        case "MESSAGE_UPDATE":
            // console.log(this.request)
            if (opts.data["attachments"])
                opts.data["attachments"] =
                    Message.prototype.withSignedAttachments.call(
                        opts.data,
                        new NewUrlUserSignatureData({
                            ip: this.ipAddress,
                            userAgent: this.userAgent,
                        }),
                    ).attachments || [];
            if (opts.data["components"]) {
                opts.data["components"] =
                    Message.prototype.withSignedAttachments.call(
                        opts.data,
                        new NewUrlUserSignatureData({
                            ip: this.ipAddress,
                            userAgent: this.userAgent,
                        }),
                    ).components || [];
            }
            Message.cleanUserJSON(opts.data, this.user_id);
            break;
        default:
            break;
    }

    if (opts.event === "GUILD_MEMBER_ADD") {
        if (opts.data.roles === undefined || opts.data.roles === null) {
            console.log(
                bgRedBright(`[Gateway/${this.user_id}]`),
                "[GUILD_MEMBER_ADD] roles is undefined, setting to empty array!",
                opts.origin ?? "(Event origin not defined)",
                opts.data,
            );
            opts.data.roles = [];
        }
    }

    await Send(this, {
        op: OPCODES.Dispatch,
        t: opts.event,
        d: opts.data,
        s: this.sequence++,
    });
}
