import { FieldErrors, globtype, ValidateName } from "#harmony/util";

export function checkUsername(username: string, req: globtype) {
    const check_username = username.replace(/\s/g, "").trim();
    if (!check_username) {
        throw FieldErrors({
            username: {
                code: "BASE_TYPE_REQUIRED",
                message: req.field.BASE_TYPE_REQUIRED(),
            },
        });
    }
    ValidateName(username);
}
