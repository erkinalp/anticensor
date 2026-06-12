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

export interface SKUCreateSchema {
    name: string;
    type: number;
    flags?: number;
    summary?: string;
    description?: string;
    access_type?: number;
    dependent_sku_id?: string;
    features?: number[];
    release_date?: string;
    premium?: boolean;
    legal_notice?: string;
    price?: { currency: string; amount: number; exponent: number };
    price_tier?: number;
    show_age_gate?: boolean;
}

export const SKUCreateSchema = {
    name: String,
    type: Number,
    $flags: Number,
    $summary: String,
    $description: String,
    $access_type: Number,
    $dependent_sku_id: String,
    $features: [] as number[],
    $release_date: String,
    $premium: Boolean,
    $legal_notice: String,
    $price: Object,
    $price_tier: Number,
    $show_age_gate: Boolean,
};
