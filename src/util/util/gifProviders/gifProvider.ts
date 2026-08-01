import { GifResponse, TrendingResponse } from "#harmony/schemas";

export abstract class GifProvider{
	abstract search(opts:{ q:string, media_format:string, locale?:string,limit?:string }):Promise<GifResponse[]>;
	abstract trending(opts:{locale?:string,media_format:string}):Promise<TrendingResponse>
	abstract trendingGifs(opts:{locale?:string,media_format:string}):Promise<GifResponse[]>
	abstract enabled():boolean
	abstract name:string;
	abstract api_name:string;
}
