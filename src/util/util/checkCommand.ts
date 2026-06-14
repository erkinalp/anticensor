import { FieldErrors, Snowflake } from "@spacebar/util";
import { ApplicationCommandCreateSchema, ApplicationCommandSchema } from "@spacebar/schemas";

export function checkCommand(command: ApplicationCommandCreateSchema, appId: string) {
    if (!command.type) {
        command.type = 1;
    }

    if (command.name.trim().length < 1 || command.name.trim().length > 32) {
        // TODO: configurable?
        throw FieldErrors({
            name: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: `Must be between 1 and 32 in length.`,
            },
        });
    }

    const commandForDb: ApplicationCommandSchema = {
        application_id: appId,
        name: command.name.trim(),
        name_localizations: command.name_localizations,
        description: command.description?.trim() || "",
        description_localizations: command.description_localizations,
        default_member_permissions: command.default_member_permissions || null,
        contexts: command.contexts,
        dm_permission: command.dm_permission || true,
        global_popularity_rank: 1,
        handler: command.handler,
        integration_types: command.integration_types,
        nsfw: command.nsfw,
        options: command.options,
        type: command.type,
        version: Snowflake.generate(),
    };
    return commandForDb;
}
