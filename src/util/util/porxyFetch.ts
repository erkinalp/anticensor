import { Config } from "@harmony/util";
import { ProxyAgent, fetch, Request, RequestInit } from "undici";
const proxy = Config.get().proxy;
const dispatcher = proxy.enabled && proxy.proxy_url ? new ProxyAgent({ uri: proxy.proxy_url, token: proxy.token }) : undefined;
export const proxyFetch = async function (input: string | URL | Request, init?: RequestInit) {
    return fetch(input, { dispatcher, ...init });
} satisfies typeof fetch;
