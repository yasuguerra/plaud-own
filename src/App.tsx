import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Sparkles, 
  Upload, 
  Video, 
  CheckCircle2, 
  HelpCircle, 
  ArrowRight, 
  Key, 
  Loader2, 
  Clipboard, 
  Heart, 
  Trash2, 
  CheckSquare, 
  FileText, 
  FileAudio,
  Bookmark, 
  Activity, 
  Workflow, 
  Moon, 
  AlertCircle,
  FolderHeart,
  FolderTree
} from "lucide-react";

import { StudySession, ProcessingStatus, ActionItem, Flashcard, ChatMessage, TopicFolder } from "./types";
import AudioRecorder from "./components/AudioRecorder";
import { googleProvider, signInWithPopup, signOut, User, initFirebase } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import ActionItemsList from "./components/ActionItemsList";
import FlashcardsDeck from "./components/FlashcardsDeck";
import MindMapCanvas from "./components/MindMapCanvas";
import ChatBuddy from "./components/ChatBuddy";
import SidebarHistory from "./components/SidebarHistory";
import InfographicsDashboard from "./components/InfographicsDashboard";

// Simple reliable custom Markdown formatter component for React 19 compatibility
function FormatMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-3 font-sans text-sm text-slate-700 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        // Check for major headers
        if (trimmed.startsWith("###")) {
          return <h4 key={idx} className="text-sm font-bold text-slate-800 mt-4 border-b border-slate-50 pb-1">{trimmed.replace("###", "").trim()}</h4>;
        }
        if (trimmed.startsWith("##")) {
          return <h3 key={idx} className="text-base font-bold text-slate-900 mt-5 border-b border-pink-50/40 pb-1 flex items-center gap-1.5"><Activity className="h-4 w-4 text-indigo-505 text-indigo-500" /> {trimmed.replace("##", "").trim()}</h3>;
        }
        if (trimmed.startsWith("#")) {
          return <h2 key={idx} className="text-lg font-bold text-indigo-950 mt-6 tracking-tight">{trimmed.replace("#", "").trim()}</h2>;
        }
        // Check for list points
        if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
          return (
            <li key={idx} className="list-disc ml-5 pl-1.5 text-slate-600 font-medium">
              {trimmed.substring(1).trim()}
            </li>
          );
        }
        // General text block
        if (trimmed === "") {
          return <div key={idx} className="h-2" />;
        }
        return <p key={idx} className="font-normal">{line}</p>;
      })}
    </div>
  );
}

// Render timeline-based transcript with diarized speakers and seconds/minutes
function RenderTranscriptTimeline({ text }: { text: string }) {
  if (!text) return <p className="text-slate-400 text-xs italic">No hay transcripción disponible para este bloque de audio.</p>;
  
  const lines = text.split("\n");
  const parsedSegments = lines.map((line, index) => {
    // Match "[MM:SS] Speaker Name: Text" or "[HH:MM:SS] Speaker Name: Text"
    const regex = /^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*(.*?):\s*(.*)$/;
    const match = line.trim().match(regex);
    
    if (match) {
      return {
        id: index,
        time: match[1],
        speaker: match[2],
        content: match[3]
      };
    }
    
    // Fallback match "[MM:SS] Text"
    const fallbackRegex = /^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;
    const fallbackMatch = line.trim().match(fallbackRegex);
    if (fallbackMatch) {
      return {
        id: index,
        time: fallbackMatch[1],
        speaker: "Narrador/Locutor",
        content: fallbackMatch[2]
      };
    }
    
    return {
      id: index,
      time: "",
      speaker: "",
      content: line
    };
  });

  return (
    <div className="space-y-4">
      {parsedSegments.map((seg) => {
        if (!seg.content.trim()) return null;
        return (
          <div key={seg.id} className="flex gap-4 items-start border-b border-slate-50 pb-3 last:border-0">
            {seg.time && (
              <div className="w-16 shrink-0 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded px-2 py-0.5 text-center font-mono font-bold text-[10px]">
                {seg.time}
              </div>
            )}
            <div className="flex-1 min-w-0">
              {seg.speaker && (
                <span className="block font-bold text-slate-850 text-[11px] mb-0.5 text-indigo-950">
                  {seg.speaker}
                </span>
              )}
              <p className="text-slate-650 text-slate-600 font-sans text-xs leading-relaxed">
                {seg.content}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "idle",
    progress: 0,
    message: ""
  });
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "mindmap" | "flashcards" | "tasks" | "infographics">("summary");
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isCopingSummary, setIsCopingSummary] = useState(false);

  // Folder/Tema management states
  const [folders, setFolders] = useState<TopicFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isSynthesizingFolder, setIsSynthesizingFolder] = useState(false);
  const [selectedSynthesisFolderId, setSelectedSynthesisFolderId] = useState<string | null>(null);

  // Firebase Auth states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Ingestion Tabs & Inputs state for high-capacity files handling and simulation
  const [activeIngestTab, setActiveIngestTab] = useState<"upload" | "paste" | "simulate">("upload");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [simTopic, setSimTopic] = useState("");
  const [simMediaType, setSimMediaType] = useState<"audio" | "video">("audio");

  // Listen for Firebase Auth state changes after dynamic initialization
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    const setupAuth = async () => {
      const activeAuth = await initFirebase();
      if (activeAuth) {
        unsubscribe = onAuthStateChanged(activeAuth, (currentUser) => {
          setUser(currentUser);
          setAuthLoading(false);
        });
      } else {
        // Fallback if client-side init fails
        setAuthLoading(false);
      }
    };

    setupAuth();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch sessions and folders when authenticated user changes
  useEffect(() => {
    if (authLoading) return;

    const userId = user ? user.uid : "guest";
    const headers = { "x-user-id": userId };

    const loadSessions = async () => {
      try {
        const response = await fetch("/api/sessions", { headers });
        if (response.ok) {
          const parsed = await response.json();
          console.log(`[SYNC] Loaded ${parsed.length} sessions for user ${userId}`);
          setSessions(parsed);
          if (parsed.length > 0) {
            setActiveSessionId(parsed[0].id);
          } else {
            setActiveSessionId(null);
          }
          // Also sync to local storage as a quick backup
          localStorage.setItem("study_buddy_sessions", JSON.stringify(parsed));
          return;
        }
      } catch (e) {
        console.warn("[SYNC WARNING] Failed to load sessions from Firestore backend, trying localStorage", e);
      }

      // Local storage fallback (only for guest or if fetch fails)
      const saved = localStorage.getItem("study_buddy_sessions");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSessions(parsed);
          if (parsed.length > 0) {
            setActiveSessionId(parsed[0].id);
          }
        } catch (e) {
          console.error("Failed to parse saved study sessions", e);
        }
      }
    };

    const loadFolders = async () => {
      try {
        const response = await fetch("/api/folders", { headers });
        if (response.ok) {
          const parsed = await response.json();
          console.log(`[SYNC] Loaded ${parsed.length} folders for user ${userId}`);
          setFolders(parsed);
        }
      } catch (e) {
        console.error("Failed to load folders from Firestore:", e);
      }
    };

    loadSessions();
    loadFolders();

    // Check backend API key configuration status
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        setHasApiKey(data.hasApiKey);
      })
      .catch(err => {
        console.error("Failed to ping health endpoint", err);
      });
  }, [user, authLoading]);

  // Save sessions to localStorage and sync with Firestore backend
  const saveSessions = async (updatedList: StudySession[]) => {
    // 1. Instantly update local react state and localStorage for fast/responsive UI
    setSessions(updatedList);
    localStorage.setItem("study_buddy_sessions", JSON.stringify(updatedList));

    const userId = user ? user.uid : "guest";
    const headers = { 
      "Content-Type": "application/json",
      "x-user-id": userId 
    };

    // 2. Determine if there's any deleted session
    const deletedSession = sessions.find(s => !updatedList.some(u => u.id === s.id));
    if (deletedSession) {
      try {
        console.log("[SYNC] Deleting session from Firestore:", deletedSession.id);
        await fetch(`/api/sessions/${deletedSession.id}`, { 
          method: "DELETE",
          headers: { "x-user-id": userId }
        });
      } catch (e) {
        console.error("[SYNC ERROR] Failed to delete session from Firestore:", e);
      }
      return;
    }

    // 3. Determine if there's any new or modified session
    const modifiedSession = updatedList.find(u => {
      const original = sessions.find(s => s.id === u.id);
      return !original || JSON.stringify(original) !== JSON.stringify(u);
    });

    if (modifiedSession) {
      try {
        console.log("[SYNC] Saving session to Firestore:", modifiedSession.id);
        await fetch("/api/sessions", {
          method: "POST",
          headers: headers,
          body: JSON.stringify(modifiedSession)
        });
      } catch (e) {
        console.error("[SYNC ERROR] Failed to save session to Firestore:", e);
      }
    }
  };

  // --- FOLDERS (TEMAS) MANAGEMENT FUNCTIONS ---

  const handleCreateFolder = async (name: string) => {
    if (!name.trim()) return;
    const newFolder: TopicFolder = {
      id: "folder_" + Date.now().toString(36),
      name: name.trim(),
      createdAt: new Date().toISOString()
    };
    
    // Save to local React state
    setFolders([newFolder, ...folders]);
    
    // Save to backend Firestore
    try {
      const userId = user ? user.uid : "guest";
      await fetch("/api/folders", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify(newFolder)
      });
    } catch (e) {
      console.error("Failed to save folder to Firestore:", e);
    }
  };

  const handleMoveSessionToFolder = async (sessionId: string, folderId: string | null) => {
    const updatedSessions = sessions.map(s => {
      if (s.id === sessionId) {
        return { ...s, folderId: folderId };
      }
      return s;
    });
    
    // This will automatically save it to Firestore via our existing saveSessions!
    await saveSessions(updatedSessions);
  };

  const handleSynthesizeFolder = async (folderId: string) => {
    setIsSynthesizingFolder(true);
    try {
      const userId = user ? user.uid : "guest";
      const response = await fetch(`/api/folders/${folderId}/synthesize`, {
        method: "POST",
        headers: { "x-user-id": userId }
      });
      if (response.ok) {
        const updatedFolder = await response.json();
        setFolders(folders.map(f => f.id === folderId ? updatedFolder : f));
        setSelectedSynthesisFolderId(folderId);
      } else {
        const errData = await response.json();
        alert(errData.error || "Failed to synthesize folder.");
      }
    } catch (e) {
      console.error("Failed to synthesize folder:", e);
    } finally {
      setIsSynthesizingFolder(false);
    }
  };

  const getActiveSession = (): StudySession | undefined => {
    return sessions.find(s => s.id === activeSessionId);
  };

  const activeSession = getActiveSession();

  // Progress Feedback Simulation
  const simulateLoadingStages = async (isRealFile: boolean) => {
    const stages = [
      { stage: "uploading", progress: 15, message: "Reading digital bytes..." },
      { stage: "transcribing", progress: 40, message: isRealFile ? "Parsing media via Gemini Voice Model..." : "Extracting detailed transcript from reference data..." },
      { stage: "summarizing", progress: 65, message: "Synthesizing full lecture summary resume..." },
      { stage: "mapping", progress: 85, message: "Mapping conceptual relationships into svg vectors..." },
      { stage: "flashcards", progress: 95, message: "Writing active recall flashcard sets..." }
    ] as const;

    for (const st of stages) {
      setProcessingStatus({ stage: st.stage, progress: st.progress, message: st.message });
      // Keep each stage active for 1-1.5 seconds so users feel the professional curation steps
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  };

  // Fast-Track Curation Simulator for testing long/large 1-4 hour recordings instantly
  const handleSimulateFastTrack = async (topicName: string, mediaKind: "audio" | "video") => {
    const topic = topicName.trim() || "Artificial Intelligence Architecture";
    setUploadError(null);
    setProcessingStatus({ stage: "uploading", progress: 10, message: "Initializing target curation parameters..." });

    try {
      // Fast progress cycles so it completes in under 1.5s total but feels real
      const stageSteps = [
        { stage: "uploading", progress: 25, message: "Mocking 1-4hr audio stream ingestion..." },
        { stage: "transcribing", progress: 50, message: "Reconstructing speech-to-text narrative chapters..." },
        { stage: "summarizing", progress: 75, message: "Synthesizing high-density lecture summary resume..." },
        { stage: "mapping", progress: 95, message: "Pre-calculating coordinate vectors for SVGs..." },
        { stage: "flashcards", progress: 100, message: "Finalizing active recall card lists..." }
      ] as const;

      for (const st of stageSteps) {
        setProcessingStatus({ stage: st.stage, progress: st.progress, message: st.message });
        await new Promise(resolve => setTimeout(resolve, 250));
      }

      const generatedSession: StudySession = {
        id: "sess_sim_" + Date.now().toString(36),
        createdAt: new Date().toISOString(),
        mediaType: mediaKind,
        mediaName: topic + (mediaKind === "video" ? ".mp4" : ".mp3"),
        title: topic.substring(0, 32),
        summary: `### Executive Overview: ${topic}
        
This workspace was custom-curated in **⚡ Turbo Fast-Track Mode** to bypass browser limits, proxy file-size thresholds, and HTTP timeouts during sandbox testing of very long recordings (1 to 4 hours in capacity).

#### Key Conceptual Landmarks:
1. **Core Architecture Principles**: Foundational constructs, model definitions, and general parameters of **${topic}**.
2. **Operational Rules & Bounds**: Exploring buffer capacities, storage hierarchies, and pipeline calibration guides.
3. **Execution Delivery Guidelines**: Building responsive mockups, preventing typical compiler mismatches, and managing asset folders.

### Strategic Lessons & Takeaways:
* **Payload Management**: Typing copy-pasted transcripts or entering topics bypasses Nginx network limits and updates in seconds.
* **Recall Assessment**: Multiple premium cards are ready in the **Flashcards** tab to test memory recall.
* **Tutoring Integration**: The **Study Copilot** is fully online. It acts as an expert mentor to clarify detailed definitions or quiz you on these specific outcomes.`,
        transcript: `[00:15] Discussing introductory themes and guidelines for "${topic}".\n[14:30] Deep-dive into major architectural blocks, parameters, and practical rules.\n[28:55] Resolving common structural testing errors and verification checks.\n[43:10] Concluding checklist of next goals and course deliverables.`,
        actionItems: [
          { id: "task_1", task: `Execute localized dry-runs to inspect ${topic} performance`, importance: "high", completed: false, dueDate: new Date().toLocaleDateString() },
          { id: "task_2", task: `Design concept diagrams mapping sub-topics to core definitions`, importance: "medium", completed: false, dueDate: new Date().toLocaleDateString() },
          { id: "task_3", task: `Review checklist outcomes with your peer study group`, importance: "low", completed: false, dueDate: new Date().toLocaleDateString() }
        ],
        mindMap: {
          id: "root",
          label: topic.substring(0, 24),
          details: "Central Concept Focus",
          color: "#4f46e5",
          children: [
            {
              id: "sub_1",
              label: "Core Principles",
              details: "Central guidelines & frameworks",
              children: [
                { id: "leaf_1", label: "Fundamental Logic", details: "Basic operational rules" }
              ]
            },
            {
              id: "sub_2",
              label: "Action Roadmap",
              details: "Actionable roadmap items",
              children: [
                { id: "leaf_2", label: "Verification Runs", details: "Securing zero runtime discrepancies" }
              ]
            }
          ]
        },
        flashcards: [
          { id: "card_1", question: `What is the primary target of ${topic}?`, answer: "To establish a highly optimized, scalable, and responsive structure that supports robust project workflows.", learned: false },
          { id: "card_2", question: "Why is simulation mode introduced for long recordings?", answer: "To let users instantly preview full mind-maps, cards, and quizzes, avoiding 100MB+ network payloads.", learned: false },
          { id: "card_3", question: "Can I chat with the AI Study Buddy about simulated sessions?", answer: "Yes! The chat system fully accesses this summary to act as an active-recall tutoring partner.", learned: false }
        ],
        chatHistory: [
          {
            id: "welcome_msg",
            role: "model",
            content: `Welcome to your accelerated study session for **"${topic}"**! This material was compiled instantly. Ask me anything, or let me know if you would like a custom quiz!`,
            timestamp: new Date().toISOString()
          }
        ]
      };

      const newList = [generatedSession, ...sessions];
      saveSessions(newList);
      setActiveSessionId(generatedSession.id);
      setActiveTab("summary");
      setProcessingStatus({ stage: "completed", progress: 100, message: "Everything optimized!" });

      setTimeout(() => {
        setProcessingStatus({ stage: "idle", progress: 0, message: "" });
      }, 700);

    } catch (err: any) {
      setUploadError("Simulation mode encountered an unexpected error. Please retry.");
      setProcessingStatus({ stage: "failed", progress: 0, message: "" });
    }
  };

  // Submit media to processing endpoint
  const processStudyContent = async (payload: {
    mediaName: string;
    mediaType: "audio" | "video";
    base64Data?: string;
    mimeType?: string;
    isSample: boolean;
    sampleType?: string;
    customTitle?: string;
    customText?: string;
  }) => {
    setUploadError(null);
    setProcessingStatus({ stage: "uploading", progress: 5, message: "Ingesting material assets..." });

    try {
      // Start simulator parallel with real server fetch to make the experience cinematic
      const delayPromise = simulateLoadingStages(!payload.isSample);
      
      const userId = user ? user.uid : "guest";
      const fetchPromise = fetch("/api/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify(payload)
      });

      // Await both processing cycles
      const [_, response] = await Promise.all([delayPromise, fetchPromise]);

      const responseText = await response.text();
      const isHtml = responseText.includes("Cookie check") || responseText.includes("Action required to load") || responseText.trim().toLowerCase().startsWith("<!doctype html>");
      if (isHtml) {
        throw new Error("COOKIE_BLOCKED_ERROR: Tu navegador está bloqueando las cookies de seguridad requeridas por el iframe de AI Studio (común en Safari, iOS o modo incógnito). Para solucionarlo, haz clic en el botón de abajo para abrir la aplicación en una pestaña independiente.");
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse response JSON. Raw text:", responseText);
        throw new Error(`Server returned non-JSON response: ${responseText.slice(0, 300)}`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || "Materials processing encountered an obstacle");
      }

      const completedSession: StudySession = responseData;

      const newList = [completedSession, ...sessions];
      saveSessions(newList);
      setActiveSessionId(completedSession.id);
      setActiveTab("summary");
      setProcessingStatus({ stage: "completed", progress: 100, message: "Everything optimized!" });

      // Clean status after success
      setTimeout(() => {
        setProcessingStatus({ stage: "idle", progress: 0, message: "" });
      }, 1000);

    } catch (err: any) {
      console.error("Summarization pipeline fail:", err);
      setUploadError(err.message || "Failed to parse content. Please double check your server secrets settings.");
      setProcessingStatus({ stage: "failed", progress: 0, message: "" });
    }
  };

  const simulateMergeStages = async (isPdf: boolean) => {
    const stages = [
      { stage: "transcribing" as const, progress: 30, message: isPdf ? "Reading multi-page layout via Gemini OCR engine..." : "Transcribing speech timeline via Gemini audio processor..." },
      { stage: "summarizing" as const, progress: 60, message: "Synthesizing comprehensive academic chapter summary..." },
      { stage: "mapping" as const, progress: 85, message: "Drafting interactive visual mindmap coordinate nodes..." },
      { stage: "flashcards" as const, progress: 95, message: "Populating active recall quiz questions..." }
    ];

    for (const st of stages) {
      setProcessingStatus({ stage: st.stage, progress: st.progress, message: st.message });
      await new Promise(resolve => setTimeout(resolve, 1400));
    }
  };

  // Send standard multipart upload to ensure robust stateless execution across any scaled instances
  const processStudyFile = async (file: File) => {
    setUploadError(null);
    setProcessingStatus({ stage: "uploading", progress: 10, message: "Uploading asset to central workspace..." });

    const isAudio = file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav") || file.name.endsWith(".m4a") || file.name.endsWith(".ogg");
    const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".webm") || file.name.endsWith(".mov");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv");

    let mediaType: "audio" | "video" | "pdf" | "document" = "audio";
    if (isVideo) mediaType = "video";
    else if (isPdf) mediaType = "pdf";
    else if (isText) mediaType = "document";

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", mediaType);

      // Start the merge/OCR simulation stages to run concurrently during server-side processing
      const delayPromise = simulateMergeStages(isPdf);

      const userId = user ? user.uid : "guest";
      const fetchPromise = fetch("/api/upload-file", {
        method: "POST",
        headers: { "x-user-id": userId },
        body: formData
      });

      // Await both the upload completion/Gemini generation + the user-experience simulation stages
      const [_, response] = await Promise.all([delayPromise, fetchPromise]);

      const responseText = await response.text();
      const isHtml = responseText.includes("Cookie check") || responseText.includes("Action required to load") || responseText.trim().toLowerCase().startsWith("<!doctype html>");
      if (isHtml) {
        throw new Error("COOKIE_BLOCKED_ERROR: Tu navegador está bloqueando las cookies de seguridad requeridas por el iframe de AI Studio (común en Safari, iOS o modo incógnito). Para solucionarlo, haz clic en el botón de abajo para abrir la aplicación en una pestaña independiente.");
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse response JSON. Raw text:", responseText);
        throw new Error(`Server returned non-JSON response: ${responseText.slice(0, 300)}`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || "Material analysis failed. Please check Gemini API config.");
      }

      const completedSession: StudySession = responseData;

      // Ensure mediaType matches if custom type like pdf or document was processed
      if (isPdf) {
        completedSession.mediaType = "pdf";
      } else if (isText) {
        completedSession.mediaType = "document";
      }

      const newList = [completedSession, ...sessions];
      saveSessions(newList);
      setActiveSessionId(completedSession.id);
      setActiveTab("summary");
      setProcessingStatus({ stage: "completed", progress: 100, message: "Workspace companion compiled successfully!" });

      // Clean status after success
      setTimeout(() => {
        setProcessingStatus({ stage: "idle", progress: 0, message: "" });
      }, 1000);

    } catch (err: any) {
      console.error("Stateless upload process failure:", err);
      setUploadError(err.message || "Failed to analyze material. Verify secrets setting.");
      setProcessingStatus({ stage: "failed", progress: 0, message: "" });
    }
  };

  // Drag and Drop files parsing
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (processingStatus.stage !== "idle") return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileInput(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (file: File) => {
    const isAudio = file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav") || file.name.endsWith(".m4a") || file.name.endsWith(".ogg");
    const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".webm") || file.name.endsWith(".mov");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv");

    if (!isAudio && !isVideo && !isPdf && !isText) {
      setUploadError("Unsupported format. Please select an audio, video, PDF, or text document (.txt, .md, .pdf, .mp3, .wav, .m4a, .ogg, .mp4).");
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      const sizeMb = Math.round(file.size / 1024 / 1024);
      setUploadError(`⚠️ This file is excessively large (${sizeMb}MB). Cloud sandboxes limit single multipart uploads to 150MB to maintain network performance. Please try uploading a file under 150MB.`);
      return;
    }

    processStudyFile(file);
  };

  // Load a fast-track sample lecture immediately
  const handleSelectSample = (sampleKey: "ai-ethics" | "nextjs" | "habits") => {
    if (processingStatus.stage !== "idle") return;
    
    let label = "AI Ethics Lecture Notes";
    if (sampleKey === "nextjs") label = "React Rendering & Server Components masterclass";
    if (sampleKey === "habits") label = "Neurobiology of Habits masterclass";

    processStudyContent({
      mediaName: label,
      mediaType: "audio",
      isSample: true,
      sampleType: sampleKey
    });
  };

  // Mic audio capture pipeline
  const handleMicAudioReady = (base64: string, mime: string, durationSec: number) => {
    processStudyContent({
      mediaName: `Voice Session Memo (${durationSec}s)`,
      mediaType: "audio",
      base64Data: base64,
      mimeType: mime,
      isSample: false
    });
  };

  // Session modification operations
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm("Are you sure you want to delete this study session permanently?");
    if (!confirmed) return;

    const filtered = sessions.filter(s => s.id !== id);
    saveSessions(filtered);
    
    if (activeSessionId === id) {
      setActiveSessionId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  const handleToggleTask = (taskId: string) => {
    if (!activeSession) return;
    const updatedTasks = activeSession.actionItems.map(item => {
      if (item.id === taskId) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });

    const updatedSession = { ...activeSession, actionItems: updatedTasks };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
  };

  const handleAddTask = (taskText: string, imp: "high" | "medium" | "low") => {
    if (!activeSession) return;
    const newTask: ActionItem = {
      id: "task_" + Math.random().toString(36).substring(3),
      task: taskText,
      importance: imp,
      completed: false,
      dueDate: new Date().toLocaleDateString()
    };

    const updatedSession = { ...activeSession, actionItems: [...activeSession.actionItems, newTask] };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
  };

  const handleDeleteTask = (taskId: string) => {
    if (!activeSession) return;
    const updatedTasks = activeSession.actionItems.filter(t => t.id !== taskId);
    const updatedSession = { ...activeSession, actionItems: updatedTasks };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
  };

  const handleToggleFlashcardLearned = (cardId: string) => {
    if (!activeSession) return;
    const updatedCards = activeSession.flashcards.map(c => {
      if (c.id === cardId) {
        return { ...c, learned: !c.learned };
      }
      return c;
    });

    const updatedSession = { ...activeSession, flashcards: updatedCards };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
  };

  const handleUpdateChatHistory = (history: ChatMessage[]) => {
    if (!activeSession) return;
    const updatedSession = { ...activeSession, chatHistory: history };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
  };

  const copyToClipboard = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.summary);
    setIsCopingSummary(true);
    setTimeout(() => setIsCopingSummary(false), 2000);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-16 md:w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-8 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl cursor-pointer shadow-xs hover:bg-indigo-700 transition" onClick={() => setActiveSessionId(null)} title="New Study Block">
          Σ
        </div>
        <nav className="flex flex-col gap-6 items-center">
          <button
            onClick={() => setActiveSessionId(null)}
            className={`p-3 rounded-xl transition duration-150 ${!activeSession ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            title="Analysis Station"
          >
            <Upload className="w-5.5 h-5.5" />
          </button>
          {activeSession && (
            <>
              <button
                onClick={() => setActiveTab("mindmap")}
                className={`p-3 rounded-xl transition duration-150 ${activeTab === "mindmap" ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                title="Mind Map"
              >
                <Workflow className="w-5.5 h-5.5" />
              </button>
              <button
                onClick={() => setActiveTab("summary")}
                className={`p-3 rounded-xl transition duration-150 ${activeTab === "summary" ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                title="Syllabus Resume"
              >
                <FileText className="w-5.5 h-5.5" />
              </button>
            </>
          )}
        </nav>
        <div className="mt-auto">
          <div className="w-3.5 h-3.5 rounded-full bg-indigo-600" title="API Connected" />
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 hidden sm:inline">Current Project</span>
            {activeSession ? (
              <>
                <h1 className="text-sm md:text-base font-bold text-slate-800 truncate max-w-[200px] md:max-w-[340px]">
                  {activeSession.title || activeSession.mediaName}
                </h1>
                <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded border border-indigo-100 font-medium shrink-0">
                  {activeSession.mediaType === "video" ? "Video Processed" : "Audio Processed"}
                </span>
                
                {/* Topic Folder Move Selector */}
                <select
                  value={activeSession.folderId || ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? null : e.target.value;
                    handleMoveSessionToFolder(activeSession.id, val);
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer transition focus:outline-hidden hover:bg-slate-100"
                  title="Asignar Tema de Reunión"
                >
                  <option value="">📂 Sin Tema (General)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      📂 {f.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <h1 className="text-sm md:text-base font-bold text-slate-800">
                  Esperando Audio de Reuniones
                </h1>
                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded border border-slate-200 shrink-0 font-medium">
                  PLAUD Corporate Engine
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col text-right hidden md:flex">
                  <span className="text-[11px] font-bold text-slate-800 leading-none">{user.displayName || "Usuario"}</span>
                  <span className="text-[9px] text-slate-400 font-semibold mt-0.5 leading-none">{user.email}</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-slate-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs border border-indigo-200">
                    {user.displayName ? user.displayName[0].toUpperCase() : "U"}
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                      const activeAuth = await initFirebase();
                      if (activeAuth) {
                        await signOut(activeAuth);
                        setSessions([]);
                        setActiveSessionId(null);
                        setFolders([]);
                      }
                    }
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition cursor-pointer"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    setUploadError(null);
                    const activeAuth = await initFirebase();
                    if (activeAuth) {
                      await signInWithPopup(activeAuth, googleProvider);
                    }
                  } catch (e: any) {
                    console.error("Login failed:", e);
                    setUploadError(`Error de inicio de sesión: ${e.message}`);
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                Iniciar sesión con Google
              </button>
            )}

            {activeSession && (
              <button 
                onClick={() => setActiveSessionId(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition cursor-pointer"
              >
                Analyze New
              </button>
            )}
          </div>
        </header>

        {/* Content Section Grid */}
        {processingStatus.stage === "failed" ? (
          /* Error Retry Stage screen */
          (() => {
            const errStr = uploadError || "";
            const isCookieError = errStr.includes("COOKIE_BLOCKED_ERROR") || errStr.includes("Cookie check") || errStr.includes("non-JSON response: <!doctype html>");
            const isKeyError = errStr.toLowerCase().includes("api key") || errStr.toLowerCase().includes("apikey") || errStr.toLowerCase().includes("secrets") || errStr.toLowerCase().includes("invalid_argument");
            
            return (
              <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
                <div className="bg-white rounded-2xl border border-rose-250 border-rose-250/70 p-8 shadow-md flex flex-col items-center justify-center text-center max-w-md w-full space-y-5">
                  <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-650">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-display font-bold text-base text-slate-800">
                      {isCookieError ? "🔒 Bloqueo de Cookies Detectado" : isKeyError ? "🔑 Error de Configuración de API Key" : "Curation Obstacle"}
                    </h3>
                    
                    {isCookieError ? (
                      <div className="text-left bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-2 text-[11px] leading-relaxed text-indigo-950 font-sans">
                        <p className="font-bold">¿Por qué sucede esto?</p>
                        <p>Tu navegador está bloqueando las cookies de terceros y seguridad dentro del iframe de Google AI Studio (muy común en Safari, iOS o pestañas de incógnito).</p>
                        <p className="font-bold">Cómo solucionarlo de inmediato:</p>
                        <p>Haz clic en el botón <strong className="text-indigo-700">"Abrir en una Nueva Pestaña"</strong> de abajo. Al ejecutarse directamente sin iframe, las cookies se procesan sin trabas y resolverá el problema al instante.</p>
                      </div>
                    ) : isKeyError ? (
                      <div className="text-left bg-amber-50 border border-amber-100 p-4 rounded-xl space-y-2 text-[11px] leading-relaxed text-amber-950 font-sans">
                        <p className="font-bold">¿Cómo configurar tu Gemini API Key?</p>
                        <p>Tu clave de API de Gemini no se encuentra o es inválida (error 400).</p>
                        <p className="font-medium">1. Ve al menú superior derecho y haz clic en el engranaje de <strong className="text-amber-800">Settings &gt; Secrets</strong>.</p>
                        <p className="font-medium">2. Añade un nuevo secreto con el nombre exacto de <strong className="text-amber-800">GEMINI_API_KEY</strong> y pega tu token de Google AI Studio.</p>
                        <p className="font-medium">3. Guarda los cambios e inténtalo de nuevo.</p>
                        <div className="pt-1 border-t border-amber-250/30 mt-1">
                          <p className="font-bold text-amber-900">💡 ¿Quieres probar la app de inmediato sin clave?</p>
                          <p>Haz clic en <strong className="text-indigo-600">"Ir al Simulador Local"</strong> abajo para rellenar temas académicos y generar mapas y flashcards instantáneos al instante sin llamadas al servidor.</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-rose-700 leading-relaxed font-sans max-h-[140px] overflow-y-auto p-3 bg-rose-50/50 rounded-lg border border-rose-100/40">
                        {uploadError || "An error occurred while compiling your study artifacts. Please make sure your Gemini API Key is configured correctly in Settings > Secrets."}
                      </p>
                    )}
                  </div>
                  
                  <div className="w-full flex flex-col gap-2 pt-2">
                    {isCookieError && (
                      <button 
                        type="button"
                        onClick={() => {
                          window.open(window.location.href, '_blank');
                        }}
                        className="w-full bg-indigo-600 border border-indigo-650 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-indigo-700 text-xs transition duration-150 shadow-xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer font-sans"
                      >
                        🌐 Abrir en una Nueva Pestaña
                      </button>
                    )}
                    
                    {isKeyError && (
                      <button 
                        type="button"
                        onClick={() => {
                          setActiveIngestTab("simulate");
                          setProcessingStatus({ stage: "idle", progress: 0, message: "" });
                          setUploadError(null);
                        }}
                        className="w-full bg-indigo-600 border border-indigo-650 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-indigo-750 text-xs transition duration-150 shadow-xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer font-sans text-center"
                      >
                        ⚡ Ir al Simulador Local
                      </button>
                    )}

                    <button 
                      onClick={() => { setProcessingStatus({ stage: "idle", progress: 0, message: "" }); setUploadError(null); }}
                      className="w-full bg-slate-950 border border-slate-900 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-slate-850 text-xs transition active:scale-95 cursor-pointer font-sans"
                    >
                      Return to Station
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : processingStatus.stage !== "idle" ? (
          /* Processing Stage overlay */
          <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center max-w-sm w-full space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base text-slate-800">Compiling Corporate Briefing</h3>
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Stage: {processingStatus.stage}</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-350" style={{ width: `${processingStatus.progress}%` }} />
              </div>
              <p className="text-xs text-slate-650 text-slate-600 italic font-medium animate-pulse">
                "{processingStatus.message}"
              </p>
            </div>
          </div>
        ) : activeSession ? (
          /* SECTION A: Dashboard active session 3-column Layout structure */
          <section className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
            
            {/* Column 1: Summary & Action Progress Indicators (Span 3) */}
            <div className="col-span-12 lg:col-span-3 border-r border-slate-200 p-6 flex flex-col gap-6 bg-white overflow-y-auto h-full">
              <div>
                <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-3">Executive Summary</h2>
                <div className="text-xs leading-relaxed text-slate-600 bg-slate-50 border border-slate-200/60 p-3 rounded-lg font-sans">
                  {activeSession.summary ? 
                    (activeSession.summary.replace(/[#*]/g, "").substring(0, 190).trim() + "...") :
                    "We have categorized major logistics constraint models and key conceptual landmarks for your current project."
                  }
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Key Progress Metrics</h2>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center">
                    <span className="block text-lg font-bold text-indigo-600">
                      {activeSession.actionItems.filter(t => t.completed).length}/{activeSession.actionItems.length}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">Goals Done</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center">
                    <span className="block text-lg font-bold text-slate-700">
                      {activeSession.flashcards.filter(c => c.learned).length}/{activeSession.flashcards.length}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold uppercase">Reviewed</span>
                  </div>
                </div>
              </div>

              {/* Topic Folders (Temas) widget */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FolderTree className="h-4 w-4 text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Temas de Reunión</span>
                  </div>
                  <button 
                    onClick={() => {
                      const name = prompt("Ingrese el nombre del nuevo Tema:");
                      if (name && name.trim()) handleCreateFolder(name);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-0.5"
                  >
                    + Nuevo
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  <button
                    onClick={() => setActiveFolderId(null)}
                    className={`text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                      activeFolderId === null 
                        ? "bg-indigo-50 text-indigo-700" 
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">📂 Todos los Temas</span>
                    <span className="text-[10px] text-slate-400">({sessions.length})</span>
                  </button>

                  {folders.map(folder => {
                    const folderSessions = sessions.filter(s => s.folderId === folder.id);
                    const isSelected = activeFolderId === folder.id;
                    return (
                      <button
                        key={folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        className={`text-left text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex items-center justify-between ${
                          isSelected 
                            ? "bg-indigo-50 text-indigo-700" 
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">📂 {folder.name}</span>
                        <span className="text-[10px] text-slate-400">({folderSessions.length})</span>
                      </button>
                    );
                  })}
                </div>

                {/* AI Folder Curation Widget */}
                {activeFolderId && (() => {
                  const currentFolder = folders.find(f => f.id === activeFolderId);
                  if (!currentFolder) return null;
                  const folderSessions = sessions.filter(s => s.folderId === currentFolder.id);

                  return (
                    <div className="border border-indigo-100 bg-indigo-50/40 p-4 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Inteligencia de Tema</h4>
                        <span className="text-[8px] text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-full font-bold">Activo</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        Combina los resúmenes de las {folderSessions.length} reuniones de este tema para obtener un informe consolidado por la IA.
                      </p>

                      {currentFolder.aiSynthesis ? (
                        <button
                          onClick={() => {
                            setSelectedSynthesisFolderId(currentFolder.id);
                          }}
                          className="w-full bg-white border border-indigo-150 text-indigo-700 text-[10px] font-bold py-1.5 rounded-lg hover:bg-indigo-100/30 transition flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                        >
                          📖 Leer Síntesis de Tema con IA
                        </button>
                      ) : (
                        <button
                          disabled={folderSessions.length === 0 || isSynthesizingFolder}
                          onClick={() => handleSynthesizeFolder(currentFolder.id)}
                          className="w-full bg-indigo-600 text-white text-[10px] font-bold py-1.5 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isSynthesizingFolder ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-white" />
                              Sintetizando Tema...
                            </>
                          ) : (
                            <>
                              ✨ Sintetizar Tema con IA
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Saved Study Library list widget */}
              <div className="border-t border-slate-100 pt-5 mt-auto">
                <SidebarHistory 
                  sessions={activeFolderId ? sessions.filter(s => s.folderId === activeFolderId) : sessions} 
                  activeSessionId={activeSessionId}
                  onSelectSession={(id) => { setActiveSessionId(id); setActiveTab("summary"); }}
                  onDeleteSession={handleDeleteSession}
                />
              </div>
            </div>

            {/* Column 2: Visual Analysis / Map & Interactive Tabs (Span 5) */}
            <div className="col-span-12 lg:col-span-5 bg-slate-50 relative p-6 flex flex-col gap-4 overflow-y-auto h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Centro de Inteligencia</h2>
                
                {/* Tiny inline helper tab switches */}
                <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 overflow-x-auto max-w-[250px] sm:max-w-none">
                  {[
                    { id: "summary", label: "Resumen" },
                    { id: "transcript", label: "Transcripción" },
                    { id: "mindmap", label: "Mapa Mental" },
                    { id: "flashcards", label: "Flashcards" },
                    { id: "infographics", label: "Infografías" },
                    { id: "tasks", label: "Objetivos" }
                  ].map((subTab) => {
                    const isSelected = activeTab === subTab.id;
                    return (
                      <button
                        key={subTab.id}
                        onClick={() => setActiveTab(subTab.id as any)}
                        className={`px-2 py-0.5 text-[9px] font-bold rounded transition ${
                          isSelected 
                            ? "bg-indigo-600 text-white shadow-2xs" 
                            : "text-slate-400 hover:text-slate-800"
                        }`}
                      >
                        {subTab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prominent dual-action buttons to switch summary vs transcript */}
              <div className="grid grid-cols-2 gap-3" id="main-view-shortcut-buttons">
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  className={`p-3 rounded-xl border text-left transition duration-150 flex flex-col gap-1 ${
                    activeTab === "summary"
                      ? "border-indigo-600 bg-white ring-2 ring-indigo-600/5 shadow-2xs"
                      : "border-slate-200 bg-white/65 hover:bg-white text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`p-1 rounded-md ${activeTab === "summary" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-550"}`}>
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-sans font-extrabold text-[11px] text-slate-800">Ver Resumen Ejecutivo</span>
                  </div>
                  <span className="text-[9px] text-slate-400 leading-tight">
                    Resumen ejecutivo en markdown, mapa de ideas e infografías corporativas.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("transcript")}
                  className={`p-3 rounded-xl border text-left transition duration-150 flex flex-col gap-1 ${
                    activeTab === "transcript"
                      ? "border-indigo-600 bg-white ring-2 ring-indigo-600/5 shadow-2xs"
                      : "border-slate-200 bg-white/65 hover:bg-white text-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`p-1 rounded-md ${activeTab === "transcript" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-550"}`}>
                      <FileAudio className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-sans font-extrabold text-[11px] text-slate-800">Ver Transcripción por Temas</span>
                  </div>
                  <span className="text-[9px] text-slate-400 leading-tight">
                    Transcripción fiel y diarizada con marcas de tiempo (minutos y segundos).
                  </span>
                </button>
              </div>

              {/* Dynamic core view workspace */}
              <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-hidden flex flex-col">
                {activeTab === "mindmap" && (
                  <div className="flex-1 min-h-0">
                    <MindMapCanvas rootNode={activeSession.mindMap} />
                  </div>
                )}
                
                {activeTab === "flashcards" && (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <FlashcardsDeck 
                      cards={activeSession.flashcards}
                      onToggleLearned={handleToggleFlashcardLearned}
                    />
                  </div>
                )}

                {activeTab === "infographics" && (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <InfographicsDashboard session={activeSession} />
                  </div>
                )}

                {activeTab === "tasks" && (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <ActionItemsList 
                      items={activeSession.actionItems}
                      onToggleItem={handleToggleTask}
                      onAddItem={handleAddTask}
                      onDeleteItem={handleDeleteTask}
                    />
                  </div>
                )}

                {activeTab === "summary" && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between border-b pb-2.5 mb-3 border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Resumen de la Reunión</span>
                      <button 
                        onClick={copyToClipboard}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        {isCopingSummary ? "¡Copiado!" : "Copiar texto"}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6 pb-4">
                      <FormatMarkdown text={activeSession.summary} />
                    </div>
                  </div>
                )}

                {activeTab === "transcript" && (
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto pr-1 bg-slate-50/50 p-3 rounded">
                      <RenderTranscriptTimeline text={activeSession.transcript || ""} />
                    </div>
                  </div>
                )}
              </div>

              {/* Tips panel block */}
              <div className="text-[10px] text-slate-400 flex items-center justify-between mt-auto px-1 border-t border-slate-200/60 pt-3">
                <span>💡 Focus on checklist milestones to verify comprehension</span>
                <button 
                  onClick={() => setActiveTab(activeTab === "transcript" ? "mindmap" : "transcript")}
                  className="text-indigo-600 hover:underline font-bold uppercase tracking-wider"
                >
                  {activeTab === "transcript" ? "View Mind Map" : "View Transcript"}
                </button>
              </div>

            </div>

            {/* Column 3: Copilot Tutoring AI Assistant chat (Span 4) */}
            <div className="col-span-12 lg:col-span-4 border-l border-slate-205 border-slate-200 flex flex-col bg-slate-50 h-full overflow-hidden">
              <ChatBuddy 
                session={activeSession} 
                onUpdateChatHistory={handleUpdateChatHistory}
              />
            </div>

          </section>
        ) : (
          /* SECTION B: NO active study session - Welcome & uploader suite */
          <section className="flex-1 grid grid-cols-12 gap-0 overflow-hidden h-full">
            
            {/* Ingest side-panel inputs (Span 5) */}
            <div className="col-span-12 lg:col-span-5 border-r border-slate-200 p-6 flex flex-col gap-6 bg-white overflow-y-auto">
              <div>
                <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Plataforma de Ingesta Corporativa</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-sans mb-3.5">
                  Procesa grabaciones de audio/video y documentos de manera inmediata. Obtén transcripciones con oradores, resúmenes ejecutivos e infografías corporativas.
                </p>

                {/* Sub-tab selection hooks */}
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1">
                  <button
                    onClick={() => { setActiveIngestTab("upload"); setUploadError(null); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition duration-150 ${activeIngestTab === "upload" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Upload File
                  </button>
                  <button
                    onClick={() => { setActiveIngestTab("paste"); setUploadError(null); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition duration-150 ${activeIngestTab === "paste" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Paste Transcript
                  </button>
                  <button
                    onClick={() => { setActiveIngestTab("simulate"); setUploadError(null); }}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition duration-150 ${activeIngestTab === "simulate" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    ⚡ Fast Simulation
                  </button>
                </div>
              </div>

              {activeIngestTab === "upload" && (
                <>
                  {/* Drag and Drop box */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition min-h-[160px] cursor-pointer ${
                      dragOver 
                        ? "border-indigo-600 bg-indigo-50/20 text-indigo-700" 
                        : "border-slate-200 bg-slate-50/50 text-slate-550 text-slate-500 hover:bg-slate-50/80 hover:border-slate-350"
                    }`}
                    onClick={() => document.getElementById("hidden-file-btn")?.click()}
                  >
                    <input 
                      type="file" 
                      id="hidden-file-btn"
                      className="hidden" 
                      accept="audio/*,video/*,application/pdf,text/*,.pdf,.txt,.md,.csv"
                      onChange={(e) => e.target.files?.[0] && handleFileInput(e.target.files[0])}
                    />
                    <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 block">Drag & drop workspace files here</span>
                    <span className="text-[10px] text-slate-400 block mt-1">Supports Media (MP3, MP4) & Documents (PDF, TXT, MD) up to 150MB</span>
                  </div>

                  {uploadError && uploadError.includes("too large") ? (
                    <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4.5 w-4.5 text-orange-600 shrink-0 mt-0.5" />
                        <p className="font-semibold leading-relaxed text-orange-900">{uploadError}</p>
                      </div>
                      {simTopic && (
                        <button
                          onClick={() => handleSimulateFastTrack(simTopic, simMediaType)}
                          className="mt-1 self-start px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition active:scale-95"
                        >
                          ⚡ Run Instant Simulation for "{simTopic}" Now
                        </button>
                      )}
                    </div>
                  ) : uploadError ? (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p className="font-semibold leading-normal">{uploadError}</p>
                    </div>
                  ) : null}

                  {/* Dictation node */}
                  <div className="pt-1">
                    <AudioRecorder onAudioReady={handleMicAudioReady} isProcessing={processingStatus.stage !== "idle"} />
                  </div>
                </>
              )}

              {activeIngestTab === "paste" && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Lecture Topic Title</label>
                    <input
                      type="text"
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      placeholder="e.g. Astrophysics Lecture 4: Hydrogen Fusion"
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Transcript Paragraphs / Lecture Notes</label>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your 1-4 hour transcription paragraphs or written lecture notes here... Bypasses any network size bottlenecks!"
                      rows={6}
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-mono text-[11px] leading-relaxed"
                    />
                  </div>

                  {uploadError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p className="font-semibold leading-normal">{uploadError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!pastedTitle.trim() || !pastedText.trim()) {
                        setUploadError("Please provide both a title and text lecture content before processing.");
                        return;
                      }
                      setUploadError(null);
                      processStudyContent({
                        mediaName: pastedTitle,
                        mediaType: "audio",
                        isSample: true,
                        sampleType: "custom",
                        customTitle: pastedTitle,
                        customText: pastedText
                      });
                    }}
                    disabled={!pastedTitle.trim() || !pastedText.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold rounded-lg text-xs transition duration-150 shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-200" /> Start Real Gemini Analysis
                  </button>
                </div>
              )}

              {activeIngestTab === "simulate" && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-indigo-50 text-indigo-900 border border-indigo-100 p-3.5 rounded-xl leading-normal">
                    <p className="font-bold flex items-center gap-1.5 text-indigo-950">⚡ Local Simulator Active</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Designed to bypass network timeouts and upload freezes entirely during developer testing. Run any topic name through our curation generator instantly!
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Simulated Topic Theme</label>
                    <input
                      type="text"
                      value={simTopic}
                      onChange={(e) => setSimTopic(e.target.value)}
                      placeholder="e.g. Organic Chemistry Carbon Chains, Classical Piano"
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Simulation Asset Medium</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSimMediaType("audio")}
                        className={`py-2 px-3 border rounded-lg font-bold text-center transition duration-150 ${simMediaType === "audio" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-250 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"}`}
                      >
                        🎙️ Simulated Audio
                      </button>
                      <button
                        onClick={() => setSimMediaType("video")}
                        className={`py-2 px-3 border rounded-lg font-bold text-center transition duration-150 ${simMediaType === "video" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-250 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"}`}
                      >
                        📺 Simulated Video
                      </button>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <p className="font-semibold leading-normal">{uploadError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!simTopic.trim()) {
                        setUploadError("Please input a topic theme first.");
                        return;
                      }
                      setUploadError(null);
                      handleSimulateFastTrack(simTopic, simMediaType);
                    }}
                    disabled={!simTopic.trim()}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition duration-150 shadow-xs active:scale-95"
                  >
                    🚀 Build Simulated Workspace Instantly
                  </button>
                </div>
              )}

              {/* Quick database links catalog if any saved */}
              {sessions.length > 0 && (
                <div className="border-t border-slate-105 border-slate-200/60 pt-4 mt-auto">
                  <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Archivo de Reuniones</h3>
                  <div className="max-h-[110px] overflow-y-auto space-y-1.5 pr-1">
                    {sessions.map((sess) => (
                      <div 
                        key={sess.id}
                        onClick={() => { setActiveSessionId(sess.id); setActiveTab("summary"); }}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 transition text-[11px] text-slate-700 cursor-pointer animate-fade-in"
                      >
                        <span className="font-semibold truncate max-w-[80%]">{sess.title || sess.mediaName}</span>
                        <span className="text-[10px] text-indigo-650 font-bold">Ver &gt;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Introductory Graphics & Preset Course Syllabus Tracks (Span 7) */}
            <div className="col-span-12 lg:col-span-7 bg-slate-50 p-8 flex flex-col justify-between overflow-y-auto h-full">
              <div className="max-w-xl space-y-6">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-widest bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                    Workspace Intelligence
                  </span>
                  <h2 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-slate-800 mt-4 leading-tight">
                    PLAUD Corporate Intelligence
                  </h2>
                  <p className="text-xs md:text-sm text-slate-600 mt-2.5 leading-relaxed font-sans">
                    Un espacio de trabajo inteligente de alto rendimiento para el análisis de reuniones y minado de ideas. Sube grabaciones de audio/video o inicia un dictado en vivo para obtener de manera completamente automatizada la transcripción diarizada por oradores, resumen ejecutivo, checklist de accionables, mapa mental e infografías estadísticas con Gemini.
                  </p>
                </div>
              </div>

              {/* Discrete Demo Session Links relegated to absolute bottom */}
              <div className="mt-auto pt-6 border-t border-slate-200/40 text-left">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Ejemplos de Referencia (Demostraciones)</span>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleSelectSample("ai-ethics")}
                    className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 hover:underline transition duration-150 cursor-pointer"
                  >
                    • Ética y IA
                  </button>
                  <button
                    onClick={() => handleSelectSample("nextjs")}
                    className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 hover:underline transition duration-150 cursor-pointer"
                  >
                    • Alineación Técnica
                  </button>
                  <button
                    onClick={() => handleSelectSample("habits")}
                    className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 hover:underline transition duration-150 cursor-pointer"
                  >
                    • Plan OKRs
                  </button>
                </div>
              </div>

              {/* Bottom footer bar decoration */}
              <div className="border-t border-slate-200 pt-5 mt-6 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>© 2026 PLAUD Corporate Summarizer</span>
                <span>Active Server Model V1.4</span>
              </div>
            </div>

          </section>
        )}

        {/* AI Topic Synthesis Overlay Modal */}
        {selectedSynthesisFolderId && (() => {
          const folder = folders.find(f => f.id === selectedSynthesisFolderId);
          if (!folder) return null;
          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full h-[80vh] flex flex-col p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Síntesis Inteligente: {folder.name}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold">Reporte consolidado generado con Gemini Enterprise</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedSynthesisFolderId(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-1 text-xs text-slate-700 leading-relaxed font-sans prose max-w-none">
                  <div className="whitespace-pre-wrap bg-slate-50 border border-slate-100 p-4 rounded-xl font-medium font-sans">
                    {folder.aiSynthesis}
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase">
                    Generado el: {folder.synthesizedAt ? new Date(folder.synthesizedAt).toLocaleDateString() : ""}
                  </span>
                  <button
                    onClick={() => handleSynthesizeFolder(folder.id)}
                    disabled={isSynthesizingFolder}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] py-1.5 px-4 rounded-lg transition cursor-pointer"
                  >
                    {isSynthesizingFolder ? "Sintetizando..." : "🔄 Volver a sintetizar"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </main>
    </div>
  );
}
