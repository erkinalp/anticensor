import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseClass } from "./BaseClass";
import { User } from "./User";

export enum ConsentType {
    DATA_PROCESSING = "data_processing",
    MARKETING = "marketing",
    THIRD_PARTY_SHARING = "third_party_sharing",
    CUSTOM = "custom",
}

export enum ConsentStatus {
    GRANTED = "granted",
    PROVISIONAL = "provisional",
    RETRACTED = "retracted",
}

@Entity({ name: "user_consents" })
@Index(["user_id", "service_id"], { unique: true })
export class UserConsent extends BaseClass {
    @Column()
    user_id: string;

    @Column()
    service_id: string;

    @Column()
    created_at: Date = new Date();

    @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
    user?: User;
}
