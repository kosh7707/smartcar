import { describe, it, expect } from "vitest";
import { buildTree, filterTree, countFiles, getTopDirs } from "./tree";

interface TestFile {
  path: string;
  size: number;
}

const getPath = (f: TestFile) => f.path;

describe("buildTree", () => {
  it("builds a flat file list into a tree", () => {
    const files: TestFile[] = [
      { path: "a.txt", size: 1 },
      { path: "b.txt", size: 2 },
    ];
    const root = buildTree(files, getPath);
    expect(root.children).toHaveLength(2);
    expect(root.children[0].name).toBe("a.txt");
    expect(root.children[0].data).toEqual(files[0]);
    expect(root.children[1].name).toBe("b.txt");
  });

  it("creates nested folders", () => {
    const files: TestFile[] = [
      { path: "src/main.c", size: 100 },
      { path: "src/util.c", size: 200 },
      { path: "include/header.h", size: 50 },
    ];
    const root = buildTree(files, getPath);
    // folders first, alphabetically
    expect(root.children).toHaveLength(2);
    expect(root.children[0].name).toBe("include");
    expect(root.children[0].children).toHaveLength(1);
    expect(root.children[1].name).toBe("src");
    expect(root.children[1].children).toHaveLength(2);
  });

  it("sorts folders before files", () => {
    const files: TestFile[] = [
      { path: "readme.txt", size: 10 },
      { path: "src/main.c", size: 100 },
    ];
    const root = buildTree(files, getPath);
    expect(root.children[0].name).toBe("src"); // folder first
    expect(root.children[1].name).toBe("readme.txt"); // file second
  });

  it("handles deeply nested paths", () => {
    const files: TestFile[] = [{ path: "a/b/c/d/e.txt", size: 1 }];
    const root = buildTree(files, getPath);
    let node = root;
    for (const name of ["a", "b", "c", "d"]) {
      expect(node.children).toHaveLength(1);
      node = node.children[0];
      expect(node.name).toBe(name);
      expect(node.data).toBeUndefined();
    }
    expect(node.children).toHaveLength(1);
    expect(node.children[0].name).toBe("e.txt");
    expect(node.children[0].data).toBeDefined();
  });

  it("handles empty input", () => {
    const root = buildTree([], getPath);
    expect(root.children).toHaveLength(0);
  });

  it("filters empty path segments (double slashes)", () => {
    const files: TestFile[] = [{ path: "a//b.txt", size: 1 }];
    const root = buildTree(files, getPath);
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe("a");
    expect(root.children[0].children[0].name).toBe("b.txt");
  });

  it("skips trailing slashes", () => {
    const files: TestFile[] = [{ path: "folder/", size: 0 }];
    const root = buildTree(files, getPath);
    // trailing slash filtered → "folder" is a file node (single segment)
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe("folder");
  });

  it("skips empty paths", () => {
    const files: TestFile[] = [
      { path: "", size: 0 },
      { path: "a.txt", size: 1 },
    ];
    const root = buildTree(files, getPath);
    expect(root.children).toHaveLength(1);
    expect(root.children[0].name).toBe("a.txt");
  });

  it("merges multiple files in same folder", () => {
    const files: TestFile[] = [
      { path: "src/a.c", size: 1 },
      { path: "src/b.c", size: 2 },
      { path: "src/sub/c.c", size: 3 },
    ];
    const root = buildTree(files, getPath);
    const src = root.children[0];
    expect(src.name).toBe("src");
    // sub folder first, then files
    expect(src.children[0].name).toBe("sub");
    expect(src.children[1].name).toBe("a.c");
    expect(src.children[2].name).toBe("b.c");
  });
});

describe("countFiles", () => {
  it("counts files in nested tree", () => {
    const files: TestFile[] = [
      { path: "a/b.c", size: 1 },
      { path: "a/c.c", size: 2 },
      { path: "d.c", size: 3 },
    ];
    const root = buildTree(files, getPath);
    expect(countFiles(root)).toBe(3);
    expect(countFiles(root.children[0])).toBe(2); // folder "a"
  });

  it("returns 1 for file node", () => {
    const files: TestFile[] = [{ path: "a.txt", size: 1 }];
    const root = buildTree(files, getPath);
    expect(countFiles(root.children[0])).toBe(1);
  });

  it("returns 0 for empty tree", () => {
    const root = buildTree([], getPath);
    expect(countFiles(root)).toBe(0);
  });
});

describe("filterTree", () => {
  it("filters by filename (case-insensitive)", () => {
    const files: TestFile[] = [
      { path: "src/Main.c", size: 1 },
      { path: "src/util.c", size: 2 },
      { path: "include/header.h", size: 3 },
    ];
    const root = buildTree(files, getPath);
    const result = filterTree(root, "main");
    expect(result).not.toBeNull();
    expect(countFiles(result!)).toBe(1);
  });

  it("returns null when nothing matches", () => {
    const files: TestFile[] = [{ path: "a.txt", size: 1 }];
    const root = buildTree(files, getPath);
    expect(filterTree(root, "zzz")).toBeNull();
  });

  it("preserves parent folders of matched files", () => {
    const files: TestFile[] = [
      { path: "src/deep/target.c", size: 1 },
      { path: "src/deep/other.c", size: 2 },
    ];
    const root = buildTree(files, getPath);
    const result = filterTree(root, "target");
    expect(result).not.toBeNull();
    const src = result!.children[0];
    expect(src.name).toBe("src");
    expect(src.children[0].name).toBe("deep");
    expect(src.children[0].children).toHaveLength(1);
    expect(src.children[0].children[0].name).toBe("target.c");
  });

  it("matches folder names too", () => {
    const files: TestFile[] = [
      { path: "gateway/main.c", size: 1 },
      { path: "other/util.c", size: 2 },
    ];
    const root = buildTree(files, getPath);
    const result = filterTree(root, "gateway");
    expect(result).not.toBeNull();
    expect(countFiles(result!)).toBe(1);
  });
});

describe("getTopDirs", () => {
  it("returns top-level directories with file counts", () => {
    const files: TestFile[] = [
      { path: "gateway/a.c", size: 1 },
      { path: "gateway/b.c", size: 2 },
      { path: "body/c.c", size: 3 },
      { path: "root.txt", size: 4 },
    ];
    const root = buildTree(files, getPath);
    const dirs = getTopDirs(root);
    expect(dirs).toHaveLength(2); // gateway, body (root.txt excluded)
    expect(dirs.find((d) => d.name === "gateway")?.count).toBe(2);
    expect(dirs.find((d) => d.name === "body")?.count).toBe(1);
  });

  it("returns empty for flat files", () => {
    const files: TestFile[] = [{ path: "a.txt", size: 1 }];
    const root = buildTree(files, getPath);
    expect(getTopDirs(root)).toHaveLength(0);
  });
});
