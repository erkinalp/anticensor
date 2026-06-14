import { Config, FieldErrors } from "@spacebar/util";
import { Request } from "express";

export function checkUsername(username: string, req: Request) {
    const check_username = username.replace(/\s/g, "").trim();
    if (!check_username) {
        throw FieldErrors({
            username: {
                code: "BASE_TYPE_REQUIRED",
                message: req?.t("common:field.BASE_TYPE_REQUIRED"),
            },
        });
    }

    const { maxUsername } = Config.get().limits.user;
    if (check_username.length > maxUsername || check_username.length < 2) {
        throw FieldErrors({
            username: {
                code: "BASE_TYPE_BAD_LENGTH",
                message: `Must be between 2 and ${maxUsername} in length.`,
            },
        });
    }
}
