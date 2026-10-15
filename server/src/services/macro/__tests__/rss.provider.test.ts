import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { parseRssXml, rssNewsProvider } from "../providers/rss.provider";

// Mock axios di level modul (hoisted oleh vitest) — TIDAK ada request jaringan nyata.
vi.mock("axios", () => ({ default: { get: vi.fn() } }));
const mockedGet: any = axios.get;

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES — RSS XML inline (tidak bergantung jaringan)
// ─────────────────────────────────────────────────────────────────────────────

const RSS_2_0 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>First News</title>
      <link>https://example.com/1</link>
      <guid isPermaLink="false">guid-1</guid>
      <description>Summary of first news</description>
      <pubDate>Mon, 12 Oct 2026 15:37:26 GMT</pubDate>
    </item>
    <item>
      <title>Second News</title>
      <link>https://example.com/2</link>
      <guid isPermaLink="false">guid-2</guid>
      <description>Summary of second news</description>
      <pubDate>Tue, 13 Oct 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Test</title>
  <entry>
    <title>Atom Entry 1</title>
    <link href="https://example.com/atom-1"/>
    <id>atom-id-1</id>
    <summary>Atom summary 1</summary>
    <updated>2026-10-13T08:00:00Z</updated>
  </entry>
  <entry>
    <title>Atom Entry 2</title>
    <link href="https://example.com/atom-2"/>
    <id>atom-id-2</id>
    <summary>Atom summary 2</summary>
    <updated>2026-10-12T08:00:00Z</updated>
  </entry>
</feed>`;

const RSS_WITH_ENTITIES = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>AT&amp;T earnings &amp; more</title>
      <link>https://example.com/att</link>
      <description><![CDATA[Profit rose 10% & revenue hit $1B]]></description>
      <pubDate>Wed, 07 Oct 2026 18:42:36 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const RSS_SINGLE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Only One</title>
      <pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

// ─────────────────────────────────────────────────────────────────────────────
// parseRssXml
// ─────────────────────────────────────────────────────────────────────────────

describe("parseRssXml", () => {
  it("mem-parse RSS 2.0 dengan benar", () => {
    const items = parseRssXml(RSS_2_0, "TestSource");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: "guid-1",
      datetime: Math.floor(new Date("Mon, 12 Oct 2026 15:37:26 GMT").getTime() / 1000),
      headline: "First News",
      summary: "Summary of first news",
      source: "TestSource",
    });
    expect(items[1].headline).toBe("Second News");
  });

  it("mem-parse Atom feed dengan benar", () => {
    const items = parseRssXml(ATOM_FEED, "AtomSource");
    expect(items).toHaveLength(2);
    expect(items[0].headline).toBe("Atom Entry 1");
    expect(items[0].source).toBe("AtomSource");
    expect(items[0].id).toBe("atom-id-1");
    expect(items[0].datetime).toBeGreaterThan(0);
  });

  it("decode HTML entities di title dan description", () => {
    const items = parseRssXml(RSS_WITH_ENTITIES, "EntityTest");
    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe("AT&T earnings & more");
    expect(items[0].summary).toContain("Profit rose 10%");
    expect(items[0].summary).toContain("$1B");
  });

  it("menangani RSS dengan satu item (bukan array)", () => {
    const items = parseRssXml(RSS_SINGLE_ITEM, "SingleTest");
    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe("Only One");
  });

  it("mengembalikan array kosong untuk XML invalid / tanpa item", () => {
    expect(parseRssXml("", "Empty")).toEqual([]);
    expect(parseRssXml("<not-rss>", "Invalid")).toEqual([]);
    expect(parseRssXml("totally not xml", "Invalid")).toEqual([]);
    expect(parseRssXml('<?xml version="1.0"?><root><item/></root>', "NoItem")).toEqual([]);
  });

  it("menggunakan fallback id dari link bila guid tidak ada", () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title>No Guid</title><link>https://example.com/x</link><pubDate>Mon, 12 Oct 2026 15:37:26 GMT</pubDate></item>
      </channel></rss>`;
    const items = parseRssXml(xml, "Fallback");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("https://example.com/x");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rssNewsProvider.fetchNews — per-feed error handling (axios di-mock)
// ─────────────────────────────────────────────────────────────────────────────

describe("rssNewsProvider.fetchNews", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("menggabungkan berita dari semua feed yang sukses", async () => {
    // 2 dari 3 feed sukses, 1 gagal
    mockedGet
      .mockResolvedValueOnce({ status: 200, data: RSS_2_0 }) // CNBC OK
      .mockRejectedValueOnce(new Error("Network error")) // MarketWatch gagal
      .mockResolvedValueOnce({ status: 200, data: ATOM_FEED }); // Bloomberg OK

    const items = await rssNewsProvider.fetchNews(10);
    expect(items.length).toBeGreaterThan(0);
    const sources = new Set(items.map((i) => i.source));
    expect(sources.has("CNBC")).toBe(true);
    expect(sources.has("Bloomberg")).toBe(true);
    expect(sources.has("MarketWatch")).toBe(false);
  });

  it("satu feed gagal TIDAK mengosongkan hasil feed lain", async () => {
    mockedGet
      .mockRejectedValueOnce(new Error("timeout")) // CNBC gagal
      .mockResolvedValueOnce({ status: 200, data: RSS_2_0 }) // MarketWatch OK
      .mockRejectedValueOnce(new Error("403")); // Bloomberg gagal

    const items = await rssNewsProvider.fetchNews(10);
    expect(items).toHaveLength(2); // hanya dari MarketWatch
    expect(items.every((i) => i.source === "MarketWatch")).toBe(true);
  });

  it("menghormati parameter limit", async () => {
    const manyItems = Array.from(
      { length: 20 },
      (_, i) =>
        `<item><title>News ${i}</title><pubDate>Mon, 12 Oct 2026 15:37:26 GMT</pubDate></item>`
    ).join("");
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>${manyItems}</channel></rss>`;

    mockedGet
      .mockResolvedValueOnce({ status: 200, data: xml })
      .mockResolvedValueOnce({ status: 200, data: xml })
      .mockResolvedValueOnce({ status: 200, data: xml });

    const items = await rssNewsProvider.fetchNews(5);
    expect(items).toHaveLength(5);
  });

  it("semua feed gagal -> array kosong, tidak throw", async () => {
    mockedGet
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"));

    const items = await rssNewsProvider.fetchNews(10);
    expect(items).toEqual([]);
  });

  it("membuang item tanpa headline", async () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item><title></title><pubDate>Mon, 12 Oct 2026 15:37:26 GMT</pubDate></item>
        <item><title>Valid</title><pubDate>Mon, 12 Oct 2026 15:37:26 GMT</pubDate></item>
      </channel></rss>`;

    mockedGet
      .mockResolvedValueOnce({ status: 200, data: xml })
      .mockResolvedValueOnce({ status: 200, data: "<rss/>" })
      .mockResolvedValueOnce({ status: 200, data: "<rss/>" });

    const items = await rssNewsProvider.fetchNews(10);
    expect(items).toHaveLength(1);
    expect(items[0].headline).toBe("Valid");
  });

  it("mengurutkan hasil terbaru dulu", async () => {
    mockedGet
      .mockResolvedValueOnce({ status: 200, data: RSS_2_0 }) // 2 item, tanggal berbeda
      .mockResolvedValueOnce({ status: 200, data: "<rss/>" })
      .mockResolvedValueOnce({ status: 200, data: "<rss/>" });

    const items = await rssNewsProvider.fetchNews(10);
    expect(items[0].headline).toBe("Second News"); // 13 Oct lebih baru dari 12 Oct
    expect(items[1].headline).toBe("First News");
  });
});