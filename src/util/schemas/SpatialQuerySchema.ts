export interface SpatialQuerySchema {
	lat: number;
	lng: number;
	radius: number;
	type?: "messages" | "users" | "channels";
	start_time?: string;
	end_time?: string;
	limit?: number;
}
