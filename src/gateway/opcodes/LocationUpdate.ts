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

import { WebSocket, Payload } from "@spacebar/gateway";
import {
	Rights,
	getRights,
	getPermission,
	emitEvent,
	EVENTEnum,
	Channel,
} from "@spacebar/util";
import { HTTPError } from "lambert-server";

export interface LocationUpdateSchema {
	channel_id: string;
	latitude: number;
	longitude: number;
	horizontal_accuracy?: number;
	heading?: number;
}

export async function onLocationUpdate(this: WebSocket, data: Payload) {
	const body = data.d as LocationUpdateSchema;

	if (!body.channel_id || !body.latitude || !body.longitude) {
		throw new HTTPError("Missing required fields", 400);
	}

	const channel = await Channel.findOneOrFail({
		where: { id: body.channel_id },
	});

	const permissions = await getPermission(
		this.user_id,
		channel.guild_id,
		body.channel_id,
	);
	if (!permissions.has("VIEW_GEOSPATIAL")) {
		throw new HTTPError("Missing VIEW_GEOSPATIAL permission", 403);
	}

	const rights = await getRights(this.user_id);
	if (!rights.has(Rights.FLAGS.USE_GEOSPATIAL)) {
		throw new HTTPError("Missing USE_GEOSPATIAL right", 403);
	}

	if (
		typeof body.latitude !== "number" ||
		body.latitude < -90 ||
		body.latitude > 90
	) {
		throw new HTTPError(
			"Invalid latitude: must be between -90 and 90",
			400,
		);
	}
	if (
		typeof body.longitude !== "number" ||
		body.longitude < -180 ||
		body.longitude > 180
	) {
		throw new HTTPError(
			"Invalid longitude: must be between -180 and 180",
			400,
		);
	}
	if (
		body.horizontal_accuracy !== undefined &&
		(typeof body.horizontal_accuracy !== "number" ||
			body.horizontal_accuracy < 0 ||
			body.horizontal_accuracy > 1500)
	) {
		throw new HTTPError(
			"Invalid horizontal_accuracy: must be between 0 and 1500 meters",
			400,
		);
	}
	if (
		body.heading !== undefined &&
		(typeof body.heading !== "number" ||
			body.heading < 1 ||
			body.heading > 360)
	) {
		throw new HTTPError(
			"Invalid heading: must be between 1 and 360 degrees",
			400,
		);
	}

	await emitEvent({
		event: EVENTEnum.GeolocationUpdate,
		channel_id: body.channel_id,
		data: {
			user_id: this.user_id,
			channel_id: body.channel_id,
			latitude: body.latitude,
			longitude: body.longitude,
			horizontal_accuracy: body.horizontal_accuracy,
			heading: body.heading,
			timestamp: new Date(),
		},
	});
}
