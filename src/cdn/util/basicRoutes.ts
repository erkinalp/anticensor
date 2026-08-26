import { Application } from "express";
import { registerRoute } from "./generalCDNRoute";
export function registerBasicRoutes(app: Application) {
    app.use("/app-assets", registerRoute("app-assets"));
    app.use("/app-icons", registerRoute("app-icons"));
    app.use("/avatars", registerRoute("avatars"));
    app.use("/banners", registerRoute("banners"));
    app.use("/channel-icons", registerRoute("channel-icons"));
    //TODO I think this is not a route
    app.use("/discover-splashes", registerRoute("discover-splashes"));
    app.use("/discovery-splashes", registerRoute("discovery-splashes"));
    app.use("/icons", registerRoute("icons"));
    app.use("/splashes", registerRoute("splashes"));
    app.use("/team-icons", registerRoute("team-icons"));
    app.use("/badge-icons", registerRoute("badge-icons", { getonly: true, noHash: true }));
    app.use("/avatar-decoration-presets", registerRoute("avatar-decoration-presets", { getonly: true, noHash: true }));
    app.use("/emojis", registerRoute("emojis", { noHash: true }));
    app.use("/stickers", registerRoute("stickers", { noHash: true }));
    const gp = registerRoute("guild-profiles", {
        ids: 2,

        customPath: (id, hash, id2) => (hash ? `guilds/${id}/users/${id2}/avatars/${hash}` : `guilds/${id}/users/${id2}/avatars`),
        customIds: "",
    });
    app.use("/guilds/:id/users/:id2/avatars", gp);
    app.use("/guilds/:id/users/:id2/banners", gp);

    app.use(
        "/role-icons",
        registerRoute("role-icons", {
            allowAnimated: false,
            //TODO why was spacebar like this?
            addToEndPath: ".png",
        }),
    );
}
