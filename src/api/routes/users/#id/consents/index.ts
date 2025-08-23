import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { UserConsent } from "@spacebar/util";

const router: Router = Router();

router.get(
	"/",
	route({
		right: "MANAGE_USERS",
		summary: "List consents for a specified user (admin only)",
		responses: {
			200: { body: "any" },
			403: { body: "APIErrorResponse" },
		},
	}),
	async (req: Request, res: Response) => {
		const target_user_id = req.params.id;
		const consents = await UserConsent.find({
			where: { user_id: target_user_id },
		});
		res.json(
			consents.map((c) => ({
				service_id: c.service_id,
				consented_at: c.created_at,
			})),
		);
	},
);

export default router;
