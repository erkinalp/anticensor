export function replaceString(input: string, replacements: Record<string, string | undefined>) {
    return input.replace(/{([a-zA-Z0-9]+)}/gm, (_, name) => {
        if (name in replacements && replacements[name]) {
            return replacements[name];
        } else {
            console.warn("replacement not found");
            return "undefined";
        }
    });
}
