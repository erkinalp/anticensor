import { AutomodActionTypes } from "./Constants";
import { DiscordApiErrors } from "./Constants";
import { Channel, Message, Member } from "../entities";
import { MessageType, EmbedType } from "@spacebar/schemas";
import { emitEvent } from "./Event";

interface AutomodAction {
	type: number;
	metadata?: Record<string, unknown>;
}

interface AutomodActionContext {
	message: Message;
	channel: Channel;
	member?: Member;
	rule_name: string;
	matched_content?: string;
	keyword?: string;
}

export class AutomodActionExecutor {
	static async executeActions(actions: AutomodAction[], context: AutomodActionContext): Promise<void> {
		for (const action of actions) {
			try {
				await this.executeAction(action, context);
			} catch (error) {
				console.error(`Failed to execute automod action ${action.type}:`, error);
			}
		}
	}

	private static async executeAction(action: AutomodAction, context: AutomodActionContext): Promise<void> {
		switch (action.type) {
			case AutomodActionTypes.BLOCK_MESSAGE:
				await this.blockMessage(action, context);
				break;
			case AutomodActionTypes.SEND_ALERT:
				await this.sendAlert(action, context);
				break;
			case AutomodActionTypes.TIMEOUT_MEMBER:
				await this.timeoutMember(action, context);
				break;
			default:
				console.warn(`Unknown automod action type: ${action.type}`);
		}
	}

	private static async blockMessage(action: AutomodAction, context: AutomodActionContext): Promise<void> {
		throw DiscordApiErrors.AUTOMODERATOR_BLOCK;
	}

	private static async sendAlert(action: AutomodAction, context: AutomodActionContext): Promise<void> {
		const alertChannelId = action.metadata?.channel_id as string;
		if (!alertChannelId) return;

		const alertChannel = await Channel.findOne({
			where: { id: alertChannelId },
		});
		if (!alertChannel) return;

		const decisionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

		const createdMessage = Message.create({
			channel_id: alertChannelId,
			guild_id: alertChannel.guild_id,
			// Use Spacebar system account (4) instead of triggering user for privacy
			// (prevents "victim chasing" where author's friends harass the flagged user)
			author_id: "4",
			content: "",
			type: MessageType.AUTO_MODERATION_ACTION,
			reactions: [],
			embeds: [
				{
					type: EmbedType.auto_moderation_message,
					description: context.message.content?.substring(0, 500) || "",
					fields: [
						{
							name: "rule_name",
							value: context.rule_name,
							inline: false,
						},
						{
							name: "decision_id",
							value: decisionId,
							inline: false,
						},
						{
							name: "channel_id",
							value: context.channel.id,
							inline: false,
						},
						{
							name: "flagged_message_id",
							value: context.message.id,
							inline: false,
						},
						...(context.keyword
							? [
									{
										name: "keyword",
										value: context.keyword,
										inline: false,
									},
								]
							: []),
						...(context.matched_content
							? [
									{
										name: "keyword_matched_content",
										value: context.matched_content,
										inline: false,
									},
								]
							: []),
						{
							name: "decision_outcome",
							value: "blocked",
							inline: false,
						},
					],
				},
			],
			timestamp: new Date(),
		});
		await Promise.all([
			Message.insert(createdMessage),
			emitEvent({
				event: "MESSAGE_CREATE",
				channel_id: alertChannelId,
				data: createdMessage,
			}),
		]);
	}

	private static async timeoutMember(action: AutomodAction, context: AutomodActionContext): Promise<void> {
		if (!context.member || !context.channel.guild_id) return;

		const durationSeconds = (action.metadata?.duration_seconds as number) || 60;
		const timeoutUntil = new Date(Date.now() + durationSeconds * 1000);

		await Member.update({ id: context.member.id, guild_id: context.channel.guild_id }, { communication_disabled_until: timeoutUntil });

		await emitEvent({
			event: "GUILD_MEMBER_UPDATE",
			guild_id: context.channel.guild_id,
			data: {
				...context.member,
				communication_disabled_until: timeoutUntil,
			},
		});
	}
}
