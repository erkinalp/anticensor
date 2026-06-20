import { Config } from '@harmony/util';
import { GifResponse, TenorCategoriesResults, TenorGif, TenorTrendingResults, TrendingResponse } from "@harmony/schemas";
import { GifProvider } from "./gifProvider";
import { HTTPError } from '../lambert-server';

export class Tenor extends GifProvider{
	getGifApiKey() {
		const { enabled, provider, apiKey } = Config.get().gif;
		if (!enabled) throw new HTTPError(`Gifs are disabled`);
		if (provider !== "tenor" || !apiKey) throw new HTTPError(`${provider} gif provider not supported`);

		return apiKey;
	}
	parseGifResult(result: TenorGif):GifResponse {
		return {
			id: result.id,
			title: result.title,
			url: result.itemurl,
			src: result.media[0].mp4.url,
			gif_src: result.media[0].gif.url,
			width: result.media[0].mp4.dims[0],
			height: result.media[0].mp4.dims[1],
			preview: result.media[0].mp4.preview,
		};
	}
	async search({ q, media_format, locale, limit }: { q: string; media_format: string; locale?: string; limit?: string; }){
		const apiKey = this.getGifApiKey();

		const response = await fetch(`https://g.tenor.com/v1/search?q=${q}&media_format=${media_format}${locale?"":`&locale=${locale}`}&limit=${limit ?? 100}&key=${apiKey}`, {
			method: "GET",
			headers: { "Content-Type": "application/json" },
		});

		const { results } = (await response.json()) as { results: TenorGif[] };

		return results.map(this.parseGifResult);

	}
	async trending({locale,media_format}:{locale?:string,media_format:string}): Promise<TrendingResponse> {

        const apiKey = this.getGifApiKey();

        const [responseSource, trendGifSource] = await Promise.all([
            fetch(`https://g.tenor.com/v1/categories?${locale?`locale=${locale}&`:""}&media_format=${media_format}key=${apiKey}`, {
                method: "get",
                headers: { "Content-Type": "application/json" },
            }),
            fetch(`https://g.tenor.com/v1/trending?${locale?`locale=${locale}&`:""}&media_format=${media_format}&key=${apiKey}`, {
                method: "get",
                headers: { "Content-Type": "application/json" },
            }),
        ]);

        const { tags } = (await responseSource.json()) as TenorCategoriesResults;
        const { results } = (await trendGifSource.json()) as TenorTrendingResults;

        return {
            categories: tags.map((x) => ({
                name: x.searchterm,
                src: x.image,
            })),
            gifs: [this.parseGifResult(results[0])],
        }
	}
	async trendingGifs( { media_format, locale,limit }: { media_format:string, locale?:string,limit?:string }){

        const apiKey = this.getGifApiKey();

        const response = await fetch(`https://g.tenor.com/v1/trending?media_format=${media_format}&limit=${limit ?? 20}&locale=${locale}&key=${apiKey}`, {
            method: "get",
            headers: { "Content-Type": "application/json" },
        });

        const { results } = (await response.json()) as { results: TenorGif[] };

        return results.map(this.parseGifResult);
	}
}
