// Reports the sites in scripts/render-sites.json: the ones the engine cannot collect by itself. Each
// profile says how to read its site — "browser" for a single-page app (its list carries no links, its
// article API answers with an encrypted payload or needs JS), "api" for a site whose own JSON is
// readable but whose list preview is not the article. Either way the text travels with the report: a
// report without a body leaves the engine fetching a page it cannot read, and the article would never
// reach a public surface. What differs per site is data, not code — see that file.
//   node --env-file=.env scripts/render-ingest.ts [--site <sourceId>] [--limit 10] [--dry-run]
// Runs on this machine rather than in a container. Repeat runs are safe: the ingest route dedupes by
// URL, and a body that has not changed is not a new revision.
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { stripTags } from "@aihot/backend/lib/text";

interface Profile {
  sourceId: string;
  sourceName: string;
  /** Absent means "browser". */
  mode?: "browser" | "api";

  // browser
  /** The item's title followed by its day, as one line; the day is the pattern's last group. */
  listUrl?: string;
  rowPattern?: string;
  /** What the address must contain once a row is open: the click went through. */
  detailUrl?: string;
  /** Footer and page chrome: everything from a matching line on is dropped. */
  chrome?: string;

  // api
  /** Pages whose JSON holds the items, newest first. */
  listUrls?: string[];
  /** Where the items sit in that JSON (a dotted path). */
  itemsPath?: string;
  /** Where each value sits in an item (a dotted path or a plain field name). */
  title?: string;
  publishedAt?: string;
  /** The address readers open, built from the item's fields: {field} is substituted. */
  url?: string;
  /** A field of the item that already holds the text, when the list carries it. */
  body?: string;
  /** Otherwise the text comes from one more request per item. */
  detail?: { url: string; body: string };

  /** Drop items with no text at all (image-only posts) instead of pushing them. */
  skipEmptyBody?: boolean;
}

interface Item {
  title: string;
  url: string;
  publishedAt?: string;
  body: string;
}

const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};

const LIMIT = Math.min(50, Math.max(1, Number(arg("limit") ?? "10") || 10));
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = arg("site");
/** The brand sites of this industry all date in Beijing time. */
const UTC_OFFSET = "+08:00";
const TIMEOUT_MS = 20_000;

const token = process.env.INGEST_TOKEN ?? "";
const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!token) throw new Error("INGEST_TOKEN is not set (run with --env-file=.env)");

const file = JSON.parse(readFileSync(path.join(import.meta.dirname, "render-sites.json"), "utf8")) as { sites?: Profile[] };
const sites = (file.sites ?? []).filter((s) => !ONLY || s.sourceId === ONLY);
if (!sites.length) throw new Error(ONLY ? `render-sites.json 里没有 ${ONLY}` : "render-sites.json 里没有站点");

/** `a.b.0.c` into a parsed JSON body; a plain name is the common case. */
function atPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, key) => (v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined), value);
}

const asText = (value: unknown) => (typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value));

/** The item's own day, in the offset the site means it in. */
function instant(value: string): string | undefined {
  const day = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/.exec(value.trim());
  return day ? `${day[1]}T${day[2] ?? "00:00:00"}${UTC_OFFSET}` : value.trim() || undefined;
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * A site whose own JSON holds the items. Several listings are read as one: the newest items across all
 * of them are pushed, so a limit never spends itself on the first listing alone, and the one request
 * per article is spent only on what is actually pushed.
 */
async function collectApi(profile: Profile): Promise<{ items: Item[]; skipped: number }> {
  const items: Item[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  const candidates: Array<{ title: string; url: string; publishedAt?: string; row: unknown }> = [];
  for (const listUrl of profile.listUrls ?? []) {
    const listing = await getJson(listUrl);
    const rows = (profile.itemsPath ? atPath(listing, profile.itemsPath) : listing) as unknown;
    if (!Array.isArray(rows)) throw new Error(`${profile.sourceId}: ${listUrl} 里没有数组`);
    for (const row of rows) {
      const url = (profile.url ?? "").replace(/\{(\w+)\}/g, (_, field: string) => asText(atPath(row, field)));
      const title = asText(atPath(row, profile.title ?? "title"));
      if (!title || !url || seen.has(url)) continue;
      seen.add(url);
      candidates.push({ title, url, publishedAt: profile.publishedAt ? instant(asText(atPath(row, profile.publishedAt))) : undefined, row });
    }
  }
  candidates.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  for (const candidate of candidates.slice(0, LIMIT)) {
    let body = profile.body ? stripTags(asText(atPath(candidate.row, profile.body))) : "";
    if (!body && profile.detail) {
      const detailUrl = profile.detail.url.replace(/\{(\w+)\}/g, (_, field: string) => asText(atPath(candidate.row, field)));
      body = stripTags(asText(atPath(await getJson(detailUrl), profile.detail.body)));
    }
    if (!body && profile.skipEmptyBody !== false) {
      skipped += 1;
      console.log(`  跳过（没有正文）：${candidate.title.slice(0, 24)}`);
      continue;
    }
    console.log(`  ${candidate.title.slice(0, 24)} | ${candidate.publishedAt?.slice(0, 16) ?? "无时间"} | 正文 ${body.length} 字`);
    items.push({ title: candidate.title, url: candidate.url, publishedAt: candidate.publishedAt, body });
  }
  return { items, skipped };
}

/** The list's items: each is a node whose text is exactly the item's title and its day. A node that
 * wraps several items carries a day inside its own title, and the day-only leaves have no title at
 * all — both are dropped, which leaves the cards themselves. */
async function listRows(page: Page, pattern: string): Promise<Array<{ title: string; date: string }>> {
  return page.evaluate((re) => {
    const row = new RegExp(re);
    const day = /\d{4}-\d{2}-\d{2}/;
    const found = new Map<string, { title: string; date: string }>();
    for (const n of document.querySelectorAll("*")) {
      if (n.children.length > 3) continue;
      const text = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      const m = row.exec(text);
      const title = (m?.[1] ?? "").trim();
      const date = m?.[m.length - 1] ?? "";
      if (title.length < 8 || title.length > 90 || day.test(title)) continue;
      if (!found.has(title)) found.set(title, { title, date });
    }
    return [...found.values()];
  }, pattern);
}

/** The article's own text: the smallest element holding the item's day, read as lines. */
async function articleLines(page: Page, date: string): Promise<string[]> {
  const text = await page.evaluate((day) => {
    let best = "";
    for (const el of document.querySelectorAll("div,article,section,main")) {
      const t = (el.innerText ?? "").trim();
      if (t.length < 80 || !t.includes(day)) continue;
      if (!best || t.length <= best.length) best = t;
    }
    return best;
  }, date);
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A page rendered in a real browser: the list holds no links, so each row is opened to read its address. */
async function collectBrowser(profile: Profile): Promise<{ items: Item[]; skipped: number }> {
  const items: Item[] = [];
  let skipped = 0;
  let empty = 0;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: "zh-CN" });
    await page.goto(profile.listUrl!, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(6_000);
    const rows = (await listRows(page, profile.rowPattern!)).slice(0, LIMIT);
    console.log(`列表里取到 ${rows.length} 条`);

    for (const row of rows) {
      await page.goto(profile.listUrl!, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3_500);
      await page.getByText(row.title.slice(0, 12), { exact: false }).first().click().catch(() => {});
      await page.waitForTimeout(4_500);
      const url = page.url();
      if (!url.includes(profile.detailUrl!)) {
        console.log(`  跳过（没进详情页）：${row.title.slice(0, 24)}`);
        continue;
      }
      const lines = await articleLines(page, row.date);
      const byline = lines.find((line) => line.includes(row.date)) ?? row.date;
      const stamp = /(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}))?/.exec(byline);
      const from = lines.indexOf(byline) + 1;
      const cut = profile.chrome ? lines.findIndex((line, i) => i >= from && new RegExp(profile.chrome!).test(line)) : -1;
      const body = lines
        .slice(from, cut < 0 ? undefined : cut)
        .filter((line) => line !== row.title)
        .join("\n");
      if (!body && profile.skipEmptyBody) {
        empty += 1;
        console.log(`  跳过（没有正文，多半是图片公告）：${row.title.slice(0, 24)}`);
        continue;
      }
      console.log(`  ${row.title.slice(0, 24)} | ${stamp?.[0] ?? row.date} | 正文 ${body.length} 字`);
      items.push({ title: row.title, url, publishedAt: `${stamp?.[1] ?? row.date}T${stamp?.[2] ?? "00:00:00"}${UTC_OFFSET}`, body });
    }
  } finally {
    await browser.close();
  }
  skipped += empty;
  return { items, skipped };
}

for (const site of sites) {
  console.log(`\n== ${site.sourceName}（${site.sourceId}，${site.mode ?? "browser"}）`);
  let result: { items: Item[]; skipped: number };
  try {
    result = site.mode === "api" ? await collectApi(site) : await collectBrowser(site);
  } catch (error) {
    console.log(`  失败：${error instanceof Error ? error.message : String(error)}`);
    continue;
  }
  if (DRY_RUN) {
    console.log(`--dry-run：${result.items.length} 条不推送（跳过 ${result.skipped} 条无正文）`);
    continue;
  }
  if (!result.items.length) {
    console.log("没有可推送的条目");
    continue;
  }
  const res = await fetch(`${base}/api/ingest/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: site.sourceId, sourceName: site.sourceName, items: result.items }),
  });
  console.log(`推送 ${result.items.length} 条 → ${res.status} ${await res.text()}`);
}
