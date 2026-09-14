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

import "../util/initEnv.js";

import { checkToken, closeDatabase, Config, initDatabase, initEvent, Rights } from "#harmony/util";
import { Connection, openConnections } from "./events/Connection.js";
import http from "http";
import { cleanupOnStartup } from "./util/index.js";
import { randomString } from "#harmony/api";
import { setInterval } from "timers";
import * as ws from "ws";

export class Server {
    public ws: ws.Server;
    public port: number;
    public server: http.Server;
    public production: boolean;

    constructor({ port, server, production }: { port: number; server?: http.Server; production?: boolean }) {
        this.port = port;
        this.production = production ?? false;

        if (server) this.server = server;
        else {
            const elu = [1, 5, 15].map(() => performance.eventLoopUtilization());
            const eluP = [1, 5, 15].map(() => performance.eventLoopUtilization());
            const cpu = [1, 5, 15].map(() => process.cpuUsage());
            let sec = 0;
            setInterval(() => {
                sec += 1;
                // for some reason this behaves differently from cpuUsage, so we need an absolute reference as "previous"
                const eluC = performance.eventLoopUtilization();

                cpu[0] = process.cpuUsage(cpu[0]);
                elu[0] = performance.eventLoopUtilization(eluP[0]);
                eluP[0] = eluC;
                if (sec % 5 === 0) {
                    cpu[1] = process.cpuUsage(cpu[1]);
                    elu[1] = performance.eventLoopUtilization(eluP[1]);
                    eluP[1] = eluC;
                }
                if (sec % 15 === 0) {
                    cpu[2] = process.cpuUsage(cpu[2]);
                    elu[2] = performance.eventLoopUtilization(eluP[2]);
                    eluP[2] = eluC;
                }
            }, 1000);

            this.server = http.createServer(async (req, res) => {
                if (!req.headers.cookie?.split("; ").find((x) => x.startsWith("__sb_sessid="))) {
                    res.setHeader("Set-Cookie", `__sb_sessid=${randomString(32)}; Secure; HttpOnly; SameSite=None; Path=/`);
                }

                res.writeHead(200).end("Online");
            });
        }

        this.server.on("upgrade", (request, socket, head) => {
            this.ws.handleUpgrade(request, socket, head, (socket) => {
                this.ws.emit("connection", socket, request);
            });
        });

        this.ws = new ws.WebSocketServer({
            maxPayload: 4096,
            noServer: true,
        });
        this.ws.on("connection", Connection);
        this.ws.on("error", console.error);
    }

    async start(): Promise<void> {
        await initDatabase();
        await Config.init();
        await initEvent();
        // temporary fix
        await cleanupOnStartup();

        if (!this.server.listening) {
            this.server.listen(this.port);
            console.log(`[Gateway] online on 0.0.0.0:${this.port}`);
        }
    }

    async stop() {
        this.ws.clients.forEach((x) => x.close());
        this.ws.close(() => {
            this.server.close(() => {
                closeDatabase();
            });
        });
    }
}
