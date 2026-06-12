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

export interface CryptoPaymentCreateSchema {
    sku_id: string;
    network: string;
    token_address: string;
    sender_wallet: string;
    is_custodial?: boolean;
    /** For guild subscriptions */
    guild_id?: string;
}

export const CryptoPaymentCreateSchema = {
    sku_id: String,
    network: String,
    token_address: String,
    sender_wallet: String,
    $is_custodial: Boolean,
    $guild_id: String,
};

export interface CryptoPaymentConfirmSchema {
    transaction_hash: string;
    payment_intent_id: string;
}

export const CryptoPaymentConfirmSchema = {
    transaction_hash: String,
    payment_intent_id: String,
};
