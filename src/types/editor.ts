export interface EditorDocument {
  content: string;
  frontmatter: NoteFrontmatter;
}

export interface NoteFrontmatter {
  title: string;
  created: string;
  modified: string;
  tags: string[];
  lecture_timestamps: boolean;
  ai_model?: string;
}

export interface SearchResult {
  id: string;
  path: string;
  title: string;
  snippet: string;
  match_type: 'note' | 'screenshot' | 'annotation';
}

export interface Backlink {
  source_id: string;
  source_path: string;
  source_title: string;
  context: string;
}
