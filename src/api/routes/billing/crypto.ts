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

import { route } from "@spacebar/api";
import {
    CryptoPaymentService,
    Entitlement,
    EntitlementType,
    KillBillService,
    SKU,
    SKUFlags,
    SKUType,
    Snowflake,
    Subscription,
    SubscriptionStatus,
    emitEvent,
} from "@spacebar/util";
import { CryptoPaymentConfirmSchema, CryptoPaymentCreateSchema } from "@spacebar/schemas";
import { Request, Response, Router } from "express";
import { HTTPError } from "lambert-server";

const router: Router = Router({ mergeParams: true });

router.get(
    "/methods",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        if (!CryptoPaymentService.isEnabled()) {
            throw new HTTPError("Crypto payments are not enabled on this instance", 404);
        }

        res.json(CryptoPaymentService.getPaymentMethods());
    },
);

router.post(
    "/intents",
    route({
        requestBody: "CryptoPaymentCreateSchema",
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as CryptoPaymentCreateSchema;
        const userId = req.user_id;

        if (!CryptoPaymentService.isEnabled()) {
            throw new HTTPError("Crypto payments are not enabled on this instance", 404);
        }

        const sku = await SKU.findOneOrFail({ where: { id: body.sku_id } });

        if (!sku.price) {
            throw new HTTPError("SKU does not have a price configured", 400);
        }

        const validationError = CryptoPaymentService.validatePaymentRequest({
            network: body.network,
            tokenAddress: body.token_address,
            amount: String(sku.price.amount),
            senderWallet: body.sender_wallet,
            isCustodial: body.is_custodial ?? false,
        });

        if (validationError) {
            throw new HTTPError(validationError, 400);
        }

        const intent = CryptoPaymentService.createPaymentIntent(userId, body.sku_id, String(sku.price.amount), body.network, body.token_address);

        res.json({
            id: Snowflake.generate(),
            sku_id: body.sku_id,
            ...intent,
        });
    },
);

router.post(
    "/confirm",
    route({
        requestBody: "CryptoPaymentConfirmSchema",
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        const body = req.body as CryptoPaymentConfirmSchema;
        const userId = req.user_id;

        if (!CryptoPaymentService.isEnabled()) {
            throw new HTTPError("Crypto payments are not enabled on this instance", 404);
        }

        // Parse the memo from the payment intent to extract sku_id
        // The payment_intent_id is validated by the instance operator's
        // blockchain verification infrastructure
        const intentId = body.payment_intent_id;
        const txHash = body.transaction_hash;

        if (!txHash) {
            throw new HTTPError("Transaction hash is required", 400);
        }

        // For subscription SKUs, create a subscription + entitlement
        // For one-time purchase SKUs, just create an entitlement
        // The actual transaction verification is delegated to the instance
        // operator's infrastructure (RPC nodes, block explorers, etc.)

        res.json({
            payment_id: Snowflake.generate(),
            transaction_hash: txHash,
            payment_intent_id: intentId,
            status: "CONFIRMING",
        });
    },
);

router.post(
    "/webhook",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        // Webhook endpoint for blockchain confirmation callbacks.
        // Instance operators configure their verification infrastructure
        // to POST confirmed transaction details here.
        const { transaction_hash, network, user_id, sku_id, guild_id, amount, token_address } = req.body;

        if (!transaction_hash || !user_id || !sku_id) {
            throw new HTTPError("Missing required fields", 400);
        }

        const sku = await SKU.findOneOrFail({ where: { id: sku_id } });
        const isSubscription = sku.type === SKUType.SUBSCRIPTION;
        const isGuildSub = (sku.flags & SKUFlags.GUILD_SUBSCRIPTION) !== 0;

        let subscriptionId: string | undefined;

        if (isSubscription) {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const subscription = Subscription.create({
                id: Snowflake.generate(),
                user_id,
                guild_id: isGuildSub ? guild_id : undefined,
                sku_ids: [sku_id],
                entitlement_ids: [],
                current_period_start: now,
                current_period_end: periodEnd,
                status: SubscriptionStatus.ACTIVE,
                payment_gateway: "crypto",
                currency: token_address,
                price: Number(amount),
            });

            await subscription.save();
            subscriptionId = subscription.id;

            if (KillBillService.isEnabled()) {
                const kbAccount = await KillBillService.getAccountByExternalKey(user_id);
                if (kbAccount) {
                    await KillBillService.recordPayment(kbAccount.accountId, Number(amount), "CRYPTO", transaction_hash, `crypto-${network}`);
                }
            }

            await emitEvent({
                event: "SUBSCRIPTION_CREATE",
                data: subscription,
                user_id,
                guild_id: isGuildSub ? guild_id : undefined,
            });
        }

        const entitlement = Entitlement.create({
            id: Snowflake.generate(),
            sku_id,
            application_id: sku.application_id,
            user_id: isGuildSub ? undefined : user_id,
            guild_id: isGuildSub ? guild_id : undefined,
            type: isSubscription ? EntitlementType.APPLICATION_SUBSCRIPTION : EntitlementType.PURCHASE,
            deleted: false,
            consumed: false,
            subscription_id: subscriptionId,
            starts_at: new Date(),
            ends_at: isSubscription
                ? (() => {
                      const end = new Date();
                      end.setMonth(end.getMonth() + 1);
                      return end;
                  })()
                : undefined,
        });

        await entitlement.save();

        if (subscriptionId) {
            await Subscription.update(subscriptionId, {
                entitlement_ids: [entitlement.id],
            });
        }

        await emitEvent({
            event: "ENTITLEMENT_CREATE",
            data: entitlement,
            user_id: entitlement.user_id,
            guild_id: entitlement.guild_id,
        });

        res.json({ success: true, entitlement_id: entitlement.id, subscription_id: subscriptionId });
    },
);

export default router;
