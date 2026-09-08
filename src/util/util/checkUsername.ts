import { FieldErrors, ValidateName } from "#harmony/util";
import type { Request } from "express";

export function checkUsername(username: string, req: Request) {
    const check_username = username.replace(/\s/g, "").trim();
    if (!check_username) {
        throw FieldErrors({
            username: {
                code: "BASE_TYPE_REQUIRED",
                message: req?.i18n.field.BASE_TYPE_REQUIRED(),
            },
        });
    }
    ValidateName(username);
}
