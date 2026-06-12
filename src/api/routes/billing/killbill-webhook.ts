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
import { Entitlement, KillBillService, Subscription, SubscriptionStatus, emitEvent } from "@spacebar/util";
import { Request, Response, Router } from "express";

const router: Router = Router({ mergeParams: true });

// Kill Bill push notification webhook
// See: https://docs.killbill.io/latest/push_notifications.html
router.post(
    "/",
    route({
        responses: {
            200: {},
        },
    }),
    async (req: Request, res: Response) => {
        if (!KillBillService.isEnabled()) {
            return res.sendStatus(404);
        }

        const { eventType, accountId, objectId, objectType } = req.body;

        if (!eventType || !accountId) {
            return res.sendStatus(400);
        }

        switch (eventType) {
            case "SUBSCRIPTION_CREATION":
            case "SUBSCRIPTION_CHANGE": {
                // Kill Bill subscription state changed — sync with local DB
                if (objectType === "SUBSCRIPTION" && objectId) {
                    const kbSub = await KillBillService.getSubscription(objectId);
                    if (kbSub) {
                        const localSub = await Subscription.findOne({
                            where: { payment_gateway_subscription_id: objectId },
                        });
                        if (localSub) {
                            if (kbSub.state === "ACTIVE") {
                                localSub.status = SubscriptionStatus.ACTIVE;
                            } else if (kbSub.state === "CANCELLED") {
                                localSub.status = SubscriptionStatus.ENDING;
                                localSub.canceled_at = new Date();
                            }
                            await localSub.save();

                            await emitEvent({
                                event: "SUBSCRIPTION_UPDATE",
                                data: localSub,
                                user_id: localSub.user_id,
                                guild_id: localSub.guild_id,
                            });
                        }
                    }
                }
                break;
            }
            case "SUBSCRIPTION_CANCEL": {
                if (objectType === "SUBSCRIPTION" && objectId) {
                    const localSub = await Subscription.findOne({
                        where: { payment_gateway_subscription_id: objectId },
                    });
                    if (localSub) {
                        localSub.status = SubscriptionStatus.ENDING;
                        localSub.canceled_at = new Date();
                        await localSub.save();

                        await emitEvent({
                            event: "SUBSCRIPTION_UPDATE",
                            data: localSub,
                            user_id: localSub.user_id,
                            guild_id: localSub.guild_id,
                        });
                    }
                }
                break;
            }
            case "INVOICE_PAYMENT_SUCCESS": {
                // Renewal payment succeeded — extend entitlements
                const localSub = await Subscription.findOne({
                    where: { payment_gateway_subscription_id: objectId },
                });
                if (localSub) {
                    const now = new Date();
                    const periodEnd = new Date(now);
                    periodEnd.setMonth(periodEnd.getMonth() + 1);

                    localSub.current_period_start = now;
                    localSub.current_period_end = periodEnd;
                    localSub.status = SubscriptionStatus.ACTIVE;
                    await localSub.save();

                    // Extend entitlements
                    for (const entitlementId of localSub.entitlement_ids) {
                        const entitlement = await Entitlement.findOne({
                            where: { id: entitlementId },
                        });
                        if (entitlement) {
                            entitlement.ends_at = periodEnd;
                            await entitlement.save();

                            await emitEvent({
                                event: "ENTITLEMENT_UPDATE",
                                data: entitlement,
                                user_id: entitlement.user_id,
                                guild_id: entitlement.guild_id,
                            });
                        }
                    }

                    await emitEvent({
                        event: "SUBSCRIPTION_UPDATE",
                        data: localSub,
                        user_id: localSub.user_id,
                        guild_id: localSub.guild_id,
                    });
                }
                break;
            }
            case "INVOICE_PAYMENT_FAILED": {
                // Payment failed — mark subscription as inactive
                const localSub = await Subscription.findOne({
                    where: { payment_gateway_subscription_id: objectId },
                });
                if (localSub) {
                    localSub.status = SubscriptionStatus.INACTIVE;
                    await localSub.save();

                    // Revoke entitlements
                    for (const entitlementId of localSub.entitlement_ids) {
                        const entitlement = await Entitlement.findOne({
                            where: { id: entitlementId },
                        });
                        if (entitlement) {
                            entitlement.deleted = true;
                            await entitlement.save();

                            await emitEvent({
                                event: "ENTITLEMENT_DELETE",
                                data: entitlement,
                                user_id: entitlement.user_id,
                                guild_id: entitlement.guild_id,
                            });
                        }
                    }

                    await emitEvent({
                        event: "SUBSCRIPTION_UPDATE",
                        data: localSub,
                        user_id: localSub.user_id,
                        guild_id: localSub.guild_id,
                    });
                }
                break;
            }
            default:
                break;
        }

        res.sendStatus(200);
    },
);

export default router;
