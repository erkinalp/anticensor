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

import { Column, Entity } from "typeorm";
import { BaseClass } from "./BaseClass";
import { dbEngine } from "../util/Database";

export enum BanListCreatorType {
	user = "user",
	channel = "channel",
	role = "role",
	guild = "guild",
}

@Entity({
	name: "ban_lists",
	engine: dbEngine,
})
export class BanList extends BaseClass {
	@Column({ type: "varchar", length: 255 })
	name: string;

	@Column({ type: "text", nullable: true })
	description?: string;

	@Column()
	creator_id: string;

	@Column({ type: "enum", enum: BanListCreatorType })
	creator_type: BanListCreatorType;

	@Column({ type: "boolean", default: false })
	is_public: boolean;

	@Column()
	created_at: Date;

	@Column()
	updated_at: Date;

	toPublicBanList() {
		return {
			id: this.id,
			name: this.name,
			description: this.description,
			creator_id: this.creator_id,
			creator_type: this.creator_type,
			is_public: this.is_public,
			created_at: this.created_at,
			updated_at: this.updated_at,
		};
	}
}
