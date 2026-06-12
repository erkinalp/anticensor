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

export class KillBillConfiguration {
    host: string = "http://localhost:8080";
    apiKey: string = "";
    apiSecret: string = "";
    tenantApiKey: string = "";
    tenantApiSecret: string = "";
    enabled: boolean = false;
}

export class CryptoPaymentConfiguration {
    enabled: boolean = false;
    /** Accepted blockchain networks (e.g. "ethereum", "polygon", "arbitrum", "base", "solana") */
    networks: string[] = ["ethereum", "polygon"];
    /** Accepted stablecoin contract addresses per network, keyed by network name */
    acceptedTokens: Record<string, string[]> = {};
    /** Wallet address for receiving payments */
    receiverWallet: string = "";
    /** Number of block confirmations required before considering a payment finalized */
    requiredConfirmations: number = 12;
    /** Whether to accept custodial wallet payments in addition to self-custody */
    acceptCustodialWallets: boolean = true;
}

export class BillingConfiguration {
    killBill: KillBillConfiguration = new KillBillConfiguration();
    crypto: CryptoPaymentConfiguration = new CryptoPaymentConfiguration();
}
