import { useTagsStore } from '../../stores/tagsStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';
import { FileTreeItem } from './FileTreeItem';

/** Recursively keep only files in `filtered` and folders that contain at least
 *  one descendant file in `filtered`. */
function filterTree(entries: VaultEntry[], filtered: Set<string>): VaultEntry[] {
  const out: VaultEntry[] = [];
  for (const e of entries) {
    if (e.entry_type === 'file') {
      if (filtered.has(e.path)) out.push(e);
    } else {
      const kids = e.children ? filterTree(e.children, filtered) : [];
      if (kids.length > 0) {
        out.push({ ...e, children: kids });
      }
    }
  }
  return out;
}

export function FileTree() {
  const fileTree = useVaultStore((s) => s.fileTree);
  const filteredPaths = useTagsStore((s) => s.filteredPaths);
  const selectedTag = useTagsStore((s) => s.selectedTag);

  const visible = filteredPaths ? filterTree(fileTree, filteredPaths) : fileTree;

  if (!fileTree || fileTree.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full px-4 text-center"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <p className="text-sm">No notes yet</p>
        <p className="text-xs mt-1">Create a note to get started</p>
      </div>
    );
  }

  if (filteredPaths && visible.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center px-4 text-center"
        style={{ color: 'var(--text-tertiary)', padding: '16px 8px' }}
      >
        <p className="text-sm">No notes tagged #{selectedTag}</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {visible.map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} depth={0} />
      ))}
    </div>
  );
}
