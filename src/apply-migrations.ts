process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
import "./util/initEnv.js";

process.env.DB_LOGGING = "true";

import { closeDatabase, initDatabase } from "#harmony/util";

async function main() {
    let success = false;
    while (!success) {
        try {
            await initDatabase().then(async () => {
                await closeDatabase().then(async () => {
                    console.log("Successfully applied migrations!");
                    success = true;
                });
            });
        } catch (e) {
            console.error("Failed to apply migrations, retrying in 2s...", e);
            await new Promise((res) => setTimeout(res, 2000));
            await main();
        }
    }
}

main().then(() => console.log("meow"));
