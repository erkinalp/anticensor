/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2026 Spacebar and Spacebar Contributors

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

import { BaseEventWriter } from "./BaseEventWriter";
import amqp, { Channel, ChannelModel } from "amqplib";
import { Event, sleep } from "@spacebar/util";
import { ProcessLifecycle } from "../../ProcessLifecycle";

export class RabbitMqSingleWriter extends BaseEventWriter {
    private readonly host: string;
    private connection?: ChannelModel;
    private channel?: Channel;
    private intentionalClose = false;

    constructor(host: string) {
        super();
        this.host = host;
    }

    async init(): Promise<void> {
        while (!this.connection) {
            try {
                console.log(`[RabbitMQSingleWriter] Connecting to: ${this.host}`);
                this.connection = await amqp.connect(this.host, {
                    timeout: 1000 * 60,
                    noDelay: true,
                });
                console.log(`[RabbitMQSingleWriter] Connected to: ${this.host}`);
            } catch (e) {
                console.log(`[RabbitMQSingleWriter] Failed to connect to to: ${this.host}: ${e}`);
                await sleep(1000);
            }
        }
        this.channel = await this.connection.createChannel();

        ProcessLifecycle.eventEmitter.on("stopped", async () => await this.close());
        this.connection.on("error", (err) => {
            console.error("[RabbitMQSingleWriter] Connection error:", err);
        });

        this.connection.on("close", () => {
            console.error("[RabbitMQSingleWriter] Connection closed");
            if (this.intentionalClose) return;
            sleep(1000).then(() => {
                this.init().catch((e) => console.error("[RabbitMQSingleWriter] Failed to schedule reconnection:", e));
            });
        });
    }

    async close(): Promise<void> {
        this.intentionalClose = true;
        await this.channel?.close();
        this.channel = undefined;
        await this.connection?.close();
        this.connection = undefined;
    }

    async emit(event: Event): Promise<void> {
        if (!this.connection) {
            throw new Error("RabbitMqSingleWriter#emit called without connection being initialised!");
        }
        if (!this.channel) {
            throw new Error("RabbitMqSingleWriter#emit called without channel being initialised!");
        }

        // todo check if channel is closed
        if ((this.channel as unknown as { closed?: boolean }).closed) this.channel = await this.connection.createChannel();
        const channel = this.channel;
        await channel.assertExchange("-", "fanout", {
            durable: false, // ensure that messages arent written to disk
        });

        const payload = Buffer.from(JSON.stringify({ id: (event.guild_id || event.channel_id || event.user_id || event.session_id) as string, event }));

        const maxAttempts = 10;
        for (let attempt = 1; ; attempt++) {
            let success = false;
            try {
                success = channel.publish("-", "", payload, {});
            } catch (e) {
                console.error("[RabbitMqSingleWriter] Got error while publishing event:", e);
            }

            if (success) break;

            if (attempt >= maxAttempts) {
                console.error(`[RabbitMqSingleWriter] Dropping event after ${maxAttempts} failed publish attempts`);
                break;
            }

            // publish() returned false => write buffer full (backpressure). Wait for the
            // channel's 'drain' event before retrying, with a capped timeout as a fallback.
            await new Promise<void>((resolve) => {
                const onDrain = () => {
                    clearTimeout(timer);
                    resolve();
                };
                const timer = setTimeout(
                    () => {
                        channel.removeListener("drain", onDrain);
                        resolve();
                    },
                    Math.min(100 * attempt, 5000),
                );
                channel.once("drain", onDrain);
            });
        }
    }
}
