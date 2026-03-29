import { describe, expect, it } from "vitest";
import {
  adjustNoteIndicesForEdit,
  fileNotesSidecarRelPath,
  injectNoteMarkersInBodyMd,
  parseFileNotesJson,
  NOTE_MARK_END,
  NOTE_MARK_START,
} from "../lib/fileNotes";

describe("fileNotesSidecarRelPath", () => {
  it("maps markdown path under .metadata/notes mirroring the file path", () => {
    expect(fileNotesSidecarRelPath("a/b/Note.md")).toBe(
      ".metadata/notes/a/b/Note.md.json"
    );
    expect(fileNotesSidecarRelPath("foo.md")).toBe(".metadata/notes/foo.md.json");
  });
});

describe("injectNoteMarkersInBodyMd", () => {
  it("wraps non-overlapping ranges and preserves UTF-16 indices", () => {
    const body = "0123456789";
    const notes = [
      { index: [7, 10] as [number, number], value: "a", resolved: false },
      { index: [0, 2] as [number, number], value: "b", resolved: false },
    ];
    const { marked: out } = injectNoteMarkersInBodyMd(body, notes);
    const pairs: string[] = [];
    let from = 0;
    while (from < out.length) {
      const a = out.indexOf(NOTE_MARK_START, from);
      if (a === -1) break;
      const b = out.indexOf(NOTE_MARK_END, a + 1);
      expect(b).toBeGreaterThan(a);
      pairs.push(out.slice(a + 1, b));
      from = b + 1;
    }
    expect(pairs).toContain("01");
    expect(pairs).toContain("789");
  });

  it("handles list item content with task markers", () => {
    const body = "- [ ] Task item\n- [x] Done item";
    const notes = [
      { index: [6, 15] as [number, number], value: "note on task", resolved: false },
    ];
    const { marked: out } = injectNoteMarkersInBodyMd(body, notes);
    expect(out).toContain(NOTE_MARK_START);
    expect(out).toContain(NOTE_MARK_END);
    // Extract marked content
    const start = out.indexOf(NOTE_MARK_START);
    const end = out.indexOf(NOTE_MARK_END);
    expect(out.slice(start + 1, end)).toBe("Task item");
  });

  it("skips resolved notes", () => {
    const body = "Hello world";
    const notes = [
      { index: [0, 5] as [number, number], value: "resolved", resolved: true },
    ];
    const { marked: out } = injectNoteMarkersInBodyMd(body, notes);
    expect(out).not.toContain(NOTE_MARK_START);
    expect(out).toBe(body);
  });

  it("handles non-touching adjacent notes", () => {
    const body = "abcdefgh";
    const notes = [
      { index: [0, 2] as [number, number], value: "first", resolved: false },
      { index: [4, 6] as [number, number], value: "second", resolved: false },
    ];
    const { marked: out } = injectNoteMarkersInBodyMd(body, notes);
    const pairs: string[] = [];
    let from = 0;
    while (from < out.length) {
      const a = out.indexOf(NOTE_MARK_START, from);
      if (a === -1) break;
      const b = out.indexOf(NOTE_MARK_END, a + 1);
      pairs.push(out.slice(a + 1, b));
      from = b + 1;
    }
    expect(pairs).toContain("ab");
    expect(pairs).toContain("ef");
  });

  it("skips overlapping ranges", () => {
    const body = "0123456789";
    const notes = [
      { index: [0, 5] as [number, number], value: "first", resolved: false },
      { index: [3, 8] as [number, number], value: "overlaps", resolved: false },
    ];
    const { marked: out } = injectNoteMarkersInBodyMd(body, notes);
    // Only first note should be wrapped, second overlaps
    const count = (out.match(new RegExp(NOTE_MARK_START, "g")) || []).length;
    expect(count).toBe(1);
  });
});

describe("parseFileNotesJson", () => {
  it("parses a valid list", () => {
    const raw = `[{"index":[1,3],"value":"hi","resolved":true}]`;
    expect(parseFileNotesJson(raw)).toEqual([
      { index: [1, 3], value: "hi", resolved: true },
    ]);
  });

  it("handles empty array", () => {
    expect(parseFileNotesJson("[]")).toEqual([]);
  });

  it("handles invalid JSON gracefully", () => {
    expect(parseFileNotesJson("not json")).toEqual([]);
    expect(parseFileNotesJson("{invalid}")).toEqual([]);
  });

  it("filters out entries with invalid index format", () => {
    const raw = `[
      {"index":[1,3],"value":"valid","resolved":false},
      {"index":"invalid","value":"bad","resolved":false},
      {"index":[1],"value":"incomplete","resolved":false}
    ]`;
    const result = parseFileNotesJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("valid");
  });
});

describe("adjustNoteIndicesForEdit", () => {
  const mkNote = (s: number, e: number, value = "n"): { index: [number, number]; value: string; resolved: boolean } => ({
    index: [s, e], value, resolved: false,
  });

  it("returns null when text is unchanged", () => {
    expect(adjustNoteIndicesForEdit([mkNote(0, 5)], "hello", "hello")).toBeNull();
  });

  it("returns null when there are no notes", () => {
    expect(adjustNoteIndicesForEdit([], "hello", "hello world")).toBeNull();
  });

  it("shifts note forward when text is inserted before it", () => {
    const notes = [mkNote(6, 11)]; // "world" in "hello world"
    const result = adjustNoteIndicesForEdit(notes, "hello world", "hello\n world");
    expect(result).not.toBeNull();
    expect(result![0].index).toEqual([7, 12]);
  });

  it("shifts note backward when text is deleted before it", () => {
    const notes = [mkNote(6, 11)]; // "world" in "hello world"
    const result = adjustNoteIndicesForEdit(notes, "hello world", "hllo world");
    expect(result).not.toBeNull();
    expect(result![0].index).toEqual([5, 10]);
  });

  it("does not move note when edit is after it", () => {
    const notes = [mkNote(0, 5)]; // "hello" in "hello world"
    const result = adjustNoteIndicesForEdit(notes, "hello world", "hello world!!");
    expect(result).toBeNull(); // no change needed
  });

  it("expands note when text is inserted inside it", () => {
    const notes = [mkNote(0, 11)]; // "hello world"
    const result = adjustNoteIndicesForEdit(notes, "hello world", "hello big world");
    expect(result).not.toBeNull();
    expect(result![0].index).toEqual([0, 15]);
  });

  it("handles newline insertion shifting multiple notes", () => {
    const notes = [mkNote(0, 3), mkNote(5, 8)]; // "abc" and "fgh" in "abc\nfgh\n"
    const result = adjustNoteIndicesForEdit(notes, "abc\nfgh\n", "abc\n\nfgh\n");
    expect(result).not.toBeNull();
    expect(result![0].index).toEqual([0, 3]); // before edit – unchanged
    expect(result![1].index).toEqual([6, 9]); // shifted by 1
  });

  it("drops note when edit partially overlaps it", () => {
    const notes = [mkNote(3, 7)]; // "lo w" in "hello world"
    // Replace " world" (positions 5–11) with "XX" – edit starts inside the note
    const result = adjustNoteIndicesForEdit(notes, "hello world", "helloXX");
    expect(result).not.toBeNull();
    expect(result!.length).toBe(0);
  });

  it("preserves resolved notes and shifts them", () => {
    const notes = [{ index: [6, 11] as [number, number], value: "n", resolved: true }];
    const result = adjustNoteIndicesForEdit(notes, "hello world", "hello\n world");
    expect(result).not.toBeNull();
    expect(result![0].index).toEqual([7, 12]);
    expect(result![0].resolved).toBe(true);
  });
});
