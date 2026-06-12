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
import { User } from "./User";
import { Guild } from "./Guild";

export enum SubscriptionStatus {
    ACTIVE = 0,
    ENDING = 1,
    INACTIVE = 2,
}

@Entity({ name: "subscriptions" })
export class Subscription extends BaseClass {
    @Column()
    @RelationId((s: Subscription) => s.user)
    user_id: string;

    @JoinColumn({ name: "user_id" })
    @ManyToOne(() => User, { onDelete: "CASCADE" })
    user: User;

    @Column({ nullable: true })
    @RelationId((s: Subscription) => s.guild)
    guild_id?: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, { onDelete: "CASCADE", nullable: true })
    guild?: Guild;

    @Column({ type: "varchar", array: true })
    sku_ids: string[];

    @Column({ type: "varchar", array: true, default: "{}" })
    entitlement_ids: string[];

    @Column({ type: "varchar", array: true, nullable: true })
    renewal_sku_ids?: string[];

    @Column()
    current_period_start: Date;

    @Column()
    current_period_end: Date;

    @Column({ default: SubscriptionStatus.ACTIVE })
    status: SubscriptionStatus;

    @Column({ nullable: true })
    canceled_at?: Date;

    @Column({ nullable: true })
    country?: string;

    @Column({ nullable: true })
    payment_gateway?: string;

    @Column({ nullable: true })
    payment_gateway_subscription_id?: string;

    @Column({ nullable: true })
    currency?: string;

    @Column({ nullable: true })
    price?: number;
}
