process.env.DB_SYNC = "1";
process.env.DATABASE = "./.tmp/banlist-sqlite-test.sqlite";

require("module-alias/register");

const fs = require("fs");
const path = require("path");

(async () => {
	const outDir = fs.existsSync(path.join(__dirname, "..", "dist"))
		? "dist"
		: "build";
	const dbModulePath = path.join(
		__dirname,
		"..",
		outDir,
		"util",
		"util",
		"Database.js",
	);
	const { initDatabase } = require(dbModulePath);
	const ds = await initDatabase();

	const sqlite3 = require("sqlite3").verbose();
	fs.mkdirSync(path.dirname(process.env.DATABASE), { recursive: true });
	const db = new sqlite3.Database(process.env.DATABASE);

	const run = (sql, params = []) =>
		new Promise((resolve, reject) =>
			db.run(sql, params, function (err) {
				if (err) reject(err);
				else resolve(this);
			}),
		);
	const all = (sql, params = []) =>
		new Promise((resolve, reject) =>
			db.all(sql, params, (err, rows) =>
				err ? reject(err) : resolve(rows),
			),
		);

	const tables = await all(
		"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ban_lists','ban_list_entries','ban_list_subscriptions')",
	);
	if (tables.length < 3)
		throw new Error("Missing required tables in SQLite schema sync");

	await run(
		"INSERT INTO ban_lists(id,name,description,creator_id,creator_type,is_public,created_at,updated_at) VALUES(?,?,?,?,?,0,datetime('now'),datetime('now'))",
		["L1", "Test", null, "U1", "group"],
	);

	await run(
		"INSERT INTO ban_list_subscriptions(id,subscriber_id,subscriber_type,ban_list_id,created_at) VALUES(?,?,?,?,datetime('now'))",
		["S1", "G1", "guild", "L1"],
	);

	let duplicateFailed = false;
	try {
		await run(
			"INSERT INTO ban_list_subscriptions(id,subscriber_id,subscriber_type,ban_list_id,created_at) VALUES(?,?,?,?,datetime('now'))",
			["S2", "G1", "guild", "L1"],
		);
	} catch (e) {
		duplicateFailed = true;
	}
	if (!duplicateFailed)
		throw new Error(
			"Expected UNIQUE constraint on (subscriber_id, subscriber_type, ban_list_id) not enforced",
		);

	await ds.destroy();
	db.close();

	try {
		fs.rmSync(path.join(__dirname, "..", ".tmp"), {
			recursive: true,
			force: true,
		});
	} catch {}

	console.log("SQLite schema verification: OK");
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
