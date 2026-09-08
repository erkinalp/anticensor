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

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

import { Server } from "./Server.js";
import "../util/initEnv.js";

import fs from "fs";
import cluster from "cluster";

const port = Number(process.env.WRTC_WS_PORT || process.env.PORT || 3004);

const server = new Server({
    port,
});

if (fs.existsSync("/proc/self/comm")) fs.writeFileSync("/proc/self/comm", `spacebar-wrtc-${cluster.worker ? cluster.worker.id : port}`);
process.title = `sb-wrtc-${cluster.worker ? cluster.worker.id : port}`;

server.start().catch((e) => console.error("Failed to start WebRTC server:", e));
