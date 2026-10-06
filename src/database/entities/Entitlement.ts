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
import { SKU } from "./SKU";
import { Application } from "./Application";
import { User } from "./User";
import { Guild } from "./Guild";

export enum EntitlementType {
    PURCHASE = 1,
    PREMIUM_SUBSCRIPTION = 2,
    DEVELOPER_GIFT = 3,
    TEST_MODE_PURCHASE = 4,
    FREE_PURCHASE = 5,
    USER_GIFT = 6,
    PREMIUM_PURCHASE = 7,
    APPLICATION_SUBSCRIPTION = 8,
}

@Entity({ name: "entitlements" })
export class Entitlement extends BaseClass {
    @Column()
    @RelationId((e: Entitlement) => e.sku)
    sku_id: string;

    @JoinColumn({ name: "sku_id" })
    @ManyToOne(() => SKU, { onDelete: "CASCADE" })
    sku: SKU;

    @Column()
    @RelationId((e: Entitlement) => e.application)
    application_id: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application, { onDelete: "CASCADE" })
    application: Application;

    @Column({ nullable: true })
    @RelationId((e: Entitlement) => e.user)
    user_id?: string;

    @JoinColumn({ name: "user_id" })
    @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
    user?: User;

    @Column({ nullable: true })
    @RelationId((e: Entitlement) => e.guild)
    guild_id?: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, { onDelete: "CASCADE", nullable: true })
    guild?: Guild;

    @Column()
    type: EntitlementType;

    @Column({ default: false })
    deleted: boolean;

    @Column({ nullable: true })
    starts_at?: Date;

    @Column({ nullable: true })
    ends_at?: Date;

    @Column({ default: false })
    consumed: boolean;

    @Column({ nullable: true })
    subscription_id?: string;

    @Column({ nullable: true })
    promotion_id?: string;

    @Column({ default: 0 })
    gift_code_flags: number;
}
