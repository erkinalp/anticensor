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

@Entity({ name: "guild_subscription_tiers" })
export class GuildSubscriptionTier extends BaseClass {
    @Column()
    @RelationId((tier: GuildSubscriptionTier) => tier.guild)
    guild_id: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, { onDelete: "CASCADE" })
    guild: Guild;

    @Column()
    name: string;

    @Column({ nullable: true })
    description?: string;

    @Column({ nullable: true })
    image?: string;

    @Column()
    position: number;

    @Column({ type: "jsonb" })
    price: { amount: number; currency: string };

    @Column({ type: "varchar", array: true, default: "{}" })
    role_ids: string[];

    @Column({ type: "varchar", array: true, default: "{}" })
    channel_ids: string[];

    @Column({ default: true })
    published: boolean;

    @Column({ default: false })
    archived: boolean;
}
