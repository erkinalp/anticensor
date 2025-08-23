import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseClass } from "./BaseClass";
import { User } from "./User";
import { dbEngine } from "../util/Database";

@Entity({ name: "user_consents", engine: dbEngine })
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
