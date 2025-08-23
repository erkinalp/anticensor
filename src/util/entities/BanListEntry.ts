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
import { dbEngine } from "../util/Database";

@Entity({
	name: "ban_list_entries",
	engine: dbEngine,
})
@Index(["ban_list_id", "banned_user_id"], { unique: true })
@Index(["banned_user_id"])
export class BanListEntry extends BaseClass {
	@Column({})
	@RelationId((entry: BanListEntry) => entry.ban_list)
	ban_list_id: string;

	@JoinColumn({ name: "ban_list_id" })
	@ManyToOne(() => require("./BanList").BanList, {
		onDelete: "CASCADE",
	})
	ban_list: import("./BanList").BanList;

	@Column({})
	@RelationId((entry: BanListEntry) => entry.banned_user)
	banned_user_id: string;

	@JoinColumn({ name: "banned_user_id" })
	@ManyToOne(() => User, {
		onDelete: "CASCADE",
	})
	banned_user: User;

	@Column({ type: "text", nullable: true })
	reason?: string;

	@Column()
	created_at: Date;

	toPublicBanListEntry() {
		return {
			id: this.id,
			ban_list_id: this.ban_list_id,
			banned_user_id: this.banned_user_id,
			banned_user: this.banned_user?.toPublicUser(),
			reason: this.reason,
			created_at: this.created_at,
		};
	}
}
