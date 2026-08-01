import { Config } from "#harmony/util";
import { GifResponse, TenorCategoriesResults, TenorCategory, TenorGif, TenorTrendingResults, TrendingResponse } from "#harmony/schemas";
import { GifProvider } from "./gifProvider.js";
import { HTTPError } from "../lambert-server/index.js";
interface KlipyGif {
    id: number;
    slug: string;
    title: string;
    file: {
        md: {
            mp4: {
                url: string;
                width: number;
                height: number;
                size: number;
            };
            gif: {
                url: string;
                width: number;
                height: number;
                size: number;
            };
        };
    };
    tags: string[];
    type: string;
    blur_preview: string;
}

interface KlipyCategory {
    category: string;
    query: string;
    preview_url: string;
}
export class Klipy extends GifProvider {
    name = "Klipy";
    api_name = "klipy";
    getGifApiKey() {
        const { enabled, apiKey } = Config.get().klipygif;
        if (!enabled) throw new HTTPError(`Gifs are disabled`);
        if (!apiKey) throw new HTTPError(`Key not provided`);

        return apiKey;
    }
    parseGifResult(result: KlipyGif): GifResponse {
        return {
            id: result.id + "",
            title: result.title,
            url: "https://klipy.com/gifs/" + result.slug,
            src: result.file.md.mp4.url,
            gif_src: result.file.md.gif.url,
            width: result.file.md.mp4.width,
            height: result.file.md.mp4.height,
            preview: result.blur_preview,
        };
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
    async search({ q, media_format, locale, limit }: { q: string; media_format: string; locale?: string; limit?: string }) {
        const apiKey = this.getGifApiKey();

        const response = await fetch(
            `https://api.klipy.com/api/v1/${apiKey}/gifs/search?q=${q}&media_format=${media_format}${locale ? "" : `&locale=${locale}`}&limit=${limit ?? 100}`,
            {
                method: "GET",
                headers: { "Content-Type": "application/json" },
            },
        );
        const j = (await response.json()) as { data: { data: KlipyGif[] } };

        const results = j.data.data;

        return results.map(this.parseGifResult);
    }
    async trending({ locale, media_format }: { locale?: string; media_format: string }): Promise<TrendingResponse> {
        const apiKey = this.getGifApiKey();

        const [responseSource, trendGifSource] = await Promise.all([
            fetch(`https://api.klipy.com/api/v1/${apiKey}/gifs/categories?${locale ? `locale=${locale}&` : ""}&media_format=${media_format}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                redirect: "follow",
            }),
            fetch(`https://api.klipy.com/api/v1/${apiKey}/gifs/trending?${locale ? `locale=${locale}&` : ""}&media_format=${media_format}`, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                redirect: "follow",
            }),
        ]);

        const tags = ((await responseSource.json()) as { data: { categories: KlipyCategory[] } }).data.categories;
        const results = ((await trendGifSource.json()) as { data: { data: KlipyGif[] } }).data.data;

        return {
            categories: tags.map((x) => ({
                name: x.category,
                src: x.preview_url,
            })),
            gifs: [this.parseGifResult(results[0])],
        };
    }
    async trendingGifs({ media_format, locale, limit }: { media_format: string; locale?: string; limit?: string }) {
        const apiKey = this.getGifApiKey();

        const response = await fetch(`https://api.klipy.com/api/v1/${apiKey}/gifs/trending?media_format=${media_format}&limit=${limit ?? 20}&locale=${locale}`, {
            method: "get",
            headers: { "Content-Type": "application/json" },
        });

        const results = ((await response.json()) as { data: { data: KlipyGif[] } }).data.data;

        return results.map(this.parseGifResult);
    }
}
