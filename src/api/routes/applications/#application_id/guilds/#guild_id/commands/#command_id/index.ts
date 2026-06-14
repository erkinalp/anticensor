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
import { Application, ApplicationCommand, checkCommand, FieldErrors, Guild, Member, Snowflake } from "@spacebar/util";

const router = Router({ mergeParams: true });

router.get("/", route({}), async (req: Request, res: Response) => {
    const applicationExists = await Application.exists({ where: { id: req.params.application_id as string } });

    if (!applicationExists) {
        res.status(404).send({ code: 404, message: "Unknown application" });
        return;
    }

    const guildExists = await Guild.exists({ where: { id: req.params.guild_id as string } });
    //TODO this seems like it's just informing bots when a guild id does not exist, it should likely just error that the member does not exist.
    if (!guildExists) {
        res.status(404).send({ code: 404, message: "Unknown Server" });
        return;
    }

    if (!(await Member.exists({ where: { id: req.params.application_id as string, guild_id: req.params.guild_id as string } }))) {
        res.status(401).send({ code: 401, message: "Missing Access" });
        return;
    }

    const command = await ApplicationCommand.findOne({
        where: { application_id: req.params.application_id as string, id: req.params.command_id as string, guild_id: req.params.guild_id as string },
    });

    if (!command) {
        res.status(404).send({ code: 404, message: "Unknown application command" });
        return;
    }

    res.send(command);
});

router.patch(
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

        const guildExists = await Guild.exists({ where: { id: req.params.guild_id as string } });

        if (!guildExists) {
            res.status(404).send({ code: 404, message: "Unknown Server" });
            return;
        }

        if (!(await Member.exists({ where: { id: req.params.application_id as string, guild_id: req.params.guild_id as string } }))) {
            res.status(401).send({ code: 401, message: "Missing Access" });
            return;
        }

        const body = req.body as ApplicationCommandCreateSchema;

        const commandForDb = checkCommand(body, req.params.application_id as string);

        const commandExists = await ApplicationCommand.exists({
            where: { application_id: req.params.application_id as string, guild_id: req.params.guild_id as string, id: req.params.command_id as string, name: body.name.trim() },
        });

        if (!commandExists) {
            res.status(404).send({ code: 404, message: "Unknown application command" });
            return;
        }

        await ApplicationCommand.update(
            { application_id: req.params.application_id as string, guild_id: req.params.guild_id as string, id: req.params.command_id as string, name: body.name.trim() },
            commandForDb,
        );
        res.send(commandForDb);
    },
);

router.delete("/", route({}), async (req: Request, res: Response) => {
    const applicationExists = await Application.exists({ where: { id: req.params.application_id as string } });

    if (!applicationExists) {
        res.status(404).send({ code: 404, message: "Unknown application" });
        return;
    }

    const guildExists = await Guild.exists({ where: { id: req.params.guild_id as string } });
    //TODO this seems like it's just informing bots when a guild id does not exist, it should likely just error that the member does not exist.
    if (!guildExists) {
        res.status(404).send({ code: 404, message: "Unknown Server" });
        return;
    }

    if (!(await Member.exists({ where: { id: req.params.application_id as string, guild_id: req.params.guild_id as string } }))) {
        res.status(401).send({ code: 401, message: "Missing Access" });
        return;
    }

    const commandExists = await ApplicationCommand.exists({
        where: { application_id: req.params.application_id as string, guild_id: req.params.guild_id as string, id: req.params.command_id as string },
    });

    if (!commandExists) {
        res.status(404).send({ code: 404, message: "Unknown application command" });
        return;
    }

    await ApplicationCommand.delete({ application_id: req.params.application_id as string, guild_id: req.params.guild_id as string, id: req.params.command_id as string });
    res.sendStatus(204);
});

export default router;
