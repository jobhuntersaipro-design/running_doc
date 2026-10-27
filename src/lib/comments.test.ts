import { describe, expect, it } from "vitest";
import { toThread, type CommentRow } from "./comments";

const row = (id: string, parentId: string | null, extra: Partial<CommentRow> = {}): CommentRow => ({
  id,
  parentId,
  authorId: `p${id}`,
  name: `Runner ${id}`,
  body: `body ${id}`,
  createdAt: "2026-10-03T00:51:00Z",
  edited: false,
  deleted: false,
  reactions: {},
  ...extra,
});

describe("toThread", () => {
  it("nests replies, lifts orphans to the top and keeps deleted comments only while they have replies", () => {
    const thread = toThread([
      row("1", null, { deleted: true }),
      row("2", "1", { reactions: { "😂": ["a"], "👍": ["a", "b"] } }),
      row("3", null, { deleted: true }),
      row("4", "99"),
    ]);
    expect(thread.map((c) => c.id)).toEqual(["1", "4"]);
    expect(thread[0]).toMatchObject({ deleted: true, body: "", createdAt: "3 Oct, 08:51" });
    expect(thread[0].replies?.map((c) => c.id)).toEqual(["2"]);
    // Reactions follow the picker's order, not the database's.
    expect(thread[0].replies?.[0].reactions).toEqual([
      { emoji: "👍", users: ["a", "b"] },
      { emoji: "😂", users: ["a"] },
    ]);
  });
});
