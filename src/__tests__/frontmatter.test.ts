import { describe, expect, it } from 'vitest';
import {
  composeNote,
  extractFrontmatter,
  splitFrontmatter,
  upsertFrontmatterField,
} from '../lib/tiptap/markdownParser';

const SAMPLE_NOTE = `---
title: "Capacitor energy notes"
created: "2026-04-01T00:00:00Z"
modified: "2026-04-01T12:00:00Z"
tags: [fe-exam, electromagnetics]
---
Body text here.
`;

describe('upsertFrontmatterField', () => {
  it('inserts a new field before the closing ---', () => {
    const { frontmatter } = splitFrontmatter(SAMPLE_NOTE);
    const updated = upsertFrontmatterField(frontmatter, 'ai_model', 'llama3.1:70b');
    expect(updated).toContain('ai_model: llama3.1:70b');
    expect(updated).toMatch(/ai_model: llama3\.1:70b\n---/);
  });

  it('replaces an existing field', () => {
    const { frontmatter } = splitFrontmatter(SAMPLE_NOTE);
    const withModel = upsertFrontmatterField(frontmatter, 'ai_model', 'llava');
    const replaced = upsertFrontmatterField(withModel, 'ai_model', 'llama3.2:3b');
    expect(replaced).toContain('ai_model: llama3.2:3b');
    expect(replaced).not.toContain('ai_model: llava');
  });

  it('removes the field when value is null', () => {
    const { frontmatter } = splitFrontmatter(SAMPLE_NOTE);
    const withModel = upsertFrontmatterField(frontmatter, 'ai_model', 'llava');
    const removed = upsertFrontmatterField(withModel, 'ai_model', null);
    expect(removed).not.toContain('ai_model');
  });

  it('round-trips: inserting then preserving on composeNote', () => {
    const { frontmatter, body } = splitFrontmatter(SAMPLE_NOTE);
    const updatedFm = upsertFrontmatterField(frontmatter, 'ai_model', 'llama3.1:70b');
    const composed = composeNote({ frontmatter: updatedFm, body });
    const { frontmatter: fm2 } = splitFrontmatter(composed);
    expect(fm2).toContain('ai_model: llama3.1:70b');
    // modified should have been refreshed
    expect(fm2).not.toContain('2026-04-01T12:00:00Z');
  });
});

describe('extractFrontmatter ai_model', () => {
  it('parses ai_model from frontmatter', () => {
    const note = `---
title: "Test"
ai_model: llama3.1:70b
tags: []
---
body`;
    const fm = extractFrontmatter(note);
    expect(fm?.ai_model).toBe('llama3.1:70b');
  });

  it('returns undefined when ai_model is absent', () => {
    const fm = extractFrontmatter(SAMPLE_NOTE);
    expect(fm?.ai_model).toBeUndefined();
  });
});
