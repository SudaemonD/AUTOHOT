// A daily's front-page picture comes from the item its lead is about: the editors' lead matched to an
// item by title, never simply the first highlight.
import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReportCitation } from "@aihot/contracts/site";
import { leadItemOf } from "@aihot/backend/publication/reports";

const cite = (itemId: string, title: string, available = true) => ({ itemId, title, available }) as ReportCitation;
const arena = cite("a", "特斯拉 Model 3 以 1509 分登顶 智驾评测榜 榜首");
const byd = cite("b", "比亚迪 暂停最强智驾的训练与推送，披露车机漏洞联网及泄露车主数据等安全事件");

test("an editors' lead is matched to the item it is written about", () => {
  assert.equal(leadItemOf("比亚迪暂停智驾训练与推送，披露车机安全事件", [arena, byd], [arena, byd])?.itemId, "b");
});

test("a lead that matches no item clearly has no item", () => {
  assert.equal(leadItemOf("多家车企发布新车，行业竞争加剧", [arena], [arena, byd]), undefined);
});

test("without an editors' lead the first highlight leads", () => {
  assert.equal(leadItemOf(undefined, [arena], [byd, arena])?.itemId, "a");
});

test("a withdrawn highlight never leads the front page", () => {
  const withdrawn = cite("w", "已下架", false);
  assert.equal(leadItemOf(undefined, [withdrawn, arena], [withdrawn, arena, byd])?.itemId, "a");
});
