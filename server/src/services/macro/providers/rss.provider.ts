/**
 * RSS news provider (gratis, fallback utama).
 * Agregasi 3 feed RSS langsung — TANPA bridge pihak ketiga (rss2json sudah mati).
 * XML di-parse sendiri (regex-based, cukup untuk RSS 2.0 & Atom) agar tidak
 * menambah dependency baru ke server.
 * Satu feed gagal tidak boleh mengosongkan hasil feed lain.
 * Spec: docs/design/macro-data-layer-spec.md §3
 */
import axios from "axios";
import { silentLogger } from "../../../utils/silent-logger";
import type { INewsProvider, NewsItem } from "./types";

const FEEDS: { url: string; source: string }[] = [
  {
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    source: "CNBC",
  },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
  {
    url: "https://feeds.bloomberg.com/markets/news.rss",
    source: "Bloomberg",
  },
];

// ── Mini XML parser (regex-based, cukup untuk RSS/Atom) ─────────────────────

/** Decode HTML/XML entities dasar. `&amp;` di-decode paling akhir agar tidak dobel. */
function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** Ambil semua blok `<tag>...</tag>` (non-greedy). */
function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(re) ?? [];
}

/** Ambil teks di dalam `<tag>...</tag>`; strip CDATA lalu decode entities. */
function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  const raw = (m[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decodeEntities(raw.trim());
}

/** Ambil nilai atribut dari tag (mis. `<link href="..."/>` pada Atom). */
function extractAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']*)["'][^>]*\\/?>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : "";
}

/**
 * Parse satu string RSS/Atom XML menjadi NewsItem[].
 * RSS 2.0 -> `<item>`; Atom -> `<entry>`.
 * Mengekspor supaya bisa di-unit-test dengan fixture inline (tanpa jaringan).
 */
export function parseRssXml(xml: string, source: string): NewsItem[] {
  try {
    let blocks = extractBlocks(xml, "item");
    if (blocks.length === 0) blocks = extractBlocks(xml, "entry");
    if (blocks.length === 0) return [];

    return blocks.map((block, idx) => {
      const title = extractTag(block, "title");
      const guid = extractTag(block, "guid") || extractTag(block, "id");
      const link =
        extractAttr(block, "link", "href") ||
        extractTag(block, "link") ||
        extractTag(block, "id");
      const summary =
        extractTag(block, "description") || extractTag(block, "summary");
      const pubDate =
        extractTag(block, "pubDate") ||
        extractTag(block, "published") ||
        extractTag(block, "updated") ||
        extractTag(block, "dc:date");

      const ts = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0;

      return {
        id: guid || link || `${source}-${idx}`,
        datetime: Number.isFinite(ts) && ts > 0 ? ts : 0,
        headline: title,
        summary,
        source,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fetch satu feed RSS dan parse jadi NewsItem[].
 * Mengekspor supaya bisa di-mock / di-unit-test.
 */
export async function fetchRssFeed(
  url: string,
  source: string,
  timeoutMs = 10_000
): Promise<NewsItem[]> {
  try {
    const resp = await axios.get(url, {
      timeout: timeoutMs,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (resp.status !== 200 || typeof resp.data !== "string") return [];
    return parseRssXml(resp.data, source);
  } catch (error: any) {
    silentLogger.warn(`[News/RSS] ${source} gagal: ${error.message}`);
    return [];
  }
}

export const rssNewsProvider: INewsProvider = {
  name: "rss",

  async fetchNews(limit: number): Promise<NewsItem[]> {
    // Fetch semua feed paralel; tiap feed punya error handler sendiri
    const results = await Promise.all(
      FEEDS.map(({ url, source }) => fetchRssFeed(url, source))
    );

    // Gabungkan, filter item tanpa headline, urutkan terbaru dulu, lalu limit
    return results
      .flat()
      .filter((item) => item.headline)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, limit);
  },
};
