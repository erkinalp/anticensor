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
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	RelationId,
} from "typeorm";
import { BaseClass } from "./BaseClass";
import { User } from "./User";
import { Channel } from "./Channel";
import { Guild } from "./Guild";
import { BanList } from "./BanList";
import { dbEngine } from "../util/Database";

export enum BanListSubscriberType {
	user = "user",
	channel = "channel",
	guild = "guild",
}

@Entity({
	name: "ban_list_subscriptions",
	engine: dbEngine,
})
@Index(["subscriber_id", "subscriber_type", "ban_list_id"], { unique: true })
@Index(["subscriber_id", "subscriber_type"])
@Index(["ban_list_id"])
export class BanListSubscription extends BaseClass {
	@Column({})
	@RelationId(
		(subscription: BanListSubscription) => subscription.subscriber_user,
	)
	subscriber_id: string;

	@Column({ type: "enum", enum: BanListSubscriberType })
	subscriber_type: BanListSubscriberType;

	@JoinColumn({ name: "subscriber_id" })
	@ManyToOne(() => User, {
		onDelete: "CASCADE",
	})
	subscriber_user?: User;

	@JoinColumn({ name: "subscriber_id" })
	@ManyToOne(() => Channel, {
		onDelete: "CASCADE",
	})
	subscriber_channel?: Channel;

	@JoinColumn({ name: "subscriber_id" })
	@ManyToOne(() => Guild, {
		onDelete: "CASCADE",
	})
	subscriber_guild?: Guild;

	@Column({})
	@RelationId((subscription: BanListSubscription) => subscription.ban_list)
	ban_list_id: string;

	@JoinColumn({ name: "ban_list_id" })
	@ManyToOne(() => BanList, {
		onDelete: "CASCADE",
	})
	ban_list: BanList;

	@Column()
	created_at: Date;

	toPublicBanListSubscription() {
		return {
			id: this.id,
			subscriber_id: this.subscriber_id,
			subscriber_type: this.subscriber_type,
			ban_list_id: this.ban_list_id,
			created_at: this.created_at,
		};
	}
}
