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

import { Config } from "../Config";

export interface CryptoPaymentRequest {
    network: string;
    tokenAddress: string;
    amount: string;
    senderWallet: string;
    transactionHash?: string;
    isCustodial: boolean;
}

export interface CryptoPaymentVerification {
    verified: boolean;
    confirmations: number;
    requiredConfirmations: number;
    transactionHash: string;
    blockNumber?: number;
    amount: string;
    tokenAddress: string;
    network: string;
}

export enum CryptoPaymentStatus {
    PENDING = "PENDING",
    CONFIRMING = "CONFIRMING",
    CONFIRMED = "CONFIRMED",
    FAILED = "FAILED",
    EXPIRED = "EXPIRED",
}

function getConfig() {
    return Config.get().billing.crypto;
}

export class CryptoPaymentService {
    static isEnabled(): boolean {
        return getConfig().enabled;
    }

    static getSupportedNetworks(): string[] {
        return getConfig().networks;
    }

    static getAcceptedTokens(network: string): string[] {
        return getConfig().acceptedTokens[network] ?? [];
    }

    static getReceiverWallet(): string {
        return getConfig().receiverWallet;
    }

    static isNetworkSupported(network: string): boolean {
        return getConfig().networks.includes(network);
    }

    static isTokenAccepted(network: string, tokenAddress: string): boolean {
        const tokens = this.getAcceptedTokens(network);
        return tokens.length === 0 || tokens.includes(tokenAddress.toLowerCase());
    }

    static isCustodialAccepted(): boolean {
        return getConfig().acceptCustodialWallets;
    }

    static validatePaymentRequest(request: CryptoPaymentRequest): string | null {
        if (!this.isEnabled()) {
            return "Crypto payments are not enabled on this instance";
        }

        if (!this.isNetworkSupported(request.network)) {
            return `Network ${request.network} is not supported. Supported: ${this.getSupportedNetworks().join(", ")}`;
        }

        if (!this.isTokenAccepted(request.network, request.tokenAddress)) {
            return `Token ${request.tokenAddress} is not accepted on ${request.network}`;
        }

        if (request.isCustodial && !this.isCustodialAccepted()) {
            return "Custodial wallet payments are not accepted on this instance";
        }

        if (!request.senderWallet) {
            return "Sender wallet address is required";
        }

        const parsedAmount = parseFloat(request.amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return "Invalid payment amount";
        }

        return null;
    }

    static createPaymentIntent(
        userId: string,
        skuId: string,
        amount: string,
        network: string,
        tokenAddress: string,
    ): {
        receiverWallet: string;
        amount: string;
        network: string;
        tokenAddress: string;
        requiredConfirmations: number;
        expiresAt: Date;
        memo: string;
    } {
        const cfg = getConfig();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        return {
            receiverWallet: cfg.receiverWallet,
            amount,
            network,
            tokenAddress,
            requiredConfirmations: cfg.requiredConfirmations,
            expiresAt,
            memo: `spacebar:${userId}:${skuId}:${Date.now()}`,
        };
    }

    static async verifyTransaction(network: string, transactionHash: string, expectedAmount: string, expectedToken: string): Promise<CryptoPaymentVerification> {
        // Verification requires an RPC endpoint for the given network.
        // Instance operators must configure their own RPC provider or run a node.
        // This method provides the verification interface; the actual blockchain
        // query implementation depends on the operator's infrastructure.
        const cfg = getConfig();

        return {
            verified: false,
            confirmations: 0,
            requiredConfirmations: cfg.requiredConfirmations,
            transactionHash,
            amount: expectedAmount,
            tokenAddress: expectedToken,
            network,
        };
    }

    static getPaymentMethods(): {
        networks: string[];
        acceptedTokens: Record<string, string[]>;
        receiverWallet: string;
        acceptsCustodial: boolean;
    } {
        const cfg = getConfig();
        return {
            networks: cfg.networks,
            acceptedTokens: cfg.acceptedTokens,
            receiverWallet: cfg.receiverWallet,
            acceptsCustodial: cfg.acceptCustodialWallets,
        };
    }
}
