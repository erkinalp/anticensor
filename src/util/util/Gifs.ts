import { HTTPError } from "lambert-server";
import { Config } from "./Config";
import { TenorGif } from "@harmony/schemas";

export function parseGifResult(result: TenorGif) {
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

export function getGifApiKey() {
    const { enabled, apiKey } = Config.get().gif;
    if (!enabled) throw new HTTPError(`Gifs are disabled`);
    if (!apiKey) throw new HTTPError(`gif provider not supported`);

    return apiKey;
}
