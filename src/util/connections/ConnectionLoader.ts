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

import { Connection, Config } from "@spacebar/util";
import fs from "fs";
import path from "path";
import { ConnectionConfig } from "./ConnectionConfig";
import { ConnectionStore } from "./ConnectionStore";

const root = path.join(__dirname, "..", "..", "connections");
const connectionsLoaded = false;

export class ConnectionLoader {
	public static async loadConnections() {
		if (connectionsLoaded) return;
		ConnectionConfig.init();
		const dirs = fs.readdirSync(root).filter((x) => {
			try {
				fs.readdirSync(path.join(root, x));
				return true;
			} catch (e) {
				return false;
			}
		});

		dirs.forEach(async (x) => {
			const modPath = path.resolve(path.join(root, x));
			const mod = new (require(modPath).default)() as Connection;

			const config = Config.get().connections;
			if (
				config.providers.length > 0 &&
				!config.providers.includes(mod.id)
			) {
				return;
			}

			ConnectionStore.connections.set(mod.id, mod);

			mod.init();
			// console.log(`[Connections] Loaded connection '${mod.id}'`);
		});
	}

	public static getConnectionConfig<T>(id: string, defaults?: unknown): T {
		let cfg = ConnectionConfig.get()[id];
		if (defaults) {
			if (cfg) cfg = Object.assign({}, defaults, cfg);
			else {
				cfg = defaults;
				this.setConnectionConfig(id, cfg);
			}
		}

		if (cfg?.enabled) console.log(`[Connections] ${id} enabled`);

		// if (!cfg)
		// 	console.log(
		// 		`[ConnectionConfig/WARN] Getting connection settings for '${id}' returned null! (Did you forget to add settings?)`,
		// 	);
		return cfg;
	}

	public static async setConnectionConfig(
		id: string,
		config: Partial<unknown>,
	): Promise<void> {
		if (!config)
			console.warn(`[Connections/WARN] ${id} tried to set config=null!`);

		await ConnectionConfig.set({
			[id]: Object.assign(
				config,
				ConnectionLoader.getConnectionConfig(id) || {},
			),
		});
	}
}
