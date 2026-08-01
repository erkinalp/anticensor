import { Config } from "#harmony/util";
import { GifResponse, TenorCategoriesResults, TenorGif, TenorTrendingResults, TrendingResponse } from "#harmony/schemas";
import { GifProvider } from "./gifProvider.js";
import { HTTPError } from "../lambert-server/index.js";
interface GiphyGif {
    id: string;
    url: string;
    title: string;
    images: {
        downsized_medium: {
            height: string;
            width: string;
            size: string;
            url: string;
        };
        preview: {
            mp4: string;
        };
    };
}
export class Giphy extends GifProvider {
    name = "Giphy";
    api_name = "giphy";
    getGifApiKey() {
        const { enabled, apiKey } = Config.get().giphygif;
        if (!enabled) throw new HTTPError(`Gifs are disabled`);
        if (!apiKey) throw new HTTPError(`key not supplied`);

        return apiKey;
    }

    parseGifResult(result: GiphyGif): GifResponse {
        return {
            id: result.id,
            title: result.title,
            url: result.url,
            src: result.images.preview.mp4,
            gif_src: result.images.downsized_medium.url,
            width: +result.images.downsized_medium.width,
            height: +result.images.downsized_medium.height,
            preview: result.images.downsized_medium.url,
        };
    }
    async search({ q, media_format, locale, limit }: { q: string; media_format: string; locale?: string; limit?: string }) {
        const apiKey = this.getGifApiKey();

        const response = await fetch(
            `https://api.giphy.com/v1/gifs/search?q=${q}&media_format=${media_format}${locale ? "" : `&locale=${locale}`}&limit=${limit ?? 100}&api_key=${apiKey}`,
            {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            },
        );

        const results = (await response.json()) as { data: GiphyGif[] };
        return results.data.map(this.parseGifResult);
    }
    enabled(): boolean {
        try {
            this.getGifApiKey();
            return true;
        } catch {
            //ignore error
        }
        return false;
    }
    async trending({ locale, media_format }: { locale?: string; media_format: string }): Promise<TrendingResponse> {
        const apiKey = this.getGifApiKey();

        const [responseSource, trendGifSource] = await Promise.all([
            fetch(`https://api.giphy.com/v1/gifs/categories?api_key=${apiKey}`, {
                method: "get",
                headers: { "Content-Type": "application/json" },
            }),
            fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}`, {
                method: "get",
                headers: { "Content-Type": "application/json" },
            }),
        ]);
        const tags = (await responseSource.json()) as {
            data: {
                name: string;
                gif: GiphyGif;
            }[];
        };
        const results = ((await trendGifSource.json()) as { data: GiphyGif[] }).data;

        return {
            categories: tags.data.map((x) => ({
                name: x.name,
                src: x.gif.images.downsized_medium.url,
            })),
            gifs: [this.parseGifResult(results[0])],
        };
    }
    async trendingGifs({ media_format, locale, limit }: { media_format: string; locale?: string; limit?: string }) {
        const apiKey = this.getGifApiKey();

        const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}`, {
            method: "get",
            headers: { "Content-Type": "application/json" },
        });

        const { data } = (await response.json()) as { data: GiphyGif[] };

        return data.map(this.parseGifResult);
    }
}
