import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { UserConsent } from "@spacebar/util";

const router: Router = Router();

router.put(
	"/",
	route({
		right: "MANAGE_USERS",
		summary:
			"Grant consent for a service for the specified user (admin only)",
		responses: { 204: { body: "null" } },
	}),
	async (req: Request, res: Response) => {
		const user_id = req.params.id;
		const service_id = req.params.service_id;
		const existing = await UserConsent.findOne({
			where: { user_id, service_id },
		});
		if (!existing) {
			const uc = UserConsent.create({ user_id, service_id });
			await uc.save();
		}
		return res.status(204).send();
	},
);

router.delete(
	"/",
	route({
		right: "MANAGE_USERS",
		summary:
			"Revoke consent for a service for the specified user (admin only)",
		responses: { 204: { body: "null" } },
	}),
	async (req: Request, res: Response) => {
		const user_id = req.params.id;
		const service_id = req.params.service_id;
		const existing = await UserConsent.findOne({
			where: { user_id, service_id },
		});
		if (existing) {
			await existing.remove();
		}
		return res.status(204).send();
	},
);

export default router;
