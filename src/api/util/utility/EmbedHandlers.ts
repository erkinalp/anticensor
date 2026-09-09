/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { arrayDistinctBy, arrayGroupBy, Config, EmbedCache, emitEvent, Message, MessageUpdateEvent, normalizeUrl, OrmUtils } from "@harmony/util";
import { Embed, EmbedImage, EmbedType } from "@harmony/schemas";
import * as cheerio from "cheerio";
import crypto from "crypto";
import { yellow } from "picocolors";
import probe from "probe-image-size";
import { FindOptionsWhere, In } from "typeorm";
import { proxyFetch } from "../../../util/util/porxyFetch";

export function getDefaultFetchOptions() {
    return {
        redirect: "follow",
        headers: {
            "user-agent": Config.get().embeds.defaultUserAgent ?? "Mozilla/5.0 (compatible; Harmony/1.0; +https://codeberg.org/MelodyChat/Harmony)",
            "accept-language": "en-US,en;q=0.9",
        },
        // size: 1024 * 1024 * 5, 	// grabbed from config later
        method: "GET",
    } as const;
}

const makeEmbedImage = (url: string | undefined, width: number | undefined, height: number | undefined): Required<EmbedImage> | undefined => {
    if (!url || !width || !height) return undefined;
    return {
        url,
        width,
        height,
        proxy_url: getProxyUrl(new URL(url), width, height),
    };
};

let hasWarnedAboutImagor = false;

export const getProxyUrl = (url: URL, width: number, height: number): string => {
    const { resizeWidthMax, resizeHeightMax, imagorServerUrl } = Config.get().cdn;
    const secret = Config.get().security.requestSignature;
    width = Math.min(width || 500, resizeWidthMax || width);
    height = Math.min(height || 500, resizeHeightMax || width);

    // Imagor
    if (imagorServerUrl) {
        const path = `${width}x${height}/${url.host}${url.pathname}`;

        const hash = crypto.createHmac("sha1", secret).update(path).digest("base64").replace(/\+/g, "-").replace(/\//g, "_");

        return `${imagorServerUrl}/${hash}/${path}`;
    }

    if (!hasWarnedAboutImagor) {
        hasWarnedAboutImagor = true;
        console.log("[Embeds]", yellow("Imagor has not been set up correctly. https://docs.melodychat.org/setup/server/configuration/imageProxy/"));
    }

    return url.toString();
};

const getMeta = ($: cheerio.CheerioAPI, name: string): string | undefined => {
    let elem = $(`meta[property="${name}"]`);
    if (!elem.length) elem = $(`meta[name="${name}"]`);
    const ret = elem.attr("content") || elem.text();
    return ret.trim().length == 0 ? undefined : ret;
};

const tryParseInt = (str: string | undefined) => {
    if (!str) return undefined;
    try {
        return parseInt(str);
    } catch (e) {
        return undefined;
    }
};

export const getMetaDescriptions = (text: string) => {
    const $ = cheerio.load(text);

    return {
        type: getMeta($, "og:type"),
        title: getMeta($, "og:title") || $("title").first().text(),
        provider_name: getMeta($, "og:site_name"),
        author: getMeta($, "article:author"),
        description: getMeta($, "og:description") || getMeta($, "description"),
        image: getMeta($, "og:image") || getMeta($, "twitter:image"),
        image_fallback: $(`image`).attr("src"),
        video_fallback: $(`video`).attr("src"),
        width: tryParseInt(getMeta($, "og:image:width")),
        height: tryParseInt(getMeta($, "og:image:height")),
        url: getMeta($, "og:url"),
        youtube_embed: getMeta($, "og:video:secure_url"),
        site_name: getMeta($, "og:site_name"),

        $,
    };
};

const doFetch = async (url: URL, opts?: RequestInit) => {
    try {
        const res = await proxyFetch(url, OrmUtils.mergeDeep({ ...getDefaultFetchOptions() }, opts ?? {}));
        if (res.headers.get("content-length")) {
            const contentLength = parseInt(res.headers.get("content-length")!);
            if (Config.get().limits.message.maxEmbedDownloadSize && contentLength > Config.get().limits.message.maxEmbedDownloadSize) {
                return null;
            }
        }
        return res;
    } catch (e) {
        return null;
    }
};

const genericImageHandler = async (url: URL): Promise<Embed | null> => {
    const type = await proxyFetch(url, {
        ...getDefaultFetchOptions(),
        method: "HEAD",
    });

    let image;

    if (type.headers.get("content-type")?.indexOf("image") !== -1) {
        const result = await probe(url.href);
        image = makeEmbedImage(url.href, result.width, result.height);
    } else if (type.headers.get("content-type")?.indexOf("video") !== -1) {
        // TODO
        return null;
    } else {
        // have to download the page, unfortunately
        const response = await doFetch(url);
        if (!response) return null;
        const metas = getMetaDescriptions(await response.text());
        image = makeEmbedImage(metas.image || metas.image_fallback, metas.width, metas.height);
    }

    if (!image) return null;

    return {
        url: url.href,
        type: EmbedType.image,
        thumbnail: image,
    };
};

export async function EmbedHandlers(urlLike: string, key?: string): Promise<null | Embed | Embed[]> {
    // the url does not have a special handler
    if (!key) key = URL.canParse(urlLike) ? new URL(urlLike).hostname : urlLike;
    if (URL.canParse(urlLike) && new URL(urlLike).hostname === new URL(Config.get().cdn.endpointPublic!).hostname) key = "self";
    switch (key) {
        default: {
            const url = new URL(urlLike);
            const type = await proxyFetch(url, {
                ...getDefaultFetchOptions(),
                method: "HEAD",
            });
            if (type.headers.get("content-type")?.indexOf("image") !== -1) return await genericImageHandler(url);

            const response = await doFetch(url);
            if (!response) return null;

            const text = await response.text();
            const metas = getMetaDescriptions(text);

            // TODO: handle video

            if (!metas.image) metas.image = metas.image_fallback;

            if (metas.image && (!metas.width || !metas.height)) {
                metas.image = new URL(metas.image, url).toString();
                const result = await probe(metas.image);
                metas.width = result.width;
                metas.height = result.height;
            }

            if (!metas.image && (!metas.title || !metas.description)) {
                // we don't have any content to display
                return null;
            }

            let embedType = EmbedType.link;
            if (metas.type == "article") embedType = EmbedType.article;
            if (metas.type == "object") embedType = EmbedType.article; // github
            if (metas.type == "rich") embedType = EmbedType.rich;

            return {
                url: url.href,
                type: embedType,
                title: metas.title,
                thumbnail: makeEmbedImage(metas.image, metas.width, metas.height),
                description: metas.description,
                provider: metas.site_name
                    ? {
                          name: metas.site_name,
                          url: url.origin,
                      }
                    : undefined,
            };
        }

        case "giphy.com":
        case "media4.giphy.com":
        case "tenor.com":
        case "c.tenor.com":
        case "media.tenor.com":
            return genericImageHandler(new URL(urlLike));

        case "facebook.com":
        case "www.facebook.com": {
            const url = new URL(urlLike);
            const response = await doFetch(url);
            if (!response) return null;
            const metas = getMetaDescriptions(await response.text());

            return {
                url: url.href,
                type: EmbedType.link,
                title: metas.title,
                description: metas.description,
                thumbnail: makeEmbedImage(metas.image, 640, 640),
                color: 16777215,
            };
        }

        case "open.spotify.com": {
            const url = new URL(urlLike);
            const response = await doFetch(url);
            if (!response) return null;
            const metas = getMetaDescriptions(await response.text());

            return {
                url: url.href,
                type: EmbedType.link,
                title: metas.title,
                description: metas.description,
                thumbnail: makeEmbedImage(metas.image, 640, 640),
                provider: {
                    url: "https://spotify.com",
                    name: "Spotify",
                },
            };
        }

        // TODO: docs: Pixiv won't work without Imagor
        case "pixiv.net":
        case "www.pixiv.net": {
            const url = new URL(urlLike);
            const response = await doFetch(url);
            if (!response) return null;
            const metas = getMetaDescriptions(await response.text());

            if (!metas.image) return null;

            return {
                url: url.href,
                type: EmbedType.image,
                title: metas.title,
                description: metas.description,
                image: makeEmbedImage(metas.image || metas.image_fallback, metas.width, metas.height),
                provider: {
                    url: "https://pixiv.net",
                    name: "Pixiv",
                },
            };
        }

        case "store.steampowered.com": {
            const url = new URL(urlLike);
            const response = await doFetch(url);
            if (!response) return null;
            const metas = getMetaDescriptions(await response.text());
            const numReviews = metas.$("#review_summary_num_reviews").val() as string | undefined;
            const price = metas.$(".game_purchase_price.price").data("price-final") as number | undefined;
            const releaseDate = metas.$(".release_date").find("div.date").text().trim();
            const isReleased = new Date(releaseDate) < new Date();

            const fields: Embed["fields"] = [];

            if (numReviews)
                fields.push({
                    name: "Reviews",
                    value: numReviews,
                    inline: true,
                });

            if (price)
                fields.push({
                    name: "Price",
                    value: `$${price / 100}`,
                    inline: true,
                });

            // if the release date is in the past, it's already out
            if (releaseDate && !isReleased)
                fields.push({
                    name: "Release Date",
                    value: releaseDate,
                    inline: true,
                });

            return {
                url: url.href,
                type: EmbedType.rich,
                title: metas.title,
                description: metas.description,
                image: {
                    // TODO: meant to be thumbnail.
                    // isn't this standard across all of steam?
                    width: 460,
                    height: 215,
                    url: metas.image,
                    proxy_url: metas.image ? getProxyUrl(new URL(metas.image), 460, 215) : undefined,
                },
                provider: {
                    url: "https://store.steampowered.com",
                    name: "Steam",
                },
                fields,
                // TODO: Video
            };
        }

        case "reddit.com":
        case "www.reddit.com": {
            const res = await EmbedHandlers(urlLike, "default");
            return {
                ...res,
                color: 16777215,
                provider: {
                    name: "reddit",
                },
            };
        }

        case "youtu.be":
        case "youtube.com":
        case "music.youtube.com":
        case "www.youtube.com": {
            const url = new URL(urlLike);
            const response = await doFetch(url, {
                headers: {
                    cookie: Config.get().embeds.youtube.cookie ?? "CONSENT=PENDING+999; hl=en",
                    // TODO: dynamically obtain current system curl's user agent, ie. via https://ifconfig.me/ua
                    ...(Config.get().embeds.youtube.useCurlUserAgent ? { "user-agent": "curl/8.18.0" } : {}),
                    ...(Config.get().embeds.youtube.userAgent != null
                        ? { "user-agent": Config.get().embeds.youtube.userAgent ?? undefined /* type check fails for some reason otherwise */ }
                        : {}),
                },
            });
            if (!response) return null;
            const metas = getMetaDescriptions(await response.text());

            return {
                video: makeEmbedImage(metas.youtube_embed, metas.width, metas.height),
                url: url.href,
                type: metas.youtube_embed ? EmbedType.video : EmbedType.link,
                title: metas.title,
                thumbnail: makeEmbedImage(metas.image || metas.image_fallback, metas.width, metas.height),
                provider: {
                    url: "https://www.youtube.com",
                    name: "YouTube",
                },
                description: metas.description,
                color: 16711680,
                author: metas.author
                    ? {
                          name: metas.author,
                          // TODO: author channel url
                      }
                    : undefined,
            };
        }

        case "www.xkcd.com":
        case "xkcd.com": {
            const url = new URL(urlLike);
            const response = await doFetch(url);
            if (!response) return null;

            const metas = getMetaDescriptions(await response.text());
            const hoverText = metas.$("#comic img").attr("title");

            if (!metas.image) return null;

            const { width, height } = await probe(metas.image);

            return {
                url: url.href,
                type: EmbedType.rich,
                title: `xkcd: ${metas.title}`,
                image: makeEmbedImage(metas.image, width, height),
                footer: hoverText
                    ? {
                          text: hoverText,
                      }
                    : undefined,
            };
        }

        // the url is an image from this instance
        case "self": {
            const url = new URL(urlLike);
            const result = await probe(url.href);

            return {
                url: url.href,
                type: EmbedType.image,
                thumbnail: {
                    width: result.width,
                    height: result.height,
                    url: url.href,
                    proxy_url: url.href,
                },
            };
        }
    }
}

const LINK_REGEX = /<?https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)>?/g;

export function getMessageContentUrls(message: Message) {
    const content = message.content?.replace(/ *`[^)]*` */g, ""); // remove markdown

    return content?.match(LINK_REGEX) ?? [];
}

export async function dropDuplicateCacheEntries(entries: EmbedCache[]): Promise<EmbedCache[]> {
    const grouped = Array.from(arrayGroupBy(entries, (e) => e.url).values()).map((g) =>
        g.toSorted((e1, e2) => {
            let diff = e2.createdAt.getTime() - e1.createdAt.getTime();
            if (diff == 0) diff = Number(BigInt(e2.id) - BigInt(e1.id));
            return diff;
        }),
    );

    const fullToDeleteIds: string[] = [];
    for (const group of grouped) {
        if (group.length <= 1) continue;
        // console.log("[EmbedCache] Removing all but first from cache:", group);
        // this might be backwards, sort always confuses me lol
        const toDelete = group.slice(1);
        const toDeleteIds = toDelete.map((x) => x.id);
        fullToDeleteIds.push(...toDeleteIds);
        console.warn("[EmbedCache] Removing duplicate IDs for", toDelete[0].url, " - ", toDeleteIds);
    }

    await EmbedCache.delete({ id: In(fullToDeleteIds) } as FindOptionsWhere<EmbedCache>);

    // console.log("[EmbedCache] Cached embeds:", Array.from(grouped.map((x) => x[0].url)));
    return await Promise.all(
        Array.from(grouped.map((x) => x[0])).map(async (e) => {
            if (e.embed != undefined && e.embeds == undefined) {
                console.warn("[EmbedCache] Converting old embed to new embeds array for url", e.url);
                e.embeds = [e.embed];
                e.embed = undefined;
                return await e.save();
            }
            return e;
        }),
    );
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// hack to make nodejs not die
function getSlowdownFactor(off: number) {
    if (off < 10) return off;
    if (off < 25) return 100 + off * 2;
    if (off < 50) return 200 + off * 10;
    if (off < 100) return 500 + off * 15;
    if (off < 250) return 750 + off * 20;
    return 1000 + off * 150;
}

export async function getOrUpdateEmbedCache(urls: string[], cb?: (url: string, embeds: Embed[]) => Promise<void>): Promise<EmbedCache[]> {
    urls = arrayDistinctBy(urls, (x) => x);
    const embeds: EmbedCache[] = [];

    const cachedEmbeds = await dropDuplicateCacheEntries(
        await EmbedCache.find({
            where: {
                url: In(urls.map(normalizeUrl)),
            },
        }),
    );
    embeds.push(...cachedEmbeds);
    cb?.(
        "cached",
        cachedEmbeds
            .map((e) => e.embeds)
            .flat()
            .filter((e) => e !== undefined),
    );

    const urlsToGenerate = urls.filter((url) => {
        return !cachedEmbeds.some((e) => e.url == normalizeUrl(url));
    });

    if (urlsToGenerate.length > 0) console.log("[Embeds] Need to generate embeds for urls:", urlsToGenerate);
    if (cachedEmbeds.length > 0)
        console.log(
            "[Embeds] Already had embeds for urls:",
            cachedEmbeds.map((e) => e.url),
        );

    let off = 0;
    const generatedEmbeds = await Promise.all(
        urlsToGenerate.map(async (link) => {
            await sleep(getSlowdownFactor(off++)); // ...or nodejs gets overwhelmed and times out
            return await generateEmbedSingle(link, cb);
        }),
    );

    embeds.push(...generatedEmbeds.filter((e) => e != null));

    return embeds;
}

async function generateEmbedSingle(link: string, cb?: (url: string, embeds: Embed[]) => Promise<void>): Promise<EmbedCache | null> {
    const url = new URL(link);
    try {
        let res = await EmbedHandlers(link);
        if (!res) return null;
        if (!Array.isArray(res)) res = [res];

        // Cache with normalized URL
        const cache = await EmbedCache.create({
            url: normalizeUrl(url.href),
            embeds: res,
            createdAt: new Date(),
        }).save();

        console.log("[Embeds] Generated embed for", link);
        await cb?.(link, res);
        return cache;
    } catch (e) {
        console.error(`[Embeds] Error while generating embed for ${link}`, e);
    }
    return null;
}

export async function fillMessageUrlEmbeds(message: Message) {
    const linkMatches = getMessageContentUrls(message).filter((l) => !l.startsWith("<") && !l.endsWith(">"));

    // Filter out embeds that could be links, start from scratch
    message.embeds = message.embeds.filter((embed) => embed.type === "rich");

    if (linkMatches.length == 0) return message;

    const uniqueLinks: string[] = arrayDistinctBy(linkMatches, normalizeUrl);

    if (uniqueLinks.length === 0) {
        // No valid unique links found, update message to remove old embeds
        message.embeds = message.embeds.filter((embed) => embed.type === "rich");
        await saveAndEmitMessageUpdate(message);
        return message;
    }

    // avoid a race condition updating the same row
    let messageUpdateLock = saveAndEmitMessageUpdate(message);
    await getOrUpdateEmbedCache(uniqueLinks, async (url, embeds) => {
        if (url !== "cached" && message.embeds.length + embeds.length > Config.get().limits.message.maxEmbeds) return;
        message.embeds.push(...embeds);
        if (message.embeds.length > Config.get().limits.message.maxEmbeds) message.embeds = message.embeds.slice(0, Config.get().limits.message.maxEmbeds);

        try {
            await messageUpdateLock;
        } catch {
            /* empty */
        }
        messageUpdateLock = saveAndEmitMessageUpdate(message);
    });

    await saveAndEmitMessageUpdate(message);
    return message;
}

async function saveAndEmitMessageUpdate(message: Message) {
    // console.warn("Emitting message update for", message.id, "with embeds", message.embeds);
    await Message.update({ id: message.id, channel_id: message.channel_id }, { embeds: message.embeds });
    await emitEvent({
        event: "MESSAGE_UPDATE",
        channel_id: message.channel_id,
        data: message.toJSON(),
    } satisfies MessageUpdateEvent);
}
