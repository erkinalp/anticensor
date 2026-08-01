import { KittyLogo } from "./index.js";
import pkg from "picocolors";
const { blueBright } = pkg;

export class Logo {
    public static async printLogo() {
        await KittyLogo.initialise();
        if (KittyLogo.isSupported) KittyLogo.printLogo();
        else console.log(this.AsciiLogo);
    }

    private static AsciiLogo = blueBright(
        `
  ████      ████     ███████╗██████╗  █████╗  ██████╗███████╗██████╗  █████╗ ██████╗ 
 ███████  ███████    ██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗
 ████████████████    ███████╗██████╔╝███████║██║     █████╗  ██████╔╝███████║██████╔╝
█████   ██   █████   ╚════██║██╔═══╝ ██╔══██║██║     ██╔══╝  ██╔══██╗██╔══██║██╔══██╗
██████████████████   ███████║██║     ██║  ██║╚██████╗███████╗██████╔╝██║  ██║██║  ██║
 ████████████████    ╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝`.substring(1),
    );
}
