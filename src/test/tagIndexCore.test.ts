import { describe, expect, it } from "vitest";
import {
  removePathFromIndex,
  renamePathInIndex,
  setTagsForFile,
  tagsForFile,
} from "../lib/tagIndexCore";

describe("tagIndexCore", () => {
  it("sets and reads tags for a file", () => {
    let idx = setTagsForFile({}, "a.md", ["work", "ideas"]);
    expect(tagsForFile(idx, "a.md")).toEqual(["ideas", "work"]);
    idx = setTagsForFile(idx, "a.md", ["work"]);
    expect(tagsForFile(idx, "a.md")).toEqual(["work"]);
    expect(idx).toEqual({ work: ["a.md"] });
  });

  it("renames a file path in the index", () => {
    const idx = { t: ["old.md", "other.md"] };
    const next = renamePathInIndex(idx, "old.md", "new.md");
    expect(next.t).toEqual(["new.md", "other.md"]);
  });

  it("renames under a folder prefix", () => {
    const idx = { t: ["d/a.md", "d/b.md", "x.md"] };
    const next = renamePathInIndex(idx, "d", "e");
    expect(next.t?.sort()).toEqual(["e/a.md", "e/b.md", "x.md"].sort());
  });

  it("removes a file and directory contents", () => {
    const idx = { t: ["x.md", "d/a.md", "d/b.md"] };
    expect(removePathFromIndex(idx, "x.md", false).t?.sort()).toEqual([
      "d/a.md",
      "d/b.md",
    ]);
    expect(removePathFromIndex(idx, "d", true).t).toEqual(["x.md"]);
  });
});
