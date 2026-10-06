/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { Column, Entity, JoinColumn, ManyToOne, RelationId } from "typeorm";
import { BaseClass } from "./BaseClass";
import { Guild } from "./Guild";
import { GuildSubscriptionTier } from "./GuildSubscriptionTier";

export enum GuildMemberSubscriptionStatus {
    ACTIVE = 0,
    ENDING = 1,
    INACTIVE = 2,
}

@Entity({ name: "guild_member_subscriptions" })
export class GuildMemberSubscription extends BaseClass {
    @Column()
    @RelationId((sub: GuildMemberSubscription) => sub.guild)
    guild_id: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, { onDelete: "CASCADE" })
    guild: Guild;

    @Column()
    user_id: string;

    @Column()
    @RelationId((sub: GuildMemberSubscription) => sub.tier)
    tier_id: string;

    @JoinColumn({ name: "tier_id" })
    @ManyToOne(() => GuildSubscriptionTier, { onDelete: "CASCADE" })
    tier: GuildSubscriptionTier;

    @Column({ type: "timestamptz" })
    current_period_start: Date;

    @Column({ type: "timestamptz" })
    current_period_end: Date;

    @Column({ default: GuildMemberSubscriptionStatus.ACTIVE })
    status: GuildMemberSubscriptionStatus;

    @Column({ nullable: true })
    ended_at?: Date;
}
