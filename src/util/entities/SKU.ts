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
import { Application } from "./Application";

export enum SKUType {
    DURABLE = 2,
    CONSUMABLE = 3,
    SUBSCRIPTION = 5,
    SUBSCRIPTION_GROUP = 6,
}

export enum SKUAccessType {
    FULL = 1,
    EARLY_ACCESS = 2,
}

export enum SKUFlags {
    AVAILABLE = 1 << 2,
    GUILD_SUBSCRIPTION = 1 << 7,
    USER_SUBSCRIPTION = 1 << 8,
}

@Entity({ name: "skus" })
export class SKU extends BaseClass {
    @Column()
    @RelationId((sku: SKU) => sku.application)
    application_id: string;

    @JoinColumn({ name: "application_id" })
    @ManyToOne(() => Application, { onDelete: "CASCADE" })
    application: Application;

    @Column()
    type: SKUType;

    @Column()
    name: string;

    @Column({ nullable: true })
    slug?: string;

    @Column({ default: 0 })
    flags: number;

    @Column({ nullable: true })
    summary?: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ default: SKUAccessType.FULL })
    access_type: SKUAccessType;

    @Column({ nullable: true })
    dependent_sku_id?: string;

    @Column({ type: "jsonb", nullable: true })
    features?: number[];

    @Column({ nullable: true })
    release_date?: string;

    @Column({ default: false })
    premium: boolean;

    @Column({ nullable: true })
    legal_notice?: string;

    @Column({ type: "jsonb", nullable: true })
    price?: { currency: string; amount: number; exponent: number };

    @Column({ nullable: true })
    price_tier?: number;

    @Column({ default: true })
    show_age_gate: boolean;
}
