import { GeoLocation, GeofenceDefinition } from "../entities/Message";

export interface LocationUpdateEvent {
	event: "LOCATION_UPDATE";
	data: {
		message_id: string;
		location: GeoLocation;
		expires_at: Date;
	};
}

export interface GeofenceTriggeredEvent {
	event: "GEOFENCE_TRIGGERED";
	data: {
		geofence_id: string;
		user_id: string;
		trigger_type: "enter" | "exit";
		location: GeoLocation;
		timestamp: Date;
	};
}

export interface SpatialQueryResultEvent {
	event: "SPATIAL_QUERY_RESULT";
	data: {
		query_id: string;
		results: unknown[];
		total_count: number;
	};
}
