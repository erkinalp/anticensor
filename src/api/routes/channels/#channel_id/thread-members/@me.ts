import { Router, Request, Response } from "express";
import { route } from "@spacebar/api";

const router = Router({ mergeParams: true });

router.put(
	"/",
	route({
		permission: "VIEW_CHANNEL",
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		req.params.id = "@me";
		const handler = require("./#id").default;
		return handler.stack[0].handle(req, res);
	},
);

router.delete(
	"/",
	route({
		permission: "VIEW_CHANNEL", 
		responses: { 204: {} },
	}),
	async (req: Request, res: Response) => {
		req.params.id = "@me";
		const handler = require("./#id").default;
		return handler.stack[1].handle(req, res);
	},
);

export default router;
