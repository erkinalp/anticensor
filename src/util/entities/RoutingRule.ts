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

import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseClass } from "./BaseClass";
import { Channel } from "./Channel";
import { Role } from "./Role";
import { Message } from "./Message";
import { HTTPError } from "lambert-server";
import { Snowflake } from "../util/Snowflake";
import { getPermission } from "../util/Permissions";
@Entity({
    name: "routing_rules",
})
export class RoutingRule extends BaseClass {
    @Column()
    registration_timestamp: string;

    @Column()
    source_channel_id: string;

    @Column()
    storage_channel_id: string;

    @Column({ nullable: true })
    sink_channel_id?: string;

    @Column({ nullable: true })
    target_role_id?: string;

    @Column({ nullable: true, type: "varchar" })
    target_role_guild_id?: string | null;

    @Column({ type: "simple-json" })
    source_users: string[];

    @Column({ type: "simple-json" })
    target_users: string[];

    @Column()
    valid_since: string;

    @Column()
    valid_until: string;

    @ManyToOne(() => Channel, { onDelete: "CASCADE" })
    @JoinColumn({ name: "source_channel_id" })
    source_channel?: Channel;

    @ManyToOne(() => Channel, { onDelete: "CASCADE" })
    @JoinColumn({ name: "storage_channel_id" })
    storage_channel?: Channel;

    @ManyToOne(() => Channel, { onDelete: "CASCADE" })
    @JoinColumn({ name: "sink_channel_id" })
    sink_channel?: Channel;

    @ManyToOne(() => Role, { onDelete: "CASCADE" })
    @JoinColumn({ name: "target_role_id" })
    target_role?: Role;

    isIntimacyBroadcast(): boolean {
        return this.target_role_id !== undefined && this.target_role_id !== null && this.target_role_guild_id === null;
    }

    static async validateInvariants(rule: Partial<RoutingRule>, isUpdate = false): Promise<void> {
        if (!rule.registration_timestamp && !isUpdate) {
            rule.registration_timestamp = Snowflake.generate();
        }

        if (rule.valid_since && rule.registration_timestamp && BigInt(rule.valid_since) < BigInt(rule.registration_timestamp)) {
            throw new HTTPError("valid_since cannot be earlier than registration_timestamp", 400);
        }

        if (rule.valid_until && rule.valid_since && BigInt(rule.valid_until) < BigInt(rule.valid_since)) {
            throw new HTTPError("valid_until cannot be earlier than valid_since", 400);
        }

        if (!isUpdate && rule.source_channel_id && rule.source_users) {
            const sourceChannel = await Channel.findOne({
                where: { id: rule.source_channel_id },
            });
            if (!sourceChannel) {
                throw new HTTPError("Source channel not found", 404);
            }

            for (const userId of rule.source_users) {
                try {
                    const permission = await getPermission(userId, sourceChannel.guild_id, rule.source_channel_id);
                    permission.hasThrow("SEND_MESSAGES");
                } catch (e) {
                    throw new HTTPError(`User ${userId} does not have SEND_MESSAGES permission in source channel`, 403);
                }
            }
        }

        if (!isUpdate && rule.source_channel_id && rule.target_users) {
            const sourceChannel = await Channel.findOne({
                where: { id: rule.source_channel_id },
            });
            if (!sourceChannel) {
                throw new HTTPError("Source channel not found", 404);
            }

            for (const userId of rule.target_users) {
                try {
                    const permission = await getPermission(userId, sourceChannel.guild_id, rule.source_channel_id);
                    permission.hasThrow("READ_MESSAGE_HISTORY");
                } catch (e) {
                    throw new HTTPError(`User ${userId} does not have READ_MESSAGE_HISTORY permission in source channel`, 403);
                }
            }
        }
    }

    static async canDelete(rule_id: string): Promise<boolean> {
        const rule = await RoutingRule.findOne({
            where: { id: rule_id },
            relations: ["source_channel", "storage_channel", "sink_channel"],
        });

        if (!rule) {
            return true;
        }

        if (!rule.source_channel || !rule.storage_channel || !rule.sink_channel) {
            return true;
        }

        const now = Snowflake.generate();
        const isInEffect = BigInt(rule.valid_since) <= BigInt(now) && BigInt(now) <= BigInt(rule.valid_until);

        if (isInEffect) {
            return false;
        }

        const affectedMessages = await Message.count({
            where: {
                channel_id: rule.storage_channel_id,
                source_channel_id: rule.source_channel_id,
            },
        });

        return affectedMessages === 0;
    }

    isActive(): boolean {
        const now = Snowflake.generate();
        return BigInt(this.valid_since) <= BigInt(now) && BigInt(now) <= BigInt(this.valid_until);
    }
}
