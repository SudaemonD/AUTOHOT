// A paused external source must not accept new reports or look healthy after a rejected push.
// A report of a page the engine cannot read without JS carries its own text, which is then the body.
import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { MAX_BODY_CHARS } from "@aihot/backend/editorial/writing";
import { IngestError, ingestItems } from "@aihot/backend/ingest/items";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { tag } from "./setup.ts";

after(async () => {
  await stopBoss();
  await closeDb();
});

test("a paused external source rejects pushed items without recording a successful fetch", async () => {
  const sourceId = `test-paused-ingest-${tag()}`;
  const lastOkAt = new Date("2026-09-01T00:00:00Z");
  await sql`
    INSERT INTO sources (id, name, kind, config, tier, participation_mode, enabled, health, last_ok_at)
    VALUES (${sourceId}, 'Paused external source', 'external', '{}'::jsonb, 'T2', 'editorial', false, 'paused', ${lastOkAt})`;

  await assert.rejects(
    ingestItems({ sourceId, items: [{ title: "New report", url: `https://example.org/${sourceId}` }] }),
    (error: unknown) => error instanceof IngestError && error.status === 409,
  );

  const [source] = await sql<{ last_ok_at: Date }[]>`SELECT last_ok_at FROM sources WHERE id = ${sourceId}`;
  const [articles] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM articles WHERE source_id = ${sourceId}`;
  assert.equal(source!.last_ok_at.toISOString(), lastOkAt.toISOString());
  assert.equal(articles!.count, 0);

  await sql`UPDATE sources SET enabled = true WHERE id = ${sourceId}`;
  assert.deepEqual(await ingestItems({ sourceId, items: [{ title: "New report", url: `https://example.org/${sourceId}` }] }), { ok: true, created: 1 });
});

test("a reported body is kept as the confirmed body, cut to what the analysis reads", async () => {
  const sourceId = `test-body-ingest-${tag()}`;
  const body = "深蓝汽车官方公告：自研天枢智能，取得 L3 级自动驾驶产品准入许可。".repeat(10);
  assert.deepEqual(
    await ingestItems({
      sourceId, sourceName: "深蓝汽车官网",
      items: [
        { title: "官方公告", url: `https://example.org/${sourceId}/a`, publishedAt: "2026-10-01T10:00:00+08:00", body },
        { title: "超长正文", url: `https://example.org/${sourceId}/b`, body: "长".repeat(MAX_BODY_CHARS + 500) },
      ],
    }),
    { ok: true, created: 2 },
  );
  const rows = await sql<{ url: string; body_text: string | null; body_status: string; kind: string; participation_mode: string }[]>`
    SELECT a.url, a.body_text, a.body_status, s.kind, s.participation_mode
    FROM articles a JOIN sources s ON s.id = a.source_id WHERE a.source_id = ${sourceId} ORDER BY a.url`;
  assert.equal(rows.length, 2);
  // A JS-only page reports its own text: the article has a body, so there is no page left to fetch.
  assert.equal(rows[0]!.body_status, "ok");
  assert.equal(rows[0]!.body_text, body);
  assert.equal(rows[1]!.body_text?.length, MAX_BODY_CHARS);
  // An unknown source is still created isolated: an operator admits it to public surfaces.
  assert.equal(rows[0]!.kind, "external");
  assert.equal(rows[0]!.participation_mode, "isolated");
});
