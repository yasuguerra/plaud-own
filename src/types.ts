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
  folderId?: string | null; // Topic folder ID association
  gcsUri?: string;           // Google Cloud Storage private URI
}

export interface TopicFolder {
  id: string;
  name: string;
  createdAt: string;
  aiSynthesis?: string;
  synthesizedAt?: string;
}

export interface ProcessingStatus {
  stage: 'idle' | 'uploading' | 'transcribing' | 'summarizing' | 'mapping' | 'flashcards' | 'completed' | 'failed';
  progress: number;
  message: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyName?: string;
  updatedAt?: string;
}
