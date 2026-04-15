import { useVaultStore } from '../../stores/vaultStore';
import { FileTreeItem } from './FileTreeItem';

export function FileTree() {
  const fileTree = useVaultStore((s) => s.fileTree);

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

  return (
    <div className="py-1">
      {fileTree.map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} depth={0} />
      ))}
    </div>
  );
}
