export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AiProviderConfig {
  provider: 'ollama' | 'openai';
  model: string;
  endpoint: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}
