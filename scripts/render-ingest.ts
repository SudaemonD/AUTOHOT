// Reports the sites in scripts/render-sites.json: the single-page apps the engine cannot collect at
// all (their lists carry no links, their article APIs answer with encrypted payloads or need JS). A
// real browser renders list and article here, and the text it read travels with the report — a report
// without a body leaves the engine fetching a page it cannot read, and the article would never reach
// a public surface. What differs per site is data, not code: see that file.
//   node --env-file=.env scripts/render-ingest.ts [--site <sourceId>] [--limit 10] [--dry-run]
// Runs on this machine rather than in a container: the browser is the repository's own Playwright
// (a dev dependency; install its browsers once with npx playwright install chromium). Repeat runs are
// safe — the ingest route dedupes by URL, and a body that has not changed is not a new revision.
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

interface Profile {
  sourceId: string;
  sourceName: string;
  listUrl: string;
  /** The item's title followed by its day, as one line; the day is the pattern's last group. */
  rowPattern: string;
  /** What the address must contain once a row is open: the click went through. */
  detailUrl: string;
  /** Footer and page chrome: everything from a matching line on is dropped. */
  chrome?: string;
  /** Drop items with no text at all (image-only posts) instead of pushing them. */
  skipEmptyBody?: boolean;
}

const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};

const LIMIT = Math.min(50, Math.max(1, Number(arg("limit") ?? "10") || 10));
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = arg("site");
/** Deepal and the other brand sites of this industry all date in Beijing time. */
const UTC_OFFSET = "+08:00";

const token = process.env.INGEST_TOKEN ?? "";
const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
if (!token) throw new Error("INGEST_TOKEN is not set (run with --env-file=.env)");

const file = JSON.parse(readFileSync(path.join(import.meta.dirname, "render-sites.json"), "utf8")) as { sites?: Profile[] };
const sites = (file.sites ?? []).filter((s) => !ONLY || s.sourceId === ONLY);
if (!sites.length) throw new Error(ONLY ? `render-sites.json 里没有 ${ONLY}` : "render-sites.json 里没有站点");

/**
 * The list's items: each is a node whose text is exactly the item's title and its day. A node that
 * wraps several items carries a day inside its own title, and the day-only leaves have no title at
 * all — both are dropped, which leaves the cards themselves.
 */
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

for (const site of sites) {
  console.log(`\n== ${site.sourceName}（${site.sourceId}）`);
  const browser = await chromium.launch();
  const items: Array<{ title: string; url: string; publishedAt?: string; body: string }> = [];
  let empty = 0;
  try {
    const page = await browser.newPage({ locale: "zh-CN" });
    await page.goto(site.listUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(6_000);
    const rows = (await listRows(page, site.rowPattern)).slice(0, LIMIT);
    console.log(`列表里取到 ${rows.length} 条`);

    for (const row of rows) {
      // The list holds no links: open the row itself and read the address the app moved to.
      await page.goto(site.listUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(3_500);
      await page.getByText(row.title.slice(0, 12), { exact: false }).first().click().catch(() => {});
      await page.waitForTimeout(4_500);
      const url = page.url();
      if (!url.includes(site.detailUrl)) {
        console.log(`  跳过（没进详情页）：${row.title.slice(0, 24)}`);
        continue;
      }
      const lines = await articleLines(page, row.date);
      const byline = lines.find((line) => line.includes(row.date)) ?? row.date;
      const stamp = /(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2}))?/.exec(byline);
      const from = lines.indexOf(byline) + 1;
      const cut = site.chrome ? lines.findIndex((line, i) => i >= from && new RegExp(site.chrome!).test(line)) : -1;
      const body = lines
        .slice(from, cut < 0 ? undefined : cut)
        .filter((line) => line !== row.title)
        .join("\n");
      if (!body && site.skipEmptyBody) {
        empty += 1;
        console.log(`  跳过（没有正文，多半是图片公告）：${row.title.slice(0, 24)}`);
        continue;
      }
      console.log(`  ${row.title.slice(0, 24)} | ${stamp?.[0] ?? row.date} | 正文 ${body.length} 字`);
      items.push({
        title: row.title,
        url,
        publishedAt: `${stamp?.[1] ?? row.date}T${stamp?.[2] ?? "00:00:00"}${UTC_OFFSET}`,
        body,
      });
    }
  } finally {
    await browser.close();
  }

  if (DRY_RUN) {
    console.log(`--dry-run：${items.length} 条不推送（跳过 ${empty} 条无正文）`);
    continue;
  }
  if (!items.length) {
    console.log("没有可推送的条目");
    continue;
  }
  const res = await fetch(`${base}/api/ingest/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: site.sourceId, sourceName: site.sourceName, items }),
  });
  console.log(`推送 ${items.length} 条 → ${res.status} ${await res.text()}`);
}
