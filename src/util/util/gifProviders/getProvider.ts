import { Giphy } from "./giphy.js";
import { Klipy } from "./klipy.js";
import { Tenor } from "./tenor.js";

export function getGifProvider(prov?:string){
	switch(prov){
		default:
			return new Giphy();
		case "klipy":
			return new Klipy();
		case "tenor":
			return new Tenor();
	}
}
export function getGifProviders(){
	return [new Giphy(),new Klipy(),new Tenor()].filter(_=>_.enabled())
}
