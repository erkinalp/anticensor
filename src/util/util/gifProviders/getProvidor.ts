import { Giphy } from "./giphy";
import { Klipy } from "./klipy";
import { Tenor } from "./tenor";

export function getGifProvidor(prov?:string){
	switch(prov){
		default:
			return new Giphy();
		case "klipy":
			return new Klipy();
		case "tenor":
			return new Tenor();
	}
}
export function getGifProvidors(){
	return [new Giphy(),new Klipy(),new Tenor()].filter(_=>_.enabled())
}
