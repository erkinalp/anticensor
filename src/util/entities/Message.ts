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

import { User } from "./User";
import { Member } from "./Member";
import { Role } from "./Role";
import { Channel } from "./Channel";
import { InteractionType } from "../interfaces/Interaction";
import { Application } from "./Application";
import { Column, CreateDateColumn, Entity, FindOneOptions, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, Not, OneToMany, Raw, RelationId } from "typeorm";
import { BaseClass } from "./BaseClass";
import { Guild } from "./Guild";
import { Webhook } from "./Webhook";
import { Sticker } from "./Sticker";
import { Attachment } from "./Attachment";
import { NewUrlUserSignatureData } from "../Signing";
import { MessageFlags } from "../util/MessageFlags";
import { PartialMessage } from "@spacebar/schemas";

export enum MessageType {
    DEFAULT = 0,
    RECIPIENT_ADD = 1,
    RECIPIENT_REMOVE = 2,
    CALL = 3,
    CHANNEL_NAME_CHANGE = 4,
    CHANNEL_ICON_CHANGE = 5,
    CHANNEL_PINNED_MESSAGE = 6,
    GUILD_MEMBER_JOIN = 7,
    USER_PREMIUM_GUILD_SUBSCRIPTION = 8,
    USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1 = 9,
    USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2 = 10,
    USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3 = 11,
    CHANNEL_FOLLOW_ADD = 12,
    ACTION = 13, // /me messages
    GUILD_DISCOVERY_DISQUALIFIED = 14,
    GUILD_DISCOVERY_REQUALIFIED = 15,
    GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING = 16,
    GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING = 17,
    THREAD_CREATED = 18,
    REPLY = 19,
    APPLICATION_COMMAND = 20, // application command or self command invocation
    THREAD_STARTER_MESSAGE = 21,
    GUILD_INVITE_REMINDER = 22,
    CONTEXT_MENU_COMMAND = 23,
    AUTO_MODERATION_ACTION = 24,
    CUSTOM_START = 127, // start custom message types from here
    ENCRYPTED = 128,
    ROUTE_ADDED = 129, // custom message routing: new route affecting that channel
    ROUTE_DISABLED = 130, // custom message routing: given route no longer affecting that channel
    SELF_COMMAND_SCRIPT = 131, // self command scripts
    ENCRYPTION = 132,
    UNHANDLED = 255,
}

@Entity({
    name: "messages",
})
@Index(["channel_id", "id"], { unique: true })
export class Message extends BaseClass {
    @Column({ nullable: true })
    @RelationId((message: Message) => message.channel)
    @Index()
    channel_id?: string;

    @JoinColumn({ name: "channel_id" })
    @ManyToOne(() => Channel, {
        onDelete: "CASCADE",
    })
    channel: Channel;

    @Column({ nullable: true })
    @RelationId((message: Message) => message.thread)
    thread_id?: string;

    @JoinColumn({ name: "thread_id" })
    @ManyToOne(() => Channel, {
        onDelete: "CASCADE",
    })
    thread?: Channel;

    @Column({ nullable: true })
    @RelationId((message: Message) => message.guild)
    guild_id?: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, {
        onDelete: "CASCADE",
    })
    guild?: Guild;

    @Column({ nullable: true })
    @RelationId((message: Message) => message.author)
    @Index()
    author_id?: string;

    @JoinColumn({ name: "author_id", referencedColumnName: "id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    author?: User;

    @Column({ nullable: true })
    @RelationId((message: Message) => message.member)
    member_id?: string;

    @JoinColumn({ name: "member_id", referencedColumnName: "id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    member?: Member;

    @Column({ nullable: true })
    @RelationId((message: Message) => message.webhook)
    webhook_id?: string;

    @JoinColumn({ name: "webhook_id" })
    @ManyToOne(() => Webhook)
    webhook?: Webhook;

    @Column({ nullable: true })
    @RelationId((message: Message) => message.application)
    application_id?: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application)
    application?: Application;

    @Column({ nullable: true })
    content?: string;

    @Column()
    @CreateDateColumn()
    timestamp: Date;

    @Column({ nullable: true })
    edited_timestamp?: Date;

    @Column({ nullable: true })
    tts?: boolean;

    @Column({ nullable: true })
    mention_everyone?: boolean;

    @JoinTable({ name: "message_user_mentions" })
    @ManyToMany(() => User)
    mentions: User[];

    @JoinTable({ name: "message_role_mentions" })
    @ManyToMany(() => Role)
    mention_roles: Role[];

    @JoinTable({ name: "message_channel_mentions" })
    @ManyToMany(() => Channel)
    mention_channels: Channel[];

    @JoinTable({ name: "message_stickers" })
    @ManyToMany(() => Sticker, { cascade: true, onDelete: "CASCADE" })
    sticker_items?: Sticker[];

    @OneToMany(() => Attachment, (attachment: Attachment) => attachment.message, {
        cascade: true,
        orphanedRowAction: "delete",
    })
    attachments?: Attachment[];

    @Column({ type: "simple-json" })
    embeds: Embed[];

    @Column({ type: "simple-json" })
    reactions: Reaction[];

    @Column({ type: "text", nullable: true })
    nonce?: string;

    @Column({ nullable: true })
    pinned?: boolean;

    @Column({ nullable: true })
    pinned_at?: Date | null;

    @Column({ type: "int" })
    type: MessageType;

    @Column({ type: "simple-json", nullable: true })
    activity?: {
        type: number;
        party_id: string;
    };

    @Column({ default: 0 })
    flags: number;

    @Column({ type: "simple-json", nullable: true })
    message_reference?: {
        message_id?: string;
        channel_id?: string;
        guild_id?: string;
        type?: number;
    };

    @JoinColumn({ name: "message_reference_id" })
    @ManyToOne(() => Message)
    referenced_message?: Message;

    @Column({ type: "simple-json", nullable: true })
    interaction?: {
        id: string;
        type: InteractionType;
        name: string;
        user_id: string; // the user who invoked the interaction
        // user: User; // TODO: autopopulate user
    };

    @Column({ type: "simple-json", nullable: true })
    components?: ActionRowComponent[];

    @Column({ type: "simple-json", nullable: true })
    poll?: Poll;

    @Column({ type: "simple-json", nullable: true })
    interaction_metadata?: {
        id: string;
        type: InteractionType;
        user_id: string;
        authorizing_integration_owners?: Record<string, string>;
        original_response_message_id?: string;
        interacted_message_id?: string;
        name?: string;
    };

    @Column({ type: "simple-json", nullable: true })
    message_snapshots?: MessageSnapshot[];

    @Column({ type: "simple-json", nullable: true })
    reply_ids?: string[];

    @Column({ nullable: true })
    username?: string;

    @Column({ nullable: true })
    avatar?: string;

    toJSON(): Message {
        return {
            ...this,
            author_id: undefined,
            member_id: undefined,
            webhook_id: this.webhook_id ?? undefined,
            application_id: undefined,

            nonce: this.nonce ?? undefined,
            tts: this.tts ?? false,
            guild: this.guild ?? undefined,
            webhook: this.webhook ?? undefined,
            interaction: this.interaction ?? undefined,
            reactions: this.reactions ?? undefined,
            sticker_items: this.sticker_items ?? undefined,
            message_reference: this.message_reference ?? undefined,
            author: {
                ...(this.author?.toPublicUser() ?? undefined),
                // Webhooks
                username: this.username ?? this.author?.username,
                avatar: this.avatar ?? this.author?.avatar,
            },
            activity: this.activity ?? undefined,
            application: this.application ?? undefined,
            components: this.components ?? undefined,
            poll: this.poll ?? undefined,
            content: this.content ?? "",
            reply_ids: this.reply_ids ?? undefined,
        };
    }

    withSignedAttachments(data: NewUrlUserSignatureData) {
        return {
            ...this,
            attachments: this.attachments?.map((attachment: Attachment) => Attachment.prototype.signUrls.call(attachment, data)),
        };
    }

    toPartialMessage(): PartialMessage {
        return {
            id: this.id,
            // lobby_id: this.lobby_id,
            channel_id: this.channel_id!,
            type: this.type,
            content: this.content!,
            author: { ...this.author!, avatar: this.author?.avatar ?? null },
            flags: this.flags,
            application_id: this.application_id,
            //channel: this.channel, // TODO: ephemeral DM channels
            // recipient_id: this.recipient_id, // TODO: ephemeral DM channels
        };
    }

    static async createWithDefaults(opts: Partial<Message>): Promise<Message> {
        const message = Message.create();

        if (!opts.author) {
            if (!opts.author_id) throw new Error("Either author or author_id must be provided to create a Message");
            opts.author = await User.findOneOrFail({ where: { id: opts.author_id! } });
        }

        if (!opts.channel) {
            if (!opts.channel_id) throw new Error("Either channel or channel_id must be provided to create a Message");
            opts.channel = await Channel.findOneOrFail({ where: { id: opts.channel_id! } });
            opts.guild_id ??= opts.channel.guild_id;
        }

        if (!opts.member_id) opts.member_id = message.author_id;
        if (!opts.member) opts.member = await Member.findOneOrFail({ where: { id: opts.member_id! } });

        if (!opts.guild) {
            if (opts.guild_id) opts.guild = await Guild.findOneOrFail({ where: { id: opts.guild_id! } });
            else if (opts.channel?.guild?.id) opts.guild = opts.channel.guild;
            else if (opts.channel?.guild_id) opts.guild = await Guild.findOneOrFail({ where: { id: opts.channel.guild_id! } });
            else if (opts.member?.guild?.id) opts.guild = opts.member.guild;
            else if (opts.member?.guild_id) opts.guild = await Guild.findOneOrFail({ where: { id: opts.member.guild_id! } });
            else throw new Error("Either guild, guild_id, channel.guild, channel.guild_id, member.guild or member.guild_id must be provided to create a Message");
        }

        // try 2 now that we have a guild
        if (!opts.member) opts.member = await Member.findOneOrFail({ where: { id: opts.author!.id, guild_id: opts.guild!.id } });

        // set reply type if a message if referenced
        if (opts.message_reference && !opts.type) message.type = MessageType.REPLY;

        // backpropagate ids
        opts.channel_id = opts.channel.id;
        opts.guild_id = opts.guild.id;
        opts.author_id = opts.author.id;
        opts.member_id = opts.member.id;
        opts.webhook_id = opts.webhook?.id;
        opts.application_id = opts.application?.id;

        delete opts.member;

        Object.assign(message, {
            tts: false,
            embeds: [],
            reactions: [],
            flags: 0,
            type: 0,
            timestamp: new Date(),
            ...opts,
        });
        return message;
    }

    static addDefault(options: FindOneOptions<Message>) {
        if (options.where) {
            const arr = options.where instanceof Array ? options.where : [options.where];
            for (const thing of arr) {
                if (!("flags" in thing)) {
                    thing.flags = Not(Raw((alias) => `${alias} & ${MessageFlags.FLAGS.EPHEMERAL} = ${MessageFlags.FLAGS.EPHEMERAL}`));
                }
            }
        }
    }
}

export interface MessageComponent {
    type: MessageComponentType;
}

export interface ActionRowComponent extends MessageComponent {
    type: MessageComponentType.ActionRow;
    components: (ButtonComponent | StringSelectMenuComponent | SelectMenuComponent | TextInputComponent)[];
}

export interface ButtonComponent extends MessageComponent {
    type: MessageComponentType.Button;
    style: ButtonStyle;
    label?: string;
    emoji?: PartialEmoji;
    custom_id?: string;
    sku_id?: string;
    url?: string;
    disabled?: boolean;
}

export enum ButtonStyle {
    Primary = 1,
    Secondary = 2,
    Success = 3,
    Danger = 4,
    Link = 5,
    Premium = 6,
}

export interface SelectMenuComponent extends MessageComponent {
    type:
        | MessageComponentType.StringSelect
        | MessageComponentType.UserSelect
        | MessageComponentType.RoleSelect
        | MessageComponentType.MentionableSelect
        | MessageComponentType.ChannelSelect;
    custom_id: string;
    channel_types?: number[];
    placeholder?: string;
    default_values?: SelectMenuDefaultOption[]; // only for non-string selects
    min_values?: number;
    max_values?: number;
    disabled?: boolean;
}

export interface SelectMenuOption {
    label: string;
    value: string;
    description?: string;
    emoji?: PartialEmoji;
    default?: boolean;
}

export interface SelectMenuDefaultOption {
    id: string;
    type: "user" | "role" | "channel";
}

export interface StringSelectMenuComponent extends SelectMenuComponent {
    type: MessageComponentType.StringSelect;
    options: SelectMenuOption[];
}

export interface TextInputComponent extends MessageComponent {
    type: MessageComponentType.TextInput;
    custom_id: string;
    style: TextInputStyle;
    label: string;
    min_length?: number;
    max_length?: number;
    required?: boolean;
    value?: string;
    placeholder?: string;
}

export enum TextInputStyle {
    Short = 1,
    Paragraph = 2,
}

export enum MessageComponentType {
    Script = 0, // self command script
    ActionRow = 1,
    Button = 2,
    StringSelect = 3,
    TextInput = 4,
    UserSelect = 5,
    RoleSelect = 6,
    MentionableSelect = 7,
    ChannelSelect = 8,
}

export interface Embed {
    title?: string; //title of embed
    type?: EmbedType; // type of embed (always "rich" for webhook embeds)
    description?: string; // description of embed
    url?: string; // url of embed
    timestamp?: Date; // timestamp of embed content
    color?: number; // color code of the embed
    footer?: {
        text: string;
        icon_url?: string;
        proxy_icon_url?: string;
    }; // footer object	footer information
    image?: EmbedImage; // image object	image information
    thumbnail?: EmbedImage; // thumbnail object	thumbnail information
    video?: EmbedImage; // video object	video information
    provider?: {
        name?: string;
        url?: string;
    }; // provider object	provider information
    author?: {
        name?: string;
        url?: string;
        icon_url?: string;
        proxy_icon_url?: string;
    }; // author object	author information
    fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
}

export enum EmbedType {
    rich = "rich",
    image = "image",
    video = "video",
    gifv = "gifv",
    article = "article",
    link = "link",
    auto_moderation_message = "auto_moderation_message",
}

export interface EmbedImage {
    url?: string;
    proxy_url?: string;
    height?: number;
    width?: number;
}

export interface Reaction {
    count: number;
    //// not saved in the database // me: boolean; // whether the current user reacted using this emoji
    emoji: PartialEmoji;
    user_ids: string[];
}

export interface PartialEmoji {
    id?: string;
    name: string;
    animated?: boolean;
}

export interface AllowedMentions {
    parse?: string[];
    roles?: string[];
    users?: string[];
    replied_user?: boolean;
}

export interface Poll {
    question: PollMedia;
    answers: PollAnswer[];
    expiry: Date;
    allow_multiselect: boolean;
    results?: PollResult;
}

export interface PollMedia {
    text?: string;
    emoji?: PartialEmoji;
}

export interface PollAnswer {
    answer_id?: string;
    poll_media: PollMedia;
}

export interface PollResult {
    is_finalized: boolean;
    answer_counts: PollAnswerCount[];
}

export interface PollAnswerCount {
    id: string;
    count: number;
    me_voted: boolean;
}

export interface MessageSnapshot {
    message: {
        attachments?: Attachment[];
        components?: ActionRowComponent[];
        content: string;
        edited_timestamp?: Date;
        embeds: Embed[];
        flags?: number;
        mention_roles: string[];
        mentions: string[];
        timestamp?: Date;
        type?: MessageType;
    };
}
