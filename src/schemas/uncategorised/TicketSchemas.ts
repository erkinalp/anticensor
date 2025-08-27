export interface TicketCreateSchema {
	name?: string;
}

export interface TicketPatchSchema {
	owner_id?: string | null;
	resolved?: boolean | null;
	public?: boolean | null;
	closed?: boolean | null;
}
