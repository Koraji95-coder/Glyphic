import { FolderOpen } from 'lucide-react';

import { useTagsStore } from '../../stores/tagsStore';
import { useVaultStore } from '../../stores/vaultStore';
import type { VaultEntry } from '../../types/vault';
import { FileTreeItem } from './FileTreeItem';

/** Recursively filter tree to only show files that match the tag filter */
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
      <div className="flex flex-col items-center justify-center h-full px-6 text-center py-12">
        <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-4">
          <FolderOpen size={24} className="text-zinc-400" />
        </div>
        <p className="text-zinc-300 font-medium">No notes yet</p>
        <p className="text-xs text-zinc-500 mt-1">Create your first note to get started</p>
      </div>
    );
  }

  if (filteredPaths && visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-zinc-400 text-sm">No notes tagged #{selectedTag}</p>
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