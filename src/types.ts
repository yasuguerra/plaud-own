export interface ActionItem {
  id: string;
  task: string;
  importance: 'high' | 'medium' | 'low';
  completed: boolean;
  dueDate?: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  learned: boolean;
}

export interface MindMapNode {
  id: string;
  label: string;
  details?: string;
  color?: string;
  children?: MindMapNode[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface StudySession {
  id: string;
  title: string;
  createdAt: string;
  mediaType: 'audio' | 'video' | 'pdf' | 'document';
  mediaName: string;
  summary: string;
  transcript?: string;
  actionItems: ActionItem[];
  mindMap: MindMapNode;
  flashcards: Flashcard[];
  chatHistory: ChatMessage[];
}

export interface ProcessingStatus {
  stage: 'idle' | 'uploading' | 'transcribing' | 'summarizing' | 'mapping' | 'flashcards' | 'completed' | 'failed';
  progress: number;
  message: string;
}
