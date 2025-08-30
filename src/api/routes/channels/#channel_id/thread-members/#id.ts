import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";

const router = Router({ mergeParams: true });

router.put(
	"/",
	route({
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, id } = req.params as {
			channel_id: string;
			id: string;
		};
		res.sendStatus(204);
	},
);

router.delete(
	"/",
	route({
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		const { channel_id, id } = req.params as {
			channel_id: string;
			id: string;
		};
		res.sendStatus(204);
	},
);

export default router;

export {};
