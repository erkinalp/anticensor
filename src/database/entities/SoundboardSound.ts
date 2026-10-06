/*
	Harmony: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Harmony and Harmony Contributors

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

import { Column, Entity, JoinColumn, ManyToOne, Relation } from "typeorm";
import { BaseClass } from "./BaseClass";
import { Guild } from "./Guild";
import { User } from "./User";
import { Emoji } from "./Emoji";

@Entity({
    name: "soundboard_sound",
})
export class SoundboardSound extends BaseClass {
    @Column()
    name: string;

    @Column()
    volume: number;

    @Column({ nullable: true })
    emoji_id?: string;

    @JoinColumn({ name: "emoji_id" })
    @ManyToOne(() => Guild, (guild) => guild.stickers, {
        onDelete: "SET NULL",
    })
    emoji?: Relation<Emoji>;

    @Column({ nullable: true })
    emoji_name?: string;

    @Column({ nullable: true })
    guild_id?: string;

    @JoinColumn({ name: "guild_id" })
    @ManyToOne(() => Guild, (guild) => guild.stickers, {
        onDelete: "CASCADE",
    })
    guild?: Relation<Guild>;

    //We don't need to have this be a real value lol
    available = true;

    @Column({ nullable: true })
    user_id?: string;

    @JoinColumn({ name: "user_id" })
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    user?: Relation<User>;

    toJSON(canManage = false) {
        return {
            sound_id: this.id,
            name: this.name,
            volume: this.volume,
            emoji_id: this.emoji_id,
            emoji_name: this.emoji_name,
            guild_id: this.guild_id || undefined,
            available: this.available,
            user: canManage ? this.user : undefined,
            user_id: canManage ? this.user_id : undefined,
        };
    }
}
