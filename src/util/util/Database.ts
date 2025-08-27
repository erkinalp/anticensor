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

import { config } from "dotenv";
import path from "path";
import { green, red, yellow } from "picocolors";
import { DataSource } from "typeorm";
import { ConfigEntity } from "../entities/Config";
import { Migration } from "../entities/Migration";
import { Config } from "./Config";

// UUID extension option is only supported with postgres
// We want to generate all id's with Snowflakes that's why we have our own BaseEntity class

let dbConnection: DataSource | undefined;

// For typeorm cli
if (!process.env) {
	config();
}

const dbConnectionString =
	process.env.DATABASE || path.join(process.cwd(), "database.db");

const DatabaseType = dbConnectionString.includes("://")
	? dbConnectionString.split(":")[0]?.replace("+srv", "")
	: "sqlite";
const isSqlite = DatabaseType.includes("sqlite");

let DataSourceOptions: DataSource;

// Gets the existing database connection
export function getDatabase(): DataSource | null {
	// if (!dbConnection) throw new Error("Tried to get database before it was initialised");
	if (!dbConnection) return null;
	return dbConnection;
}

// Called once on server start
export async function initDatabase(): Promise<DataSource> {
	if (dbConnection) return dbConnection;

	const isVolatileMode =
		process.env.VOLATILE_MODE === "true" ||
		(Config.get()?.general?.volatileMode ?? false);

	const finalDbConnectionString = isVolatileMode
		? ":memory:"
		: dbConnectionString;
	const finalDatabaseType = isVolatileMode ? "sqlite" : DatabaseType;
	const finalIsSqlite = isVolatileMode || isSqlite;

	DataSourceOptions = new DataSource({
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		//@ts-ignore type 'string' is not 'mysql' | 'sqlite' | 'mariadb' | etc etc
		type: finalDatabaseType,
		charset: "utf8mb4",
		url: finalIsSqlite ? undefined : finalDbConnectionString,
		database: finalIsSqlite ? finalDbConnectionString : undefined,
		entities: [path.join(__dirname, "..", "entities", "*.js")],
		synchronize: !!process.env.DB_SYNC || isVolatileMode,
		logging: !!process.env.DB_LOGGING,
		bigNumberStrings: false,
		supportBigNumbers: true,
		name: "default",
		migrations: [
			path.join(__dirname, "..", "migration", finalDatabaseType, "*.js"),
		],
	});

	if (isVolatileMode) {
		console.log(
			`[Database] ${yellow(
				`Running in VOLATILE MODE - all data will be stored in memory and lost on restart!`,
			)}`,
		);
	} else if (finalIsSqlite && !isVolatileMode) {
		console.log(
			`[Database] ${red(
				`You are running sqlite! Please keep in mind that we recommend setting up a dedicated database!`,
			)}`,
		);
	}

	if (!process.env.DB_SYNC && !isVolatileMode) {
		const supported = ["mysql", "mariadb", "postgres", "sqlite"];
		if (!supported.includes(finalDatabaseType)) {
			console.log(
				"[Database]" +
					red(
						` We don't have migrations for DB type '${finalDatabaseType}'` +
							` To ignore, set DB_SYNC=true in your env. https://docs.spacebar.chat/setup/server/configuration/env/`,
					),
			);
			process.exit();
		}
	}

	console.log(
		`[Database] ${yellow(`Connecting to ${finalDatabaseType} db`)}`,
	);

	dbConnection = await DataSourceOptions.initialize();

	// Crude way of detecting if the migrations table exists.
	const dbExists = async () => {
		try {
			await ConfigEntity.count();
			return true;
		} catch (e) {
			return false;
		}
	};
	if (!(await dbExists())) {
		console.log(
			"[Database] This appears to be a fresh database. Synchronising.",
		);
		await dbConnection.synchronize();

		// On next start, typeorm will try to run all the migrations again from beginning.
		// Manually insert every current migration to prevent this:
		await Promise.all(
			dbConnection.migrations.map((migration) =>
				Migration.insert({
					name: migration.name,
					timestamp: Date.now(),
				}),
			),
		);
	} else {
		console.log("[Database] Applying missing migrations, if any.");
		await dbConnection.runMigrations();
	}

	console.log(`[Database] ${green("Connected")}`);

	return dbConnection;
}

export { DataSourceOptions, DatabaseType, dbConnection };

export async function closeDatabase() {
	await dbConnection?.destroy();
}

export const dbEngine =
	"InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
