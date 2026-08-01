import express from "express";
import path from "path";
import { traverseDirectory } from "#lambert-server";
import { routeHandle } from "../../dist/api/util/handlers/route.js";
import pkg from "picocolors";
const __dirname = import.meta.dirname;

const { greenBright, yellowBright, blueBright, redBright, underline, bgYellow, black } = pkg;

const methods = ["get", "post", "put", "delete", "patch"];
const routes = new Map();
let currentFile = "";
let currentPath = "";

/*
	For some reason, if a route exports multiple functions, it won't be registered here!
	If someone could fix that I'd really appreciate it, but for now just, don't do that :p
*/

function colorizeMethod(method) {
    switch (method.toLowerCase()) {
        case "get":
            return greenBright(method.toUpperCase());
        case "post":
            return yellowBright(method.toUpperCase());
        case "put":
            return blueBright(method.toUpperCase());
        case "delete":
            return redBright(method.toUpperCase());
        case "patch":
            return yellowBright(method.toUpperCase());
        default:
            return method.toUpperCase();
    }
}

function formatPath(path) {
    return path.replace(/:(\w+)/g, underline(":$1")).replace(/#(\w+)/g, underline("#$1"));
}

/**
 * @param {string} file
 * @param {string} apiMethod
 * @param {string} apiPathPrefix
 * @param {string} apiPath
 * @param args
 */
function proxy(file, apiMethod, apiPathPrefix, apiPath, ...args) {
    const opts = args.find((x) => x?.prototype?.OPTS_MARKER == true);
    if (!opts) {
        console.error(
            `  \x1b[5m${bgYellow(black("WARN"))}\x1b[25m ${file.replace(path.resolve(__dirname, "..", "..", "dist"), "/src")} has route without route() description middleware: ${colorizeMethod(apiMethod)} ${formatPath(apiPath)}`,
        );
        routes.set(apiPathPrefix + apiPath + "|" + apiMethod, null);
        return;
    }

    console.log(`${colorizeMethod(apiMethod).padStart("DELETE".length + 10)} ${formatPath(apiPathPrefix + apiPath)}`);
    opts.file = file.replace("/dist/", "/src/").replace(".js", ".ts");
    routes.set(apiPathPrefix + apiPath + "|" + apiMethod, opts());
}

express.Router = () => {
    return Object.fromEntries(methods.map((method) => [method, proxy.bind(null, currentFile, method, currentPath)]));
};

routeHandle((opts) => {
    const func = function () {
        return opts;
    };
    func.prototype.OPTS_MARKER = true;
    return func;
});

export default async function getRouteDescriptions() {
    const root = path.join(__dirname, "..", "..", "dist", "api", "routes", "/");
    await Promise.all(
        await traverseDirectory({ dirname: root, recursive: true }, async (file) => {
            currentFile = file;

            currentPath = file.replace(root.slice(0, -1), "");
            currentPath = currentPath.split(".").slice(0, -1).join("."); // truncate .js/.ts file extension of path
            currentPath = currentPath.replaceAll("#", ":").replaceAll("\\", "/"); // replace # with : for path parameters and windows paths with slashes
            if (currentPath.endsWith("/index")) currentPath = currentPath.slice(0, "/index".length * -1); // delete index from path

            try {
                await import(file.replaceAll("#", "%23"));
            } catch (e) {
                console.error(e, file);
            }
        }),
    );

    return routes;
}
