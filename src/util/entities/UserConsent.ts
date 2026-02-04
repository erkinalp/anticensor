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

import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseClass } from "./BaseClass";
import { User } from "./User";

export enum ConsentType {
    MEDIA_ITEM = "media_item",
    MESSAGE_ITEM = "message_item",
    EXTERNAL_DATA_PROCESSING = "external_data_processing",
    BOTS_AI = "bots_ai",
    CUSTOM = "custom",
}

export enum ConsentStatus {
    PENDING = "pending",
    GRANTED = "granted",
    PROVISIONAL = "provisional",
    RETRACTED = "retracted",
}

@Entity({ name: "user_consents" })
@Index(["user_id", "service_id", "consent_type", "item_id", "target_user_id"], {
    unique: true,
})
export class UserConsent extends BaseClass {
    @Column()
    @Index()
    user_id: string;

    @Column()
    service_id: string;

    @Column({ type: "varchar", default: ConsentType.CUSTOM })
    consent_type: ConsentType;

    @Column({ nullable: true })
    @Index()
    item_id?: string;

    @Column({ nullable: true })
    @Index()
    target_user_id?: string;

    @Column({ type: "varchar", default: ConsentStatus.GRANTED })
    status: ConsentStatus;

    @Column({ nullable: true })
    basis_document_url?: string;

    @Column({ nullable: true })
    basis_document_hash?: string;

    @Column({ nullable: true })
    granted_at?: Date;

    @Column({ nullable: true })
    retracted_at?: Date;

    @Column({ nullable: true })
    expires_at?: Date;

    @Column({ type: "simple-json", nullable: true })
    extra_data?: Record<string, unknown>;

    @Column()
    created_at: Date = new Date();

    @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user?: User;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "target_user_id" })
    target_user?: User;

    toJSON() {
        return {
            id: this.id,
            service_id: this.service_id,
            consent_type: this.consent_type,
            item_id: this.item_id,
            target_user_id: this.target_user_id,
            status: this.status,
            basis_document_url: this.basis_document_url,
            basis_document_hash: this.basis_document_hash,
            granted_at: this.granted_at,
            retracted_at: this.retracted_at,
            expires_at: this.expires_at,
            extra_data: this.extra_data,
            created_at: this.created_at,
        };
    }
}
