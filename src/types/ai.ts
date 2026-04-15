export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ModelRouting {
  chat: string;
  summarize: string;
  flashcards: string;
  explain: string;
  vision: string;
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
  model_routing: ModelRouting;
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

export interface McpToolExecution {
  toolName: string;
  status: 'pending' | 'executing' | 'complete' | 'error';
  result?: string;
}
