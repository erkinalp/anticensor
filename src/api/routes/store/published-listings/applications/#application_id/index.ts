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
import { Application, SKU, SKUType } from "@spacebar/util";

const router: Router = Router({ mergeParams: true });

router.get("/", route({}), async (req: Request, res: Response) => {
    const application_id = req.params.application_id as string;

    const app = await Application.findOne({ where: { id: application_id } });
    const primarySku = await SKU.findOne({
        where: { application_id, type: SKUType.SUBSCRIPTION },
        order: { id: "ASC" },
    });

    res.json({
        id: application_id,
        summary: app?.summary ?? "",
        sku: primarySku
            ? {
                  id: primarySku.id,
                  type: primarySku.type,
                  dependent_sku_id: primarySku.dependent_sku_id ?? null,
                  application_id,
                  manifest_labels: [],
                  access_type: primarySku.access_type,
                  name: primarySku.name,
                  features: primarySku.features ?? [],
                  release_date: primarySku.release_date ?? null,
                  premium: primarySku.premium,
                  slug: primarySku.slug ?? "",
                  flags: primarySku.flags,
                  genres: [],
                  legal_notice: primarySku.legal_notice ?? "",
                  application: {
                      id: app?.id ?? "",
                      name: app?.name ?? "",
                      icon: app?.icon ?? "",
                      description: app?.description ?? "",
                      summary: app?.summary ?? "",
                      cover_image: app?.cover_image ?? "",
                      primary_sku_id: primarySku.id,
                      hook: app?.hook ?? true,
                      slug: primarySku.slug ?? "",
                      guild_id: app?.guild_id ?? "",
                      bot_public: app?.bot_public ?? true,
                      bot_require_code_grant: app?.bot_require_code_grant ?? false,
                      verify_key: app?.verify_key ?? "",
                      publishers: [],
                      developers: [],
                      system_requirements: {},
                      show_age_gate: primarySku.show_age_gate,
                      price: primarySku.price ?? { amount: 0, currency: "USD" },
                      locales: [],
                  },
                  tagline: "",
                  description: primarySku.description ?? "",
                  carousel_items: [],
                  header_logo_dark_theme: {},
                  header_logo_light_theme: {},
                  box_art: {},
                  thumbnail: {},
                  header_background: {},
                  hero_background: {},
                  assets: [],
              }
            : null,
    });
});

export default router;
