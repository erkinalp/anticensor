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
import { ConsentType } from "./UserConsent";
import { Snowflake } from "../util/Snowflake";

export enum ConsentGrantStatus {
    PENDING = "pending",
    APPROVED = "approved",
    DENIED = "denied",
    EXPIRED = "expired",
}

@Entity({ name: "consent_grants" })
@Index(["user_id", "requester_id", "service_id", "consent_type"])
export class ConsentGrant extends BaseClass {
    @Column()
    @Index()
    user_id: string;

    @Column()
    @Index()
    requester_id: string;

    @Column({ type: "varchar", default: ConsentType.CUSTOM })
    consent_type: ConsentType;

    @Column({ nullable: true })
    service_id?: string;

    @Column({ nullable: true })
    item_id?: string;

    @Column({ type: "varchar", default: ConsentGrantStatus.PENDING })
    status: ConsentGrantStatus;

    @Column()
    requested_at: Date = new Date();

    @Column({ nullable: true })
    responded_at?: Date;

    @Column({ nullable: true })
    expires_at?: Date;

    @Column({ nullable: true })
    interaction_url?: string;

    @Column({ nullable: true })
    continue_token?: string;

    @Column({ nullable: true })
    access_token?: string;

    @Column({ type: "simple-json", nullable: true })
    requested_access?: {
        type: string;
        actions?: string[];
        locations?: string[];
        datatypes?: string[];
    }[];

    @Column({ type: "simple-json", nullable: true })
    granted_access?: {
        type: string;
        actions?: string[];
        locations?: string[];
        datatypes?: string[];
    }[];

    @Column({ type: "simple-json", nullable: true })
    extra_data?: Record<string, unknown>;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user?: User;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "requester_id" })
    requester?: User;

    generateContinueToken(): string {
        this.continue_token = Snowflake.generate();
        return this.continue_token;
    }

    generateAccessToken(): string {
        this.access_token = Snowflake.generate();
        return this.access_token;
    }

    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            requester_id: this.requester_id,
            consent_type: this.consent_type,
            service_id: this.service_id,
            item_id: this.item_id,
            status: this.status,
            requested_at: this.requested_at,
            responded_at: this.responded_at,
            expires_at: this.expires_at,
            interaction_url: this.interaction_url,
            continue_token: this.continue_token,
            access_token: this.access_token,
            requested_access: this.requested_access,
            granted_access: this.granted_access,
            extra_data: this.extra_data,
        };
    }
}
