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
  templateId?: string;       // Plaud-style summary template ID
  speakerMap?: Record<string, string>; // Maps speaker generic names to real names (e.g. "Speaker 1" -> "Yasu Guerra")
  localAudioUrl?: string;    // Blob URL for local audio playback
  status?: 'processing' | 'completed' | 'failed'; // Background processing status
  error?: string;            // Failure reason if status is 'failed'
  logs?: Array<{ timestamp: string; stage: string; message: string }>;
  progress?: number;         // Processing progress percentage (0-100)
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
  frequentSpeakers?: string;
  updatedAt?: string;
}
