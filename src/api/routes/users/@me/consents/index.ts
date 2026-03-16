import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { UserConsent } from "@spacebar/util";

const router: Router = Router();

router.get(
	"/",
	route({
		summary: "List consents for the current user",
		responses: {
			200: { body: "any" },
		},
	}),
	async (req: Request, res: Response) => {
		const user_id = req.user_id!;
		const consents = await UserConsent.find({ where: { user_id } });
		res.json(
			consents.map((c) => ({
				service_id: c.service_id,
				consented_at: c.created_at,
			})),
		);
	},
);

export default router;
