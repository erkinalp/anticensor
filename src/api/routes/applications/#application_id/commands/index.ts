/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
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

import { ApplicationCommandCreateSchema, ApplicationCommandSchema } from "@spacebar/schemas";
import { route } from "@spacebar/api";
import { Request, Response, Router } from "express";
import { Application, ApplicationCommand, checkCommand, FieldErrors, Snowflake } from "@spacebar/util";
import { In, IsNull } from "typeorm";

const router = Router({ mergeParams: true });

router.get("/", route({}), async (req: Request, res: Response) => {
    const applicationExists = await Application.exists({ where: { id: req.params.application_id as string } });

    if (!applicationExists) {
        res.status(404).send({ code: 404, message: "Unknown application" });
        return;
    }

    const commands = await ApplicationCommand.find({ where: { application_id: req.params.application_id as string } });
    res.send(commands.map((_) => _.toJSON()));
});

router.post(
    "/",
    route({
        requestBody: "ApplicationCommandCreateSchema",
    }),
    async (req: Request, res: Response) => {
        const applicationExists = await Application.exists({ where: { id: req.params.application_id as string } });

        if (!applicationExists) {
            res.status(404).send({ code: 404, message: "Unknown application" });
            return;
        }

        const body = req.body as ApplicationCommandCreateSchema;

        const commandForDb = checkCommand(body, req.params.application_id as string);

        const commandExists = await ApplicationCommand.exists({ where: { application_id: req.params.application_id as string, name: body.name.trim() } });

        if (commandExists) {
            await ApplicationCommand.update({ application_id: req.params.application_id as string, name: body.name.trim() }, commandForDb);
        } else {
            commandForDb.id = Snowflake.generate(); // Have to be done that way so the id doesn't change
            await ApplicationCommand.save(commandForDb);
        }

        res.send(body);
    },
);

router.put(
    "/",
    route({
        requestBody: "BulkApplicationCommandCreateSchema",
    }),
    async (req: Request, res: Response) => {
        const applicationExists = await Application.exists({ where: { id: req.params.application_id as string } });

        if (!applicationExists) {
            res.status(404).send({ code: 404, message: "Unknown application" });
            return;
        }

        const body = req.body as ApplicationCommandCreateSchema[];

        // Remove commands not present in array
        const applicationCommands = await ApplicationCommand.find({ where: { application_id: req.params.application_id as string, guild_id: IsNull() } });

        const commandNamesInArray = new Set(body.map((c) => c.name));
        const commandsNotInArray = applicationCommands.filter((c) => !commandNamesInArray.has(c.name));

        await ApplicationCommand.delete({ application_id: req.params.application_id as string, guild_id: IsNull(), id: In(commandsNotInArray.map(({ id }) => id)) });

        await Promise.all(
            body.map(async (command) => {
                const commandForDb = checkCommand(command, req.params.application_id as string);
                const commandExists = commandNamesInArray.has(command.name);
                if (commandExists) {
                    await ApplicationCommand.update({ application_id: req.params.application_id as string, name: command.name.trim() }, commandForDb);
                } else {
                    commandForDb.id = Snowflake.generate(); // Have to be done that way so the id doesn't change
                    await ApplicationCommand.save(commandForDb);
                }
            }),
        );
        res.send(body);
    },
);

export default router;
