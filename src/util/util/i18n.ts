import fs from "fs/promises";
import sfs from "fs";
import type jsonType from "./../../../assets/locales/en.json";
import path from "path";
import { Request } from "express";
const langs = new Set<string>(
    sfs
        .readdirSync(path.join(import.meta.dirname, "./../../../assets/locales"))
        .filter((_) => _.endsWith(".json"))
        .map((_) => _.replace(/\.json$/, "")),
);

type translation = {
    [key: string]: string | translation;
};
type translationCalls = {
    [key: string]: ((...params: string[]) => string) | translationCalls;
};
export class LangGlob {
    langs: string[];
    constructor(langs: string[]) {
        this.langs = langs;
    }
}
export type globtype = LangGlob & DoTheThing<beforeType>;
export class I18n {
    static map = new Map<string, I18n>();
    lang: string;
    keys = new Map<string, (...args: string[]) => string>();
    static en = this.create("en") as Promise<I18n>;

    constructor(lang: string, translation: translation) {
        this.lang = lang;
        this.transform(translation);
    }
    private transform(t: translation, path: string = "") {
        for (const [key, value] of Object.entries(t)) {
            if (typeof value === "string") {
                const func = (...args: string[]) => {
                    return I18n.fillInBlanks(value, args);
                };
                if (path) {
                    this.keys.set(path + "." + key, func);
                } else {
                    this.keys.set(key, func);
                }
            } else {
                if (path) {
                    this.transform(value, path + "." + key);
                } else {
                    this.transform(value, key);
                }
            }
        }
    }
    private static async getTranslationFile(lang: string) {
        return JSON.parse(await fs.readFile(path.join(import.meta.dirname, "./../../../assets/locales", lang + ".json"), "utf8")) as translation;
    }
    private static readonly globCache = new Map<string, globtype>();
    static async createLangGlob(langs: { q: number; lang: string }[]) {
        const key1 = langs.map((_) => _.lang).join(".");
        let c = this.globCache.get(key1);
        if (c) {
            return c;
        }

        const keySize = (await this.en).keys.size;
        const keys = new Map<string, (...args: string[]) => string>();
        const usedLangs = [] as string[];
        for (const { lang } of langs) {
            const i18n = await this.create(lang);
            if (!i18n) continue;
            let used = false;
            for (const [key, value] of i18n.keys) {
                if (keys.has(key)) continue;
                used = true;
                keys.set(key, value);
            }
            if (used) usedLangs.push(lang);
            if (keySize === keys.size) break;
        }
        const key2 = usedLangs.join(".");
        c = this.globCache.get(key2);
        if (c) {
            this.globCache.set(key1, c);
            return c;
        }
        const translations = {} as translationCalls;
        for (const [key, value] of keys) {
            const path = key.split(".");
            let temp = translations;
            for (const key of path.slice(0, -1)) {
                if (key in temp) {
                    temp = temp[key] as translationCalls;
                } else {
                    const t = {};
                    temp[key] = t;
                    temp = t;
                }
            }
            temp[path.at(-1) as string] = value;
        }
        const glob = Object.assign(new LangGlob(usedLangs), translations) as unknown as globtype;
        this.globCache.set(key1, glob);
        this.globCache.set(key2, glob);
        return glob;
    }
    static parseLangsFromReq(r: Request) {
        const elangs = r.headers["accept-language"];
        const validLangs = [] as { q: number; lang: string }[];
        if (elangs) {
            elangs.split(";").forEach((langstr) => {
                if (langstr.trim() === "*") return;
                let q = 1;
                let canidate = undefined as undefined | string;
                for (let param of langstr.split(",")) {
                    param = param.trim();
                    if (param.startsWith("q=")) {
                        const val = +param.replace("q=", "");
                        if (!isNaN(val)) q = Math.max(0, Math.min(1, q));
                    } else {
                        if (!langs.has(param)) {
                            if (canidate) continue;
                            if (param.includes("-")) param = param.split("-")[0];
                            if (!langs.has(param)) {
                                //We don't have it
                                continue;
                            } else {
                                canidate = param;
                            }
                        } else {
                            canidate = param;
                            break;
                        }
                    }
                }
                if (canidate) validLangs.push({ q, lang: canidate });
            });
        }
        if (r.user && r.user.settings && r.user.settings.locale) {
            let lang = r.user.settings.locale;
            if (!langs.has(lang)) {
                if (lang.includes("-")) lang = lang.split("-")[0];
            }
            if (langs.has(lang) && !validLangs.find((_) => _.lang === lang)) {
                validLangs.push({ lang, q: 1.1 });
            }
        }
        if (!validLangs.find((_) => _.lang === "en")) {
            validLangs.push({ lang: "en", q: 0 });
        }
        validLangs.sort((a, b) => b.q - a.q);
        return validLangs;
    }
    static async create(lang: string) {
        if (!langs.has(lang)) {
            return null;
        }
        const c = this.map.get(lang);
        if (c !== undefined) return c;

        const i18n = new I18n(lang, await this.getTranslationFile(lang));
        this.map.set(lang, i18n);

        return i18n;
    }
    static fillInBlanks(msg: string, params: string[]): string {
        msg = msg.replace(/(\$\d+)|({{(.+?)}})/g, (_, dolar, str, match) => {
            if (dolar) {
                const number = Number(dolar.slice(1));
                if (params[number - 1] !== undefined) {
                    return params[number - 1];
                } else {
                    return dolar;
                }
            } else {
                const [op, strsSplit] = this.fillInBlanks(match, params).split(":");
                const [first, ...strs] = strsSplit.split("|");
                switch (op.toUpperCase()) {
                    case "PLURAL": {
                        const numb = Number(first);
                        if (numb === 0) {
                            return strs[strs.length - 1];
                        }
                        return strs[Math.min(strs.length - 1, numb - 1)];
                    }
                    case "GENDER": {
                        if (first === "male") {
                            return strs[0];
                        } else if (first === "female") {
                            return strs[1];
                        } else if (first === "neutral") {
                            if (strs[2]) {
                                return strs[2];
                            } else {
                                return strs[0];
                            }
                        }
                    }
                }
                return str;
            }
        });
        return msg;
    }
}

type beforeType = typeof jsonType;

type DoTheThing<T> = {
    [K in keyof T]: T[K] extends string ? (...args: string[]) => string : DoTheThing<T[K]>;
};
