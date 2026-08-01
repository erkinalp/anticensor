import { Config } from "#harmony/util";
import { ProxyAgent, fetch, Request, RequestInit } from "undici";
let dispatcher: ProxyAgent | null | undefined = null;
export const proxyFetch = async function (input: string | URL | Request, init?: RequestInit) {
    if (dispatcher === null) {
        const proxy = Config.get().proxy;
        dispatcher = proxy.enabled && proxy.proxy_url ? new ProxyAgent({ uri: proxy.proxy_url, token: proxy.token }) : undefined;
    }

    return fetch(input, { dispatcher, ...init });
} satisfies typeof fetch;
