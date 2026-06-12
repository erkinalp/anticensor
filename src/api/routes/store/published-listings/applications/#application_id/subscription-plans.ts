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

import { Request, Response, Router } from "express";
import { route } from "@spacebar/api";
import { SKU, SKUType } from "@spacebar/util";

const router: Router = Router({ mergeParams: true });

router.get("/", route({}), async (req: Request, res: Response) => {
    const application_id = req.params.application_id as string;

    const skus = await SKU.find({
        where: { application_id, type: SKUType.SUBSCRIPTION },
    });

    const plans = skus.map((sku) => ({
        id: sku.id,
        name: sku.name,
        interval: 1,
        interval_count: 1,
        tax_inclusive: true,
        sku_id: sku.id,
        currency: sku.price?.currency?.toLowerCase() ?? "usd",
        price: sku.price?.amount ?? 0,
        price_tier: sku.price_tier ?? null,
    }));

    res.json(plans);
});

export default router;
