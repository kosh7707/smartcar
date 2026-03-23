// ── Generic file tree utilities ──

export interface TreeNode<T = unknown> {
  name: string;
  path: string;
  children: TreeNode<T>[];
  data?: T; // leaf nodes (files) only
}

/**
 * Build a hierarchical tree from a flat list of items.
 * @param items  Flat file list
 * @param getPath  Accessor returning the slash-separated path for each item
 */
export function buildTree<T>(items: T[], getPath: (item: T) => string): TreeNode<T> {
  const root: TreeNode<T> = { name: "", path: "", children: [] };

  for (const item of items) {
    const filePath = getPath(item);
    const parts = filePath.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join("/");

      if (isFile) {
        current.children.push({ name: part, path: pathSoFar, children: [], data: item });
      } else {
        let folder = current.children.find((c) => c.name === part && !c.data);
        if (!folder) {
          folder = { name: part, path: pathSoFar, children: [] };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  sortNodes(root.children);
  return root;
}

/** Sort: folders first, then alphabetical by name. Recursive. */
function sortNodes<T>(nodes: TreeNode<T>[]) {
  nodes.sort((a, b) => {
    const aIsFolder = !a.data;
    const bIsFolder = !b.data;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const n of nodes) sortNodes(n.children);
}

/** Count leaf (file) nodes recursively. */
export function countFiles<T>(node: TreeNode<T>): number {
  if (node.data) return 1;
  return node.children.reduce((sum, c) => sum + countFiles(c), 0);
}

/** Filter tree by search query (case-insensitive). Returns null if no match. */
export function filterTree<T>(node: TreeNode<T>, query: string): TreeNode<T> | null {
  if (node.data) {
    return node.name.toLowerCase().includes(query) ? node : null;
  }
  // If the folder name itself matches, keep all children
  if (node.name.toLowerCase().includes(query)) return node;
  const filtered = node.children
    .map((c) => filterTree(c, query))
    .filter(Boolean) as TreeNode<T>[];
  if (filtered.length === 0) return null;
  return { ...node, children: filtered };
}

/** Get top-level directory summaries: name + file count. */
export function getTopDirs<T>(root: TreeNode<T>): { name: string; count: number }[] {
  return root.children
    .filter((c) => !c.data) // folders only
    .map((c) => ({ name: c.name, count: countFiles(c) }));
}
