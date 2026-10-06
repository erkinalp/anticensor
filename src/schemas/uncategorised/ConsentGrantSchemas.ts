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

import { ConsentGrantStatus, ConsentType } from "@spacebar/database";

export interface ConsentGrantAccessDescriptor {
    type: string;
    actions?: string[];
    locations?: string[];
    datatypes?: string[];
}

export interface ConsentGrantRequestSchema {
    user_id: string;
    consent_type?: ConsentType;
    service_id?: string;
    item_id?: string;
    requested_access?: ConsentGrantAccessDescriptor;
    interaction_url?: string;
    expires_at?: string;
    extra_data?: object;
}

export interface ConsentGrantApproveSchema {
    granted_access?: ConsentGrantAccessDescriptor;
    provisional?: boolean;
    expires_at?: string;
    extra_data?: object;
}

export interface ConsentGrantContinueSchema {
    continue_token: string;
    updated_access?: ConsentGrantAccessDescriptor;
    interaction_ref?: string;
}

export interface ConsentGrantResponse {
    id: string;
    user_id: string;
    requester_id: string;
    consent_type: ConsentType;
    service_id?: string;
    item_id?: string;
    status: ConsentGrantStatus;
    requested_at: string;
    responded_at?: string;
    expires_at?: string;
    interaction_url?: string;
    continue_token?: string;
    access_token?: string;
    requested_access?: ConsentGrantAccessDescriptor;
    granted_access?: ConsentGrantAccessDescriptor;
    extra_data?: object;
}

export type ConsentGrantListResponse = ConsentGrantResponse[];
