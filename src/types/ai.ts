export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AiConfig {
  provider: 'ollama' | 'open_ai';
  ollama: {
    endpoint: string;
    model: string;
  };
  openai: {
    api_key: string;
    model: string;
    endpoint: string;
  };
}

/** @deprecated Use AiConfig directly */
export interface AiProviderConfig {
  provider: 'ollama' | 'openai';
  model: string;
  endpoint: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}
