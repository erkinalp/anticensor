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

export interface KillBillAccount {
    accountId: string;
    externalKey: string;
    name: string;
    email: string;
    currency: string;
}

export interface KillBillSubscription {
    subscriptionId: string;
    accountId: string;
    bundleId: string;
    planName: string;
    startDate: string;
    billingPeriod: string;
    state: string;
}

export interface KillBillInvoice {
    invoiceId: string;
    accountId: string;
    amount: number;
    currency: string;
    status: string;
    invoiceDate: string;
}

export interface KillBillPayment {
    paymentId: string;
    accountId: string;
    amount: number;
    currency: string;
    status: string;
    transactionType: string;
    transactionExternalKey: string;
}

function getConfig() {
    return Config.get().billing.killBill;
}

function baseHeaders(): Record<string, string> {
    const cfg = getConfig();
    const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
    return {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Killbill-ApiKey": cfg.tenantApiKey,
        "X-Killbill-ApiSecret": cfg.tenantApiSecret,
        "X-Killbill-CreatedBy": "spacebar-server",
    };
}

async function kbFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const cfg = getConfig();
    const url = `${cfg.host}/1.0/kb${path}`;
    const headers = { ...baseHeaders(), ...(options.headers as Record<string, string> | undefined) };
    return fetch(url, { ...options, headers });
}

export class KillBillService {
    static isEnabled(): boolean {
        return getConfig().enabled;
    }

    static async createAccount(userId: string, email: string, currency: string = "USD"): Promise<KillBillAccount | null> {
        if (!this.isEnabled()) return null;

        const res = await kbFetch("/accounts", {
            method: "POST",
            body: JSON.stringify({
                externalKey: userId,
                name: userId,
                email,
                currency,
                billCycleDayLocal: 1,
            }),
        });

        if (!res.ok) {
            console.error(`[KillBill] Failed to create account for ${userId}: ${res.status} ${await res.text()}`);
            return null;
        }

        const location = res.headers.get("Location");
        if (!location) return null;

        const accountRes = await kbFetch(location.replace(/.*\/1\.0\/kb/, ""));
        if (!accountRes.ok) return null;

        return (await accountRes.json()) as KillBillAccount;
    }

    static async getAccountByExternalKey(userId: string): Promise<KillBillAccount | null> {
        if (!this.isEnabled()) return null;

        const res = await kbFetch(`/accounts?externalKey=${encodeURIComponent(userId)}`);
        if (!res.ok) return null;

        return (await res.json()) as KillBillAccount;
    }

    static async createSubscription(accountId: string, planName: string, externalKey: string): Promise<KillBillSubscription | null> {
        if (!this.isEnabled()) return null;

        const res = await kbFetch("/subscriptions", {
            method: "POST",
            body: JSON.stringify({
                accountId,
                planName,
                externalKey,
                productCategory: "BASE",
            }),
        });

        if (!res.ok) {
            console.error(`[KillBill] Failed to create subscription: ${res.status} ${await res.text()}`);
            return null;
        }

        const location = res.headers.get("Location");
        if (!location) return null;

        const subRes = await kbFetch(location.replace(/.*\/1\.0\/kb/, ""));
        if (!subRes.ok) return null;

        return (await subRes.json()) as KillBillSubscription;
    }

    static async cancelSubscription(subscriptionId: string): Promise<boolean> {
        if (!this.isEnabled()) return false;

        const res = await kbFetch(`/subscriptions/${subscriptionId}`, {
            method: "DELETE",
            headers: {
                "X-Killbill-Comment": "User requested cancellation",
            },
        });

        return res.ok;
    }

    static async getSubscription(subscriptionId: string): Promise<KillBillSubscription | null> {
        if (!this.isEnabled()) return null;

        const res = await kbFetch(`/subscriptions/${subscriptionId}`);
        if (!res.ok) return null;

        return (await res.json()) as KillBillSubscription;
    }

    static async changeSubscriptionPlan(subscriptionId: string, newPlanName: string): Promise<boolean> {
        if (!this.isEnabled()) return false;

        const res = await kbFetch(`/subscriptions/${subscriptionId}`, {
            method: "PUT",
            body: JSON.stringify({ planName: newPlanName }),
        });

        return res.ok;
    }

    static async recordPayment(accountId: string, amount: number, currency: string, transactionExternalKey: string, paymentMethodId: string): Promise<KillBillPayment | null> {
        if (!this.isEnabled()) return null;

        const res = await kbFetch(`/accounts/${accountId}/payments`, {
            method: "POST",
            body: JSON.stringify({
                purchasedAmount: amount,
                currency,
                transactionType: "PURCHASE",
                transactionExternalKey,
                paymentMethodId,
            }),
        });

        if (!res.ok) {
            console.error(`[KillBill] Failed to record payment: ${res.status} ${await res.text()}`);
            return null;
        }

        const location = res.headers.get("Location");
        if (!location) return null;

        const payRes = await kbFetch(location.replace(/.*\/1\.0\/kb/, ""));
        if (!payRes.ok) return null;

        return (await payRes.json()) as KillBillPayment;
    }

    static async addPaymentMethod(accountId: string, externalKey: string, pluginName: string = "killbill-crypto", pluginInfo: Record<string, string> = {}): Promise<string | null> {
        if (!this.isEnabled()) return null;

        const res = await kbFetch(`/accounts/${accountId}/paymentMethods`, {
            method: "POST",
            body: JSON.stringify({
                externalKey,
                pluginName,
                pluginInfo: {
                    properties: Object.entries(pluginInfo).map(([key, value]) => ({ key, value })),
                },
                isDefault: true,
            }),
        });

        if (!res.ok) {
            console.error(`[KillBill] Failed to add payment method: ${res.status} ${await res.text()}`);
            return null;
        }

        return res.headers.get("Location")?.split("/").pop() ?? null;
    }

    static async getInvoicesForAccount(accountId: string): Promise<KillBillInvoice[]> {
        if (!this.isEnabled()) return [];

        const res = await kbFetch(`/accounts/${accountId}/invoices?withMigrationInvoices=true`);
        if (!res.ok) return [];

        return (await res.json()) as KillBillInvoice[];
    }

    static async createCatalogPlan(productName: string, billingPeriod: "MONTHLY" | "ANNUAL" | "QUARTERLY", amount: number, currency: string): Promise<boolean> {
        if (!this.isEnabled()) return false;

        const res = await kbFetch("/catalog/simplePlan", {
            method: "POST",
            body: JSON.stringify({
                productName,
                productCategory: "BASE",
                billingPeriod,
                amount,
                currency,
                trialLength: 0,
                trialTimeUnit: "UNLIMITED",
            }),
        });

        if (!res.ok) {
            console.error(`[KillBill] Failed to create catalog plan: ${res.status} ${await res.text()}`);
            return false;
        }

        return true;
    }
}
