import { Application } from "express";
import { registerRoute } from "./generalCDNRoute";
export function registerBasicRoutes(app: Application) {
    app.use("app-assets", registerRoute("app-assets"));
    app.use("app-icons", registerRoute("app-icons"));
    app.use("avatars", registerRoute("avatars"));
    app.use("banners", registerRoute("banners"));
    app.use("channel-icons", registerRoute("channel-icons"));
    app.use("discover-splashes", registerRoute("discover-splashes"));
    app.use("discovery-splashes", registerRoute("discovery-splashes"));
    app.use("icons", registerRoute("icons"));
    app.use("splashes", registerRoute("splashes"));
    app.use("team-icons", registerRoute("team-icons"));
}
