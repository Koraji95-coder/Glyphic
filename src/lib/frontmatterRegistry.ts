/**
 * Module-level registry mapping vault-relative note paths to their raw
 * frontmatter strings (including surrounding `---` fences).
 *
 * Populated by `useEditor` on note load and shared with the ChatPanel's
 * "pin model to note" feature so both operate on the same in-memory
 * frontmatter rather than racing through separate `readNote` calls.
 */
const _registry = new Map<string, string>();

export const frontmatterRegistry = {
  get: (path: string): string => _registry.get(path) ?? '',
  set: (path: string, frontmatter: string): void => {
    _registry.set(path, frontmatter);
  },
};
