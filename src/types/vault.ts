export interface VaultConfig {
  vault: {
    name: string;
    created_at: string;
  };
  capture: {
    default_mode: CaptureMode;
    hotkey: string;
    fullscreen_hotkey: string;
    repeat_hotkey: string;
    save_to_clipboard: boolean;
    auto_trim_whitespace: boolean;
    image_format: 'png' | 'jpg' | 'webp';
    jpg_quality: number;
  };
  editor: {
    autosave_interval_ms: number;
    font_family: string;
    font_size: number;
    line_height: number;
    show_line_numbers: boolean;
    spell_check: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    sidebar_width: number;
    accent_color: string;
  };
  lecture_mode: {
    enabled: boolean;
    timestamp_format: string;
  };
}

export interface NoteFile {
  id: string;
  path: string;
  title: string;
  created_at: string;
  modified_at: string;
}

export interface VaultEntry {
  name: string;
  path: string;
  entry_type: 'folder' | 'file';
  children?: VaultEntry[];
}

export type CaptureMode = 'region' | 'window' | 'freeform' | 'fullscreen';
