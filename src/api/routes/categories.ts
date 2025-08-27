/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
*/
import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
const router: Router = Router();

router.get(
	"/",
	route({
		responses: {
			200: { body: "unknown" },
		},
	}),
	async (req: Request, res: Response) => {
		const { primary_only } = req.query as { locale?: string; primary_only?: string };
		const categories = [
			{ id: 1, name: "Gaming" },
			{ id: 2, name: "Music" },
			{ id: 3, name: "Education" },
			{ id: 4, name: "Science & Tech" },
			{ id: 5, name: "Entertainment" },
			{ id: 6, name: "Creative Arts" },
		];
		if (primary_only === "true") {
			return res.json(categories.map((c) => c.id));
		}
		return res.json(categories);
	},
);

export default router;
