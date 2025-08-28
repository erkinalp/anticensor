import { GeofenceDefinition } from "../entities/Message";

export interface GeofenceCreateSchema {
	name: string;
	geometry: GeofenceDefinition["geometry"];
	trigger_on: "enter" | "exit" | "both";
}
