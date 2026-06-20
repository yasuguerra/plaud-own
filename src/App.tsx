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
  FolderTree,
  Settings,
  Mic,
  Building,
  Share2
} from "lucide-react";

import { StudySession, ProcessingStatus, ActionItem, Flashcard, ChatMessage, TopicFolder } from "./types";
import { SUMMARY_TEMPLATES } from "./templates";
import AudioRecorder from "./components/AudioRecorder";
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, User, initFirebase } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import ActionItemsList from "./components/ActionItemsList";
import ChatBuddy from "./components/ChatBuddy";
import SidebarHistory from "./components/SidebarHistory";
import InfographicsDashboard from "./components/InfographicsDashboard";
import FolderDashboard from "./components/FolderDashboard";
import ShareModal from "./components/ShareModal";

// Simple reliable custom Markdown formatter component for React 19 compatibility
export function FormatMarkdown({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-4 font-sans text-[14.5px] text-slate-700 leading-relaxed max-w-none">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        // Check for major headers
        if (trimmed.startsWith("###")) {
          return (
            <h4 key={idx} className="text-base font-bold text-slate-800 mt-6 mb-3 tracking-tight flex items-center gap-1.5">
              {trimmed.replace("###", "").trim()}
            </h4>
          );
        }
        if (trimmed.startsWith("##")) {
          return (
            <h3 key={idx} className="text-xl md:text-2xl font-black text-slate-900 mt-10 mb-4 pb-2 border-b border-slate-100 tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500 shrink-0" />
              {trimmed.replace("##", "").trim()}
            </h3>
          );
        }
        if (trimmed.startsWith("#")) {
          return (
            <h2 key={idx} className="text-2xl md:text-3xl font-black text-slate-950 mt-12 mb-5 tracking-tight">
              {trimmed.replace("#", "").trim()}
            </h2>
          );
        }
        // Check for list points
        if (trimmed.startsWith("*") || trimmed.startsWith("-")) {
          const cleanLine = trimmed.substring(1).trim();
          // Detect bullet lines that contain strong labels like **Key:** value
          const strongMatch = cleanLine.match(/^\*\*(.*?)\*\*:(.*)$/);
          if (strongMatch) {
            return (
              <li key={idx} className="list-disc ml-5 pl-1.5 text-slate-700 mb-3 leading-relaxed">
                <strong className="text-slate-900 font-extrabold">{strongMatch[1]}:</strong>
                <span className="text-slate-650 font-normal">{strongMatch[2]}</span>
              </li>
            );
          }
          return (
            <li key={idx} className="list-disc ml-5 pl-1.5 text-slate-750 text-slate-700 mb-3 leading-relaxed font-normal">
              {cleanLine}
            </li>
          );
        }
        // General text block
        if (trimmed === "") {
          return <div key={idx} className="h-3" />;
        }
        return (
          <p key={idx} className="font-normal text-slate-650 text-slate-700 mb-4 leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}

// Global Speaker Formatter for consistent Speaker 1, Speaker 2 labels
export function formatSpeakerName(speaker: string): string {
  if (!speaker) return "";
  const clean = speaker.trim().toUpperCase();
  if (clean === "A" || clean === "SPEAKER A" || clean === "SPEAKER_A") return "Speaker 1";
  if (clean === "B" || clean === "SPEAKER B" || clean === "SPEAKER_B") return "Speaker 2";
  if (clean === "C" || clean === "SPEAKER C" || clean === "SPEAKER_C") return "Speaker 3";
  if (clean === "D" || clean === "SPEAKER D" || clean === "SPEAKER_D") return "Speaker 4";
  if (clean === "E" || clean === "SPEAKER E" || clean === "SPEAKER_E") return "Speaker 5";
  if (clean === "F" || clean === "SPEAKER F" || clean === "SPEAKER_F") return "Speaker 6";
  
  const numMatch = speaker.match(/speaker[_\s]?(\d+)/i);
  if (numMatch) {
    return `Speaker ${numMatch[1]}`;
  }
  return speaker;
}

// Speaker Colorizer Helper for visually differentiating voices
export function getSpeakerColorClass(speakerName: string): { bg: string; text: string; border: string; badgeBg: string } {
  const name = formatSpeakerName(speakerName);
  if (name.includes("1")) {
    return { bg: "bg-blue-50/40", text: "text-blue-700", border: "border-blue-100", badgeBg: "bg-blue-100/70" };
  }
  if (name.includes("2")) {
    return { bg: "bg-purple-50/40", text: "text-purple-700", border: "border-purple-100", badgeBg: "bg-purple-100/70" };
  }
  if (name.includes("3")) {
    return { bg: "bg-emerald-50/40", text: "text-emerald-700", border: "border-emerald-100", badgeBg: "bg-emerald-100/70" };
  }
  if (name.includes("4")) {
    return { bg: "bg-amber-50/40", text: "text-amber-700", border: "border-amber-100", badgeBg: "bg-amber-100/70" };
  }
  if (name.includes("5")) {
    return { bg: "bg-pink-50/40", text: "text-pink-700", border: "border-pink-100", badgeBg: "bg-pink-100/70" };
  }
  return { bg: "bg-indigo-50/40", text: "text-indigo-700", border: "border-indigo-100", badgeBg: "bg-indigo-100/70" };
}

// Robust Timeline transcript segment parser splitting by timestamps anywhere
export function parseTranscriptToSegments(text: string) {
  if (!text) return [];
  const regex = /(\[\d{1,2}:\d{2}(?::\d{2})?\])/g;
  const parts = text.split(regex);
  
  const segments: { id: number; time: string; speaker: string; content: string }[] = [];
  let currentTimestamp = "";
  let idCounter = 0;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    
    if (part.match(/^\[\d{1,2}:\d{2}(?::\d{2})?\]$/)) {
      currentTimestamp = part.slice(1, -1);
    } else {
      let content = part.trim();
      let speaker = "";
      
      const speakerRegex = /^([^:\n\r]{1,35}):\s*(.*)$/s;
      const speakerMatch = content.match(speakerRegex);
      if (speakerMatch) {
        speaker = speakerMatch[1].trim();
        content = speakerMatch[2].trim();
      }
      
      if (speaker || content) {
        segments.push({
          id: idCounter++,
          time: currentTimestamp,
          speaker: speaker,
          content: content
        });
      }
    }
  }
  
  if (segments.length === 0) {
    const lines = text.split("\n");
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const lineRegex = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*?):\s*(.*)$/;
      const lineMatch = trimmed.match(lineRegex);
      if (lineMatch) {
        segments.push({
          id: idCounter++,
          time: lineMatch[1],
          speaker: lineMatch[2],
          content: lineMatch[3]
        });
        return;
      }
      
      const fallbackLineRegex = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;
      const fallbackLineMatch = trimmed.match(fallbackLineRegex);
      if (fallbackLineMatch) {
        segments.push({
          id: idCounter++,
          time: fallbackLineMatch[1],
          speaker: "",
          content: fallbackLineMatch[2]
        });
        return;
      }
      
      const speakerRegex = /^([^:\n\r]{1,35}):\s*(.*)$/;
      const speakerMatch = trimmed.match(speakerRegex);
      if (speakerMatch) {
        segments.push({
          id: idCounter++,
          time: "",
          speaker: speakerMatch[1].trim(),
          content: speakerMatch[2].trim()
        });
      } else {
        segments.push({
          id: idCounter++,
          time: "",
          speaker: "",
          content: trimmed
        });
      }
    });
  }
  
  return segments;
}

// Render timeline-based transcript with diarized speakers and seconds/minutes
function RenderTranscriptTimeline({ 
  text, 
  speakerMap, 
  onRenameSpeaker 
}: { 
  text: string; 
  speakerMap?: Record<string, string>; 
  onRenameSpeaker?: (rawName: string, newName: string) => void;
}) {
  if (!text) return <p className="text-slate-400 text-xs italic">No hay transcripción disponible para este bloque de audio.</p>;
  
  const parsedSegments = parseTranscriptToSegments(text);

  return (
    <div className="space-y-3">
      {parsedSegments.map((seg) => {
        if (!seg.content.trim()) return null;
        
        const rawSpeaker = seg.speaker || "";
        const mappedSpeaker = speakerMap && speakerMap[rawSpeaker] ? speakerMap[rawSpeaker] : formatSpeakerName(rawSpeaker);
        const colorStyles = getSpeakerColorClass(rawSpeaker || "Speaker");
        
        return (
          <div key={seg.id} className={`p-3 rounded-xl border ${colorStyles.bg} ${colorStyles.border} transition duration-150`}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {seg.time && (
                <div className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${colorStyles.badgeBg} ${colorStyles.text}`}>
                  🕒 {seg.time}
                </div>
              )}
              {rawSpeaker && (
                <button
                  type="button"
                  onClick={() => {
                    const newName = prompt(`Cambiar el nombre para el orador "${rawSpeaker}":`, mappedSpeaker);
                    if (newName !== null && onRenameSpeaker) {
                      onRenameSpeaker(rawSpeaker, newName.trim());
                    }
                  }}
                  className={`font-bold text-[10px] px-2.5 py-0.5 rounded-full hover:scale-105 active:scale-95 transition cursor-pointer flex items-center gap-1 ${colorStyles.badgeBg} ${colorStyles.text}`}
                  title="Click para renombrar este orador"
                >
                  👤 {mappedSpeaker}
                  <span className="text-[8px] opacity-60">✍️</span>
                </button>
              )}
            </div>
            <p className="text-slate-700 font-sans text-xs leading-relaxed pl-0.5">
              {seg.content}
            </p>
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
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "tasks" | "infographics">("transcript");
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrorType, setUploadErrorType] = useState<string | null>(null);
  const [isCopingSummary, setIsCopingSummary] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("client-needs");
  const [processingMode, setProcessingMode] = useState<"turbo" | "high-fidelity">("high-fidelity");
  const [activePreviewTemplateId, setActivePreviewTemplateId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [frequentSpeakers, setFrequentSpeakers] = useState("");
  const [activeSidebarTab, setActiveSidebarTab] = useState<"history" | "templates">("history");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const [voiceSignatureBase64, setVoiceSignatureBase64] = useState("");
  const [voiceSignatureMime, setVoiceSignatureMime] = useState("");
  const [isRecordingVoiceSig, setIsRecordingVoiceSig] = useState(false);
  const [voiceSigTimer, setVoiceSigTimer] = useState(0);

  const voiceSigRecorderRef = React.useRef<MediaRecorder | null>(null);
  const voiceSigChunksRef = React.useRef<Blob[]>([]);
  const voiceSigTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Folder/Tema management states
  const [folders, setFolders] = useState<TopicFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isSynthesizingFolder, setIsSynthesizingFolder] = useState(false);
  const [selectedSynthesisFolderId, setSelectedSynthesisFolderId] = useState<string | null>(null);

  // Firebase Auth states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Shared Mode states
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [isSharedModeLoading, setIsSharedModeLoading] = useState(false);

  // Settings and Profile states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Synchronize audio player with active session's localAudioUrl
  useEffect(() => {
    if (audioRef.current) {
      const currentSession = sessions.find(s => s.id === activeSessionId);
      let expectedSrc = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      
      if (currentSession?.localAudioUrl) {
        expectedSrc = currentSession.localAudioUrl;
      } else if (currentSession?.gcsUri && currentSession.gcsUri.startsWith("gs://")) {
        const uId = user?.uid || "guest";
        expectedSrc = `/api/sessions/${currentSession.id}/media?userId=${encodeURIComponent(uId)}`;
      }
      
      const currentUrl = new URL(audioRef.current.src, window.location.origin);
      const targetUrl = new URL(expectedSrc, window.location.origin);
      
      if (currentUrl.pathname + currentUrl.search !== targetUrl.pathname + targetUrl.search) {
        setIsPlaying(false);
        setCurrentTime(0);
        setAudioDuration(0);
        setPlaybackRate(1);
        
        audioRef.current.pause();
        audioRef.current.src = expectedSrc;
        audioRef.current.load();
      }
    }
  }, [activeSessionId, sessions, user]);

  // Ingestion Tabs & Inputs state for high-capacity files handling and simulation
  const [activeIngestTab, setActiveIngestTab] = useState<"upload" | "paste" | "simulate">("upload");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [simTopic, setSimTopic] = useState("");
  const [simMediaType, setSimMediaType] = useState<"audio" | "video">("audio");

  // Listen for Firebase Auth state changes after dynamic initialization
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    // 1. Check Shared Mode before initializing Auth
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('shareId');
    
    if (shareId) {
      setIsSharedMode(true);
      setIsSharedModeLoading(true);
      
      // Fetch shared session bypassing Auth
      fetch(`/api/shared-session/${shareId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setUploadError(data.error);
          } else {
            // Restore local chat history for this guest if any
            const localChatHistory = localStorage.getItem(`shared_session_chat_${shareId}`);
            if (localChatHistory) {
              try { data.chatHistory = JSON.parse(localChatHistory); } catch (e) {}
            } else {
              data.chatHistory = []; // Ensure clear chat for guests
            }
            
            setSessions([data]);
            setActiveSessionId(data.id);
          }
          setIsSharedModeLoading(false);
          setAuthLoading(false); // Stop auth loading
        })
        .catch(err => {
          console.error(err);
          setUploadError("Error cargando sesión compartida");
          setIsSharedModeLoading(false);
          setAuthLoading(false);
        });
      
      return; // Do not initialize standard auth flow for Shared Mode
    }

    const setupAuth = async () => {
      const activeAuth = await initFirebase();
      if (activeAuth) {
        // Handle redirect result if user was sent back from Google OAuth redirect
        getRedirectResult(activeAuth).catch(() => {});
        unsubscribe = onAuthStateChanged(activeAuth, (currentUser) => {
          setUser(currentUser);
          setAuthLoading(false);
        });
      } else {
        // Fallback if client-side init fails
        setAuthLoading(false);
      }
    };

    setupAuth().catch(() => setAuthLoading(false));
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

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/users/profile", { headers });
        if (response.ok) {
          const parsed = await response.json();
          console.log(`[SYNC] Loaded user profile for ${userId}:`, parsed);
          setCompanyName(parsed.companyName || "");
          setFrequentSpeakers(parsed.frequentSpeakers || "");
          setVoiceSignatureBase64(parsed.voiceSignatureBase64 || "");
          setVoiceSignatureMime(parsed.voiceSignatureMime || "");
        }
      } catch (e) {
        console.error("Failed to load user profile:", e);
      }
    };

    loadSessions();
    loadFolders();
    loadProfile();

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
    
    // In shared mode, intercept saving to only keep chat in localStorage for the guest
    if (isSharedMode) {
      const active = updatedList.find(s => s.id === activeSessionId);
      if (active) {
        const params = new URLSearchParams(window.location.search);
        const shareId = params.get('shareId');
        if (shareId && active.chatHistory) {
          localStorage.setItem(`shared_session_chat_${shareId}`, JSON.stringify(active.chatHistory));
        }
      }
      return;
    }

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

  const handleSaveProfile = async (customCompanyName: string, customFrequentSpeakers: string) => {
    setSavingProfile(true);
    try {
      const userId = user ? user.uid : "guest";
      const headers = { 
        "Content-Type": "application/json",
        "x-user-id": userId 
      };
      
      const response = await fetch("/api/users/profile", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ 
          companyName: customCompanyName.trim(),
          frequentSpeakers: customFrequentSpeakers.trim(),
          voiceSignatureBase64: voiceSignatureBase64,
          voiceSignatureMime: voiceSignatureMime
        })
      });
      if (response.ok) {
        const parsed = await response.json();
        setCompanyName(parsed.companyName || "");
        setFrequentSpeakers(parsed.frequentSpeakers || "");
        setVoiceSignatureBase64(parsed.voiceSignatureBase64 || "");
        setVoiceSignatureMime(parsed.voiceSignatureMime || "");
        setIsSettingsOpen(false);
        console.log("[SYNC] Saved user profile successfully:", parsed);
      } else {
        alert("Failed to save profile. Please try again.");
      }
    } catch (e) {
      console.error("Failed to save profile to Firestore:", e);
    } finally {
      setSavingProfile(false);
    }
  };

  const getActiveSession = (): StudySession | undefined => {
    return sessions.find(s => s.id === activeSessionId);
  };

  const activeSession = getActiveSession();

  const handleToggleShare = async (newState: boolean): Promise<{ success: boolean; shareId?: string | null }> => {
    if (!activeSession || isSharedMode) return { success: false };
    try {
      const userId = user ? user.uid : "guest";
      const res = await fetch(`/api/sessions/${activeSession.id}/share`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          "x-user-id": userId 
        },
        body: JSON.stringify({ isShared: newState })
      });
      const data = await res.json();
      
      if (data.success) {
        const updated = { ...activeSession, isShared: data.isShared, shareId: data.shareId };
        saveSessions(sessions.map(s => s.id === activeSession.id ? updated : s));
        return { success: true, shareId: data.shareId };
      }
      return { success: false };
    } catch (err) {
      console.error(err);
      alert("Error al compartir la sesión. Revisa la consola.");
      return { success: false };
    }
  };

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
  // Maintain a tracking set to prevent starting multiple pollers for the same session ID
  const activePollersRef = React.useRef<Set<string>>(new Set());

  const pollSessionStatus = (sessionId: string, localAudioUrl?: string) => {
    if (activePollersRef.current.has(sessionId)) return;
    activePollersRef.current.add(sessionId);

    console.log(`[POLLING] Initiating status poller for session: ${sessionId}`);
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/status`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[POLLING] Status for ${sessionId}:`, data.status);

          // Update the session in-memory with real-time logs, progress, and summary
          setSessions(prevSessions => prevSessions.map(s => {
            if (s.id === sessionId) {
              return {
                ...s,
                status: data.status,
                logs: data.logs || [],
                progress: data.progress !== undefined ? data.progress : s.progress,
                summary: data.summary || s.summary
              };
            }
            return s;
          }));
          
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
            activePollersRef.current.delete(sessionId);
            
            // Reload all sessions from Firestore to reflect the newly processed data
            const userId = user ? user.uid : "guest";
            const resSessions = await fetch("/api/sessions", { headers: { "x-user-id": userId } });
            if (resSessions.ok) {
              const list: StudySession[] = await resSessions.json();
              // Preserve the local blob URL so playback continues to work
              const updatedList = list.map(s => {
                if (s.id === sessionId && localAudioUrl) {
                  return { ...s, localAudioUrl };
                }
                return s;
              });
              setSessions(updatedList);
              localStorage.setItem("study_buddy_sessions", JSON.stringify(updatedList));
            }
          }
        }
      } catch (err) {
        console.error("[POLLING ERROR] Failed to fetch session status:", err);
      }
    }, 5000);
  };

  // Start pollers automatically for any in-progress sessions found on startup
  useEffect(() => {
    if (sessions.length > 0) {
      sessions.forEach(s => {
        if (s.status === "processing") {
          pollSessionStatus(s.id, s.localAudioUrl);
        }
      });
    }
  }, [sessions.length]);

  const processStudyContent = async (payload: {
    mediaName: string;
    mediaType: "audio" | "video";
    base64Data?: string;
    mimeType?: string;
    isSample: boolean;
    sampleType?: string;
    customTitle?: string;
    customText?: string;
    localAudioUrl?: string;
  }) => {
    setUploadError(null);
    setUploadErrorType(null);
    setProcessingStatus({ stage: "uploading", progress: 5, message: "Ingesting material assets..." });

    try {
      // Start simulator parallel with real server fetch to make the experience cinematic
      const delayPromise = payload.isSample ? simulateLoadingStages(false) : Promise.resolve();
      
      const userId = user ? user.uid : "guest";
      const fetchPromise = fetch("/api/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId 
        },
        body: JSON.stringify({ ...payload, templateId: selectedTemplateId })
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
        const e = new Error(responseData.error || "Materials processing encountered an obstacle");
        (e as any).errorType = responseData.errorType;
        throw e;
      }

      const completedSession: StudySession = responseData;
      if (payload.localAudioUrl) {
        completedSession.localAudioUrl = payload.localAudioUrl;
      }

      const newList = [completedSession, ...sessions];
      saveSessions(newList);
      setActiveSessionId(completedSession.id);
      setActiveTab("summary");

      if (completedSession.status === "processing") {
        setProcessingStatus({ stage: "completed", progress: 100, message: "Audio enviado con éxito a la cola asíncrona!" });
        pollSessionStatus(completedSession.id, payload.localAudioUrl);
      } else {
        setProcessingStatus({ stage: "completed", progress: 100, message: "Everything optimized!" });
      }

      // Clean status after success
      setTimeout(() => {
        setProcessingStatus({ stage: "idle", progress: 0, message: "" });
      }, 1000);

    } catch (err: any) {
      console.error("Summarization pipeline fail:", err);
      setUploadError(err.message || "Failed to parse content. Please double check your server secrets settings.");
      setUploadErrorType(err.errorType || null);
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

  // Send dynamic chunked upload or standard multipart upload depending on file size
  const processStudyFile = async (file: File) => {
    setUploadError(null);
    setUploadErrorType(null);
    
    const isAudio = file.type.startsWith("audio/") || file.name.endsWith(".mp3") || file.name.endsWith(".wav") || file.name.endsWith(".m4a") || file.name.endsWith(".ogg");
    const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4") || file.name.endsWith(".webm") || file.name.endsWith(".mov");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv");

    const localAudioUrl = (isAudio || isVideo) ? URL.createObjectURL(file) : undefined;

    let mediaType: "audio" | "video" | "pdf" | "document" = "audio";
    if (isVideo) mediaType = "video";
    else if (isPdf) mediaType = "pdf";
    else if (isText) mediaType = "document";

    const userId = user ? user.uid : "guest";

    try {
      let responseData: any;

      if (file.size > 5 * 1024 * 1024) {
        // --- CHUNKED UPLOAD FLOW ---
        const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB per chunk
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = "upload_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

        console.log(`[FE CHUNKED UPLOAD] File size: ${Math.round(file.size / 1024 / 1024)}MB. Total chunks: ${totalChunks}. Id: ${uploadId}`);
        setProcessingStatus({ stage: "uploading", progress: 5, message: `Iniciando subida de fragmentos...` });

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min((i + 1) * CHUNK_SIZE, file.size);
          const chunkBlob = file.slice(start, end);

          const chunkFormData = new FormData();
          chunkFormData.append("chunk", chunkBlob, file.name);
          chunkFormData.append("uploadId", uploadId);
          chunkFormData.append("chunkIndex", String(i));

          setProcessingStatus({ 
            stage: "uploading", 
            progress: Math.round((i / totalChunks) * 80) + 5, 
            message: `Subiendo fragmento ${i + 1} de ${totalChunks} (${Math.round((end / file.size) * 100)}%)...` 
          });

          let chunkResponse: Response | undefined;
          let retries = 3;
          let lastError: Error | null = null;

          while (retries > 0) {
            try {
              chunkResponse = await fetch("/api/upload-chunk", {
                method: "POST",
                body: chunkFormData
              });
              if (chunkResponse.ok) {
                break;
              } else {
                const errText = await chunkResponse.text();
                lastError = new Error(errText);
              }
            } catch (fetchErr: any) {
              lastError = fetchErr;
            }
            retries--;
            if (retries > 0) {
              console.warn(`[CHUNK UPLOAD FAIL] Chunk ${i + 1}/${totalChunks} failed. Retrying in 1.5s... Attempts left: ${retries}`, lastError);
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          if (!chunkResponse || !chunkResponse.ok) {
            throw new Error(`Error subiendo fragmento ${i + 1} de ${totalChunks} después de 3 intentos. Detalle: ${lastError?.message || "Conexión interrumpida"}`);
          }
        }

        setProcessingStatus({ stage: "uploading", progress: 90, message: "Enviando solicitud de fusión de fragmentos..." });

        const mergeResponse = await fetch("/api/merge-chunks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId
          },
          body: JSON.stringify({
            uploadId,
            fileName: file.name,
            mediaType,
            mimeType: file.type,
            totalChunks,
            templateId: selectedTemplateId,
            processingMode
          })
        });

        const mergeResponseText = await mergeResponse.text();
        if (!mergeResponse.ok) {
          throw new Error(`Error en la fusión de fragmentos: ${mergeResponseText}`);
        }

        responseData = JSON.parse(mergeResponseText);

      } else {
        // --- STANDARD SINGLE MULTIPART UPLOAD FLOW ---
        setProcessingStatus({ stage: "uploading", progress: 10, message: "Subiendo archivo a tu espacio de trabajo corporativo..." });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("mediaType", mediaType);
        formData.append("templateId", selectedTemplateId);
        formData.append("processingMode", processingMode);

        const delayPromise = simulateMergeStages(isPdf);

        const fetchPromise = fetch("/api/upload-file", {
          method: "POST",
          headers: { "x-user-id": userId },
          body: formData
        });

        const [_, response] = await Promise.all([delayPromise, fetchPromise]);

        const responseText = await response.text();
        const isHtml = responseText.includes("Cookie check") || responseText.includes("Action required to load") || responseText.trim().toLowerCase().startsWith("<!doctype html>");
        if (isHtml) {
          throw new Error("COOKIE_BLOCKED_ERROR: Tu navegador está bloqueando las cookies de seguridad requeridas por el iframe de AI Studio (común en Safari, iOS o modo incógnito). Para solucionarlo, haz clic en el botón de abajo para abrir la aplicación en una pestaña independiente.");
        }

        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse response JSON. Raw text:", responseText);
          throw new Error(`Server returned non-JSON response: ${responseText.slice(0, 300)}`);
        }

        if (!response.ok) {
          const e = new Error(responseData.error || "Material analysis failed. Please check Gemini API config.");
          (e as any).errorType = responseData.errorType;
          throw e;
        }
      }

      const completedSession: StudySession = responseData;
      if (localAudioUrl) {
        completedSession.localAudioUrl = localAudioUrl;
      }

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

      if (completedSession.status === "processing") {
        setProcessingStatus({ stage: "completed", progress: 100, message: "Archivo subido con éxito, procesando de fondo..." });
        pollSessionStatus(completedSession.id, localAudioUrl);
      } else {
        setProcessingStatus({ stage: "completed", progress: 100, message: "Workspace companion compiled successfully!" });
      }

      // Clean status after success
      setTimeout(() => {
        setProcessingStatus({ stage: "idle", progress: 0, message: "" });
      }, 1000);

    } catch (err: any) {
      console.error("Upload process failure:", err);
      setUploadError(err.message || "Failed to analyze material. Verify secrets setting.");
      setUploadErrorType(err.errorType || null);
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
  const handleMicAudioReady = (file: File, durationSec: number, localUrl?: string) => {
    const ext = file.name.split('.').pop() || "webm";
    const renamedFile = new File([file], `Voice Session Memo (${durationSec}s).${ext}`, { type: file.type });
    processStudyFile(renamedFile);
  };

  // Audio Playback Player controller helper methods
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.log("Audio play error:", e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleAudioLoadedMetadata = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const seekValue = parseFloat(e.target.value);
    audioRef.current.currentTime = seekValue;
    setCurrentTime(seekValue);
  };

  const handleSpeedToggle = () => {
    if (!audioRef.current) return;
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;
    
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatAudioTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return "00:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const startVoiceSigRecording = async () => {
    voiceSigChunksRef.current = [];
    setVoiceSigTimer(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      voiceSigRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) voiceSigChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(voiceSigChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          setVoiceSignatureBase64(base64);
          setVoiceSignatureMime("audio/webm");
        };
      };

      mediaRecorder.start(250);
      setIsRecordingVoiceSig(true);
      voiceSigTimerRef.current = setInterval(() => {
        setVoiceSigTimer((prev) => {
          if (prev >= 10) {
            stopVoiceSigRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to record voice print:", err);
    }
  };

  const stopVoiceSigRecording = () => {
    if (voiceSigRecorderRef.current && voiceSigRecorderRef.current.state !== "inactive") {
      voiceSigRecorderRef.current.stop();
    }
    setIsRecordingVoiceSig(false);
    if (voiceSigTimerRef.current) {
      clearInterval(voiceSigTimerRef.current);
      voiceSigTimerRef.current = null;
    }
  };

  const handleClearVoiceSig = () => {
    setVoiceSignatureBase64("");
    setVoiceSignatureMime("");
    setVoiceSigTimer(0);
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
    if (activeSession) {
      const updatedSession = { ...activeSession, chatHistory: history };
      saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
    } else if (activeFolderId) {
      const updatedFolders = folders.map(f => {
        if (f.id === activeFolderId) {
          return { ...f, chatHistory: history };
        }
        return f;
      });
      setFolders(updatedFolders);
      if (userProfile) {
        saveCustomFoldersToFirebase(userProfile.uid, updatedFolders);
      }
    }
  };

  const handleRenameSpeaker = (rawSpeakerName: string, newName: string) => {
    if (!activeSession) return;
    const currentSpeakerMap = activeSession.speakerMap || {};
    const updatedSpeakerMap = { ...currentSpeakerMap, [rawSpeakerName]: newName };
    const updatedSession = { ...activeSession, speakerMap: updatedSpeakerMap };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
  };

  const handleReprocessSummary = async () => {
    if (!activeSession) return;
    setUploadError(null);
    setUploadErrorType(null);
    setProcessingStatus({ stage: "summarizing", progress: 20, message: "Re-procesando acta con formato seleccionado..." });

    try {
      const delayPromise = simulateLoadingStages(false);
      const userId = user ? user.uid : "guest";
      
      const fetchPromise = fetch("/api/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": userId 
        },
        body: JSON.stringify({
          mediaName: activeSession.mediaName,
          mediaType: activeSession.mediaType,
          isSample: true,
          sampleType: "custom",
          customTitle: activeSession.title || activeSession.mediaName,
          customText: activeSession.transcript || activeSession.summary,
          templateId: selectedTemplateId
        })
      });

      const [_, response] = await Promise.all([delayPromise, fetchPromise]);
      const responseText = await response.text();
      
      if (!response.ok) {
        throw new Error("Failed to re-process summary.");
      }

      const completedSession = JSON.parse(responseText);
      
      // Keep existing properties like GCS URI or Folder ID
      const updatedSession = {
        ...activeSession,
        title: completedSession.title,
        summary: completedSession.summary,
        actionItems: completedSession.actionItems,
        flashcards: completedSession.flashcards,
        mindMap: completedSession.mindMap,
        templateId: selectedTemplateId
      };

      saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSession : s));
      setActiveTab("summary");
      setProcessingStatus({ stage: "completed", progress: 100, message: "Resumen actualizado!" });
      
      setTimeout(() => {
        setProcessingStatus({ stage: "idle", progress: 0, message: "" });
      }, 800);

    } catch (err: any) {
      console.error("Failed to reprocess summary:", err);
      setUploadError(err.message || "Reprocessing failed.");
      setProcessingStatus({ stage: "failed", progress: 0, message: "" });
    }
  };

  const handleAskAI = async (text: string) => {
    if (!activeSession) return;
    setIsChatOpen(true); // Open slide-out Chat Buddy drawer
    
    const newUserMsg: ChatMessage = {
      id: "usr_" + Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: new Date().toISOString()
    };
    
    const stagedHistory = [...activeSession.chatHistory, newUserMsg];
    
    const updatedSessionWithUser = { ...activeSession, chatHistory: stagedHistory };
    saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSessionWithUser : s));
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: activeSession.chatHistory.filter(m => m.id !== "welcome_msg"),
          contextSubject: activeSession.title,
          contextSummary: activeSession.summary + "\n\nTranscript: " + (activeSession.transcript || "")
        })
      });
      
      if (!response.ok) {
        throw new Error("Chat service communication error");
      }
      
      const resJson = await response.json();
      
      const newModelMsg: ChatMessage = {
        id: "ai_" + Date.now().toString(36),
        role: "model",
        content: resJson.content,
        timestamp: new Date().toISOString()
      };
      
      const updatedSessionWithModel = { ...updatedSessionWithUser, chatHistory: [...stagedHistory, newModelMsg] };
      saveSessions(sessions.map(s => s.id === activeSession.id ? updatedSessionWithModel : s));
    } catch (err) {
      console.error("Failed to query AI:", err);
    }
  };

  const copyToClipboard = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.summary);
    setIsCopingSummary(true);
    setTimeout(() => setIsCopingSummary(false), 2000);
  };

  if (authLoading || isSharedModeLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 font-sans text-slate-900">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            {isSharedModeLoading ? "Cargando sesión compartida..." : "Cargando Espacio Corporativo..."}
          </p>
        </div>
      </div>
    );
  }

  if (!user && !isSharedMode) {
    return (
      <div className="flex h-screen w-full bg-slate-950 font-sans text-white overflow-hidden relative">
        {/* Subtle grid mesh decoration */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        {/* Decorative blur blobs */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10">
          <div className="max-w-md w-full space-y-8 bg-slate-900/40 border border-slate-800 p-8 md:p-10 rounded-3xl backdrop-blur-md shadow-2xl">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-600/20">
                Σ
              </div>
              <h1 className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-white mt-4">
                PLAUD Corporate Intelligence
              </h1>
              <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-950/60 border border-indigo-900/60 px-3 py-1 rounded-full">
                Workspace Multi-Tenant Activo
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Bienvenido al espacio de trabajo unificado. Inicia sesión con tu cuenta de Google para acceder a tus minutas privadas, almacenamiento seguro en la nube y síntesis de temas mediante IA.
            </p>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/40 text-rose-300 text-left text-xs font-medium leading-relaxed">
                ⚠️ {uploadError}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => {
                  if (auth) {
                    signInWithPopup(auth, googleProvider).catch((e: any) => {
                      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
                        // Popup blocked — fall back to redirect
                        signInWithRedirect(auth, googleProvider);
                      } else if (e.code !== 'auth/popup-closed-by-user') {
                        setUploadError(`Error de inicio de sesión: ${e.message}`);
                      }
                    });
                  }
                }}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs rounded-xl shadow-lg transition duration-150 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4 shrink-0" />
                Iniciar sesión con tu cuenta de Google
              </button>
            </div>

            <div className="border-t border-slate-800/60 pt-6 flex items-center justify-between text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              <span>Tenant: Plaud-own</span>
              <span>GCP Firestore V2.1</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Navigation */}
      {!isSharedMode && (
      <aside className="w-16 md:w-20 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-8 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl cursor-pointer shadow-xs hover:bg-indigo-700 transition" onClick={() => setActiveSessionId(null)} title="New Study Block">
          Σ
        </div>
        <nav className="flex flex-col gap-6 items-center">
          {/* Button 1: Upload / Analysis Station */}
          <button
            onClick={() => setActiveSessionId(null)}
            className={`p-3 rounded-xl transition duration-150 cursor-pointer ${!activeSession ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            title="Analysis Station"
          >
            <Upload className="w-5.5 h-5.5" />
          </button>

          {/* Button 2: Choose Templates */}
          <button
            onClick={() => {
              if (activeSidebarTab === "templates" && !isSidebarCollapsed) {
                setIsSidebarCollapsed(true);
              } else {
                setActiveSidebarTab("templates");
                setIsSidebarCollapsed(false);
              }
            }}
            className={`p-3 rounded-xl transition duration-150 cursor-pointer ${activeSidebarTab === "templates" && !isSidebarCollapsed ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            title="Formularios de Resumen"
          >
            <BookOpen className="w-5.5 h-5.5" />
          </button>

          {/* Button 3: Library Explorer */}
          <button
            onClick={() => {
              if (activeSidebarTab === "history" && !isSidebarCollapsed) {
                setIsSidebarCollapsed(true);
              } else {
                setActiveSidebarTab("history");
                setIsSidebarCollapsed(false);
              }
            }}
            className={`p-3 rounded-xl transition duration-150 cursor-pointer ${activeSidebarTab === "history" && !isSidebarCollapsed ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
            title="Historial de Reuniones"
          >
            <FolderHeart className="w-5.5 h-5.5" />
          </button>
        </nav>
        <div className="mt-auto">
          <div className="w-3.5 h-3.5 rounded-full bg-indigo-600" title="API Connected" />
        </div>
      </aside>
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 hidden sm:inline">
              {companyName ? `🏢 ${companyName}` : "🏢 Espacio Corporativo"}
            </span>
            {activeSession ? (
              <>
                <h1 className="text-sm md:text-base font-bold text-slate-800 truncate max-w-[200px] md:max-w-[340px]">
                  {activeSession.title || activeSession.mediaName}
                </h1>
                <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded border border-indigo-100 font-medium shrink-0">
                  {isSharedMode ? "Acceso de Invitado" : (activeSession.mediaType === "video" ? "Video Processed" : "Audio Processed")}
                </span>
                
                {/* Topic Folder Move Selector */}
                {!isSharedMode && (
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
                )}
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
            {isSharedMode ? (
              <a 
                href="/"
                className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg shadow-2xs transition cursor-pointer"
              >
                Sign up for PLAUD
              </a>
            ) : user ? (
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
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                  title="Ajustes de Organización"
                >
                  <Settings className="h-4 w-4" />
                </button>
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
                onClick={() => {
                  if (auth) {
                    signInWithPopup(auth, googleProvider).catch((e: any) => {
                      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
                        signInWithRedirect(auth, googleProvider);
                      } else if (e.code !== 'auth/popup-closed-by-user') {
                        setUploadError(`Error de inicio de sesión: ${e.message}`);
                      }
                    });
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                Iniciar sesión con Google
              </button>
            )}

            {activeSession && !isSharedMode && (
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
            // Only show the API-Key configuration screen when the backend explicitly flags an auth error.
            const isKeyError = uploadErrorType === "AUTH";
            
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
                <h3 className="font-display font-bold text-base text-slate-800 font-sans">
                  {processingStatus.stage === "uploading" ? "Subiendo Archivo de Audio..." : "Compilando Informe de Reunión..."}
                </h3>
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">Etapa: {processingStatus.stage}</p>
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
          /* SECTION A: Redesigned PLAUD-style Document-First spacious Layout */
          <section className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0 relative">
            
            {/* Column 1: Clean, Consolidated Sidebar (Span 3) */}
            {(!isSidebarCollapsed && !isSharedMode) && (
              <div className="col-span-12 lg:col-span-3 border-r border-slate-200 p-5 flex flex-col gap-6 bg-white overflow-y-auto h-full animate-fade-in">
              
              {activeSidebarTab === "templates" ? (
                /* Formatos de Resumen (Templates) Panel */
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-1.5 border-b border-slate-50 pb-3 mb-1">
                    <BookOpen className="h-5 w-5 text-indigo-500 animate-pulse" />
                    <div>
                      <h2 className="font-sans text-sm font-bold text-slate-800">Formatos de Resumen</h2>
                      <p className="font-sans text-[10px] text-slate-400">Selecciona el template de estructuración</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 pr-1">
                    {SUMMARY_TEMPLATES.map((tpl) => {
                      const isSelected = selectedTemplateId === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => setActivePreviewTemplateId(tpl.id)}
                          className={`text-left text-xs font-bold px-3 py-2.5 rounded-xl transition flex flex-col gap-1 border cursor-pointer ${
                            isSelected 
                              ? "bg-slate-900 border-slate-900 text-white shadow-2xs" 
                              : "bg-slate-50 border-slate-200/50 text-slate-700 hover:bg-slate-100/50 hover:border-slate-250"
                          }`}
                          title="Haz clic para ver detalles y previsualizar estructura"
                        >
                          <span className="font-extrabold truncate block w-full">{tpl.name}</span>
                          <span className={`text-[9px] font-medium leading-none ${isSelected ? "text-indigo-200 text-slate-300" : "text-slate-400"}`}>
                            {tpl.category}
                          </span>
                          <p className={`text-[10px] leading-relaxed font-normal ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                            {tpl.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Standard Explorer Panel (History & Folders) */
                <div className="space-y-6 animate-fade-in flex flex-col h-full">
                  {/* Key Progress Metrics */}
                  <div>
                    <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Progreso General</h2>
                    <div className="mt-1.5">
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg text-center shadow-3xs">
                        <span className="block text-lg font-bold text-indigo-600">
                          {activeSession.actionItems.filter(t => t.completed).length}/{activeSession.actionItems.length}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Objetivos de Reunión</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0">
                    <SidebarHistory 
                      sessions={sessions} 
                      activeSessionId={activeSessionId}
                      onSelectSession={(id) => { setActiveSessionId(id); setActiveTab("summary"); }}
                      onDeleteSession={handleDeleteSession}
                      folders={folders}
                      activeFolderId={activeFolderId}
                      onSelectFolder={setActiveFolderId}
                      onCreateFolder={handleCreateFolder}
                      onMoveSession={handleMoveSessionToFolder}
                    />
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Column 2: Document-First Spacious Reader Area (Span 9 or 12 depending on collapse state) */}
            <div className={`col-span-12 ${(isSidebarCollapsed || isSharedMode) ? "lg:col-span-12" : "lg:col-span-9"} bg-slate-50/50 p-6 md:p-8 flex flex-col overflow-y-auto h-full min-h-0 transition-all duration-300`}>
              <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 gap-5 min-h-0">
                
                {/* Header Row: Title & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    {/* Collapsible toggle handle button */}
                    {!isSharedMode && (
                    <button
                      onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                      className="p-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95 text-xs font-bold"
                      title={isSidebarCollapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
                    >
                      {isSidebarCollapsed ? "▶" : "◀"}
                    </button>
                    )}
                    <div className="flex flex-col gap-1">
                      <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight">
                        {activeSession.title || activeSession.mediaName}
                      </h1>
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100 shadow-3xs">
                          {activeSession.mediaType === "video" ? "📺 Video" : activeSession.mediaType === "pdf" ? "📕 Documento PDF" : "🎙️ Audio"}
                        </span>
                        
                        {/* Topic Folder Selector */}
                        <select
                          value={activeSession.folderId || ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : e.target.value;
                            handleMoveSessionToFolder(activeSession.id, val);
                          }}
                          className="bg-white border border-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition focus:outline-hidden hover:bg-slate-50"
                          title="Asignar Tema"
                        >
                          <option value="">📂 Sin Tema (General)</option>
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>
                              📂 {f.name}
                            </option>
                          ))}
                        </select>
                        
                        {!isSharedMode && (
                          <button
                            onClick={() => setIsShareModalOpen(true)}
                            className={`ml-2 px-2.5 py-0.5 text-[9px] font-bold rounded-md border transition cursor-pointer flex items-center gap-1 shadow-3xs ${
                              activeSession.isShared 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                            title="Compartir Minuta"
                          >
                            <Share2 className="w-3 h-3" />
                            {activeSession.isShared ? 'Compartido' : 'Compartir'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Redesigned Tab Switcher Bar & AI Trigger (Reordered: Transcript first, streamlined to keep core focus) */}
                  <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                    <div className="flex bg-white rounded-xl border border-slate-200/80 p-1 shadow-3xs overflow-x-auto">
                      {[
                        { id: "transcript", label: "Transcript" },
                        { id: "summary", label: "Summary" },
                        { id: "infographics", label: "Infographics" },
                        { id: "tasks", label: "Goals & Tasks" }
                      ].map((subTab) => {
                        const isSelected = activeTab === subTab.id;
                        return (
                          <button
                            key={subTab.id}
                            onClick={() => setActiveTab(subTab.id as any)}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition duration-150 cursor-pointer ${
                              isSelected 
                                ? "bg-slate-900 text-white shadow-2xs" 
                                : "text-slate-400 hover:text-slate-800"
                            }`}
                          >
                            {subTab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Ask IA Floating/Header slide trigger */}
                    <button
                      onClick={() => setIsChatOpen(!isChatOpen)}
                      className={`px-4 py-1.5 rounded-xl text-[11px] font-bold shadow-2xs border flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 ${
                        isChatOpen 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                          : "bg-slate-900 border-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Ask AI
                    </button>
                  </div>
                </div>

                {/* Premium Integrated Audio Playback Controller Bar */}
                {activeSession.mediaType !== "pdf" && activeSession.mediaType !== "document" && (
                  <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-3xs flex items-center justify-between gap-4 flex-wrap animate-fade-in">
                    
                    {/* Hidden Native Audio Element */}
                    <audio
                      ref={audioRef}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleAudioLoadedMetadata}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />

                    {/* Play / Pause Toggle Button */}
                    <button
                      onClick={handlePlayPause}
                      className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-indigo-600 transition shadow-xs cursor-pointer shrink-0 active:scale-95"
                      title={isPlaying ? "Pausar" : "Reproducir"}
                    >
                      {isPlaying ? (
                        <div className="flex items-center gap-0.5 justify-center">
                          <span className="w-1.5 h-4 bg-white rounded-full block" />
                          <span className="w-1.5 h-4 bg-white rounded-full block" />
                        </div>
                      ) : (
                        <span className="ml-1 text-xs">▶</span>
                      )}
                    </button>

                    {/* Track Seeker & Timeline */}
                    <div className="flex-1 min-w-[200px] flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                        {formatAudioTime(currentTime)}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max={audioDuration || 100}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeekChange}
                        className="flex-1 accent-indigo-600 h-1 bg-slate-100 rounded-lg cursor-pointer"
                        title="Adelantar / Retroceder"
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                        {formatAudioTime(audioDuration)}
                      </span>
                    </div>

                    {/* Controls Row: Speed & Wave Equalizer */}
                    <div className="flex items-center gap-4 shrink-0">
                      
                      {/* Playback speed toggle */}
                      <button
                        onClick={handleSpeedToggle}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[10px] font-black text-slate-600 transition cursor-pointer"
                        title="Cambiar velocidad de reproducción"
                      >
                        {playbackRate.toFixed(1)}x
                      </button>

                      {/* Equalizer Wave Animation (Only dances when isPlaying is true!) */}
                      <div className="flex items-end gap-[2px] h-4 w-6 shrink-0" title={isPlaying ? "Reproduciendo audio" : "Reproductor pausado"}>
                        {[
                          { delay: "delay-[0.1s]", activeH: "h-3" },
                          { delay: "delay-[0.3s]", activeH: "h-4" },
                          { delay: "delay-[0.2s]", activeH: "h-2" },
                          { delay: "delay-[0.4s]", activeH: "h-3.5" },
                        ].map((bar, barIdx) => (
                          <span
                            key={barIdx}
                            className={`w-[3px] rounded-full bg-indigo-600 transition-all duration-350 ${
                              isPlaying ? `${bar.activeH} animate-pulse ${bar.delay}` : "h-[3px]"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Main White Document Canvas (Spacious Page reader) */}
                <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-6 md:p-10 shadow-3xs flex flex-col overflow-y-auto">
                  
                  {/* Dynamic Tab Rendering inside spacious block */}
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
                        onDeleteItem={handleDeleteTask}
                        isSharedMode={isSharedMode}
                      />
                    </div>
                  )}

                  {activeTab === "summary" && (
                    <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
                      
                      {/* Premium PLAUD-style Metadata block at top of summary */}
                      <div className="border-b border-slate-100 pb-5 mb-8 text-xs text-slate-500 grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans bg-slate-50/50 p-4 rounded-xl leading-normal">
                        <div>
                          <span className="font-bold text-slate-800">📅 Date & Time:</span>{" "}
                          {new Date(activeSession.createdAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800">📍 Location:</span>{" "}
                          Acme Virtual Call / Panama
                        </div>
                        <div>
                          <span className="font-bold text-slate-800">👥 Speakers:</span>{" "}
                          {activeSession.transcript ? activeSession.transcript.split("\n").reduce((acc, curr) => {
                              const match = curr.trim().match(/^\[\d{2}:\d{2}(?::\d{2})?\]\s*(.*?):\s*/);
                              if (match) {
                                const name = formatSpeakerName(match[1].trim());
                                if (!acc.includes(name)) acc.push(name);
                              }
                              return acc;
                            }, [] as string[]).length || 2 : 2}{" "}
                          detected speakers
                        </div>
                      </div>

                      {/* Header with copy text shortcut */}
                      <div className="flex items-center justify-between border-b pb-2 mb-4 border-slate-100">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Executive summary notes</span>
                        <div className="flex items-center gap-3">
                          {/* Regenerar con formato */}
                          <button
                            onClick={handleReprocessSummary}
                            disabled={processingStatus.stage !== "idle"}
                            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="Regenerar este resumen usando la plantilla seleccionada a la izquierda"
                          >
                            🔄 Regenerate Summary
                          </button>
                          <span className="text-slate-200">|</span>
                          <button 
                            onClick={copyToClipboard}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                          >
                            {isCopingSummary ? "¡Copiado!" : "Copy text"}
                          </button>
                        </div>
                      </div>

                      {/* Spacious text reader body */}
                      <div className="flex-1 pr-1 pb-4">
                        <FormatMarkdown text={activeSession.summary} />

                        {activeSession.status === "processing" && activeSession.logs && activeSession.logs.length > 0 && (
                          <div className="mt-8 bg-slate-950 text-slate-200 p-5 rounded-2xl font-mono text-[11px] space-y-2.5 border border-slate-800 shadow-lg max-h-72 overflow-y-auto animate-fade-in leading-normal select-text">
                            <div className="text-slate-400 border-b border-slate-800 pb-2 mb-3 flex items-center justify-between font-sans font-bold">
                              <span className="flex items-center gap-1.5 text-xs text-slate-300">⚙️ LOGS DE PROCESAMIENTO EN TIEMPO REAL</span>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                                <span className="text-[10px] text-emerald-400 uppercase font-black">Procesando ({activeSession.progress || 0}%)</span>
                              </div>
                            </div>
                            <div className="space-y-1.5 overflow-x-auto">
                              {activeSession.logs.map((log: any, idx: number) => (
                                <div key={idx} className="flex gap-3 leading-relaxed">
                                  <span className="text-slate-500 shrink-0 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                  <span className="text-indigo-400 font-extrabold shrink-0 select-none">[{log.stage}]</span>
                                  <span className="text-slate-300">{log.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "transcript" && (
                    <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
                      <div className="flex items-center justify-between border-b pb-2 mb-4 border-slate-100">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Diarized speech logs</span>
                      </div>
                      <div className="flex-1 pr-1">
                        <RenderTranscriptTimeline 
                          text={activeSession.transcript || ""} 
                          speakerMap={activeSession.speakerMap}
                          onRenameSpeaker={handleRenameSpeaker}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </section>
        ) : (
          /* SECTION B: NO active study session - Welcome & uploader suite */
          <section className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0 relative">
            
            {/* Column 1: Clean, Consolidated Sidebar (Span 3) */}
            {(!isSidebarCollapsed && !isSharedMode) && (
              <div className="col-span-12 lg:col-span-3 border-r border-slate-200 p-5 flex flex-col gap-6 bg-white overflow-y-auto h-full animate-fade-in">
                {activeSidebarTab === "templates" ? (
                  /* Formatos de Resumen (Templates) Panel */
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-1.5 border-b border-slate-50 pb-3 mb-1">
                      <BookOpen className="h-5 w-5 text-indigo-500 animate-pulse" />
                      <div>
                        <h2 className="font-sans text-sm font-bold text-slate-800">Formatos de Resumen</h2>
                        <p className="font-sans text-[10px] text-slate-400">Selecciona el template de estructuración</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pr-1">
                      {SUMMARY_TEMPLATES.map((tpl) => {
                        const isSelected = selectedTemplateId === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            onClick={() => setActivePreviewTemplateId(tpl.id)}
                            className={`text-left text-xs font-bold px-3 py-2.5 rounded-xl transition flex flex-col gap-1 border cursor-pointer ${
                              isSelected 
                                ? "bg-slate-900 border-slate-900 text-white shadow-2xs" 
                                : "bg-slate-50 border-slate-200/50 text-slate-700 hover:bg-slate-100/50 hover:border-slate-250"
                            }`}
                            title="Haz clic para ver detalles y previsualizar estructura"
                          >
                            <span className="font-extrabold truncate block w-full">{tpl.name}</span>
                            <span className={`text-[9px] font-medium leading-none ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                              {tpl.category}
                            </span>
                            <p className={`text-[10px] leading-relaxed font-normal ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                              {tpl.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Standard Explorer Panel (History & Folders) */
                  <div className="flex-1 min-h-0">
                    <SidebarHistory 
                      sessions={sessions} 
                      activeSessionId={activeSessionId}
                      onSelectSession={(id) => { setActiveSessionId(id); setActiveTab("summary"); }}
                      onDeleteSession={handleDeleteSession}
                      folders={folders}
                      activeFolderId={activeFolderId}
                      onSelectFolder={setActiveFolderId}
                      onCreateFolder={handleCreateFolder}
                      onMoveSession={handleMoveSessionToFolder}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Column 2: Centered Ingestion Card Area OR Folder Dashboard */}
            <div className={`col-span-12 ${(isSidebarCollapsed || isSharedMode) ? "lg:col-span-12" : "lg:col-span-9"} bg-slate-50/50 p-6 md:p-12 overflow-y-auto h-full flex items-center justify-center relative`}>
              
              {/* Sidebar toggle handle button */}
              {!isSharedMode && (
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute top-6 left-6 p-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95 text-xs font-bold"
                title={isSidebarCollapsed ? "Mostrar menú lateral" : "Ocultar menú lateral"}
              >
                {isSidebarCollapsed ? "▶" : "◀"}
              </button>
              )}

              {activeFolderId !== null ? (
                // --- FOLDER DASHBOARD VIEW ---
                <FolderDashboard 
                  folder={folders.find(f => f.id === activeFolderId)!} 
                  sessions={sessions.filter(s => s.folderId === activeFolderId)} 
                  isSynthesizing={isSynthesizingFolder} 
                  onSynthesize={handleSynthesizeFolder} 
                  FormatMarkdown={FormatMarkdown}
                  onSelectSession={(id) => { setActiveSessionId(id); setActiveFolderId(null); setActiveTab("summary"); }}
                />
              ) : (
                // --- CENTER ALIGNED UPLOAD / WELCOME CARD ---
                <div className="max-w-xl w-full bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-sm flex flex-col gap-6 animate-fade-in">
                  <div className="text-center space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-widest bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                      PLAUD Corporate Intelligence
                    </span>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-3">
                      Plataforma de Ingesta
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans max-w-sm mx-auto">
                      Sube tus archivos multimedia o de texto para que la IA realice una transcripción diarizada y un resumen ejecutivo estructurado.
                    </p>
                  </div>

                  {/* Premium Processing Mode Toggle */}
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between gap-4 font-sans text-xs">
                <div className="space-y-0.5 text-left">
                  <span className="font-extrabold text-slate-800 text-[11px] block">Modo de Procesamiento IA</span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {processingMode === "turbo" 
                      ? "⚡ Turbo: un solo paso de Gemini (10-15s, asíncrono, sin timeouts)" 
                      : "🎯 Alta Fidelidad: diarización premium por oradores (STT + LLM)"}
                  </p>
                </div>
                <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200 gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setProcessingMode("high-fidelity")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${
                      processingMode === "high-fidelity" 
                        ? "bg-slate-900 text-white shadow-3xs" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    🎯 Hi-Fi
                  </button>
                  <button
                    type="button"
                    onClick={() => setProcessingMode("turbo")}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition duration-150 cursor-pointer ${
                      processingMode === "turbo" 
                        ? "bg-slate-900 text-white shadow-3xs" 
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    ⚡ Turbo
                  </button>
                </div>
              </div>

              {/* Sub-tab selection hooks */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 gap-1 shadow-3xs">
                <button
                  onClick={() => { setActiveIngestTab("upload"); setUploadError(null); }}
                  className={`flex-1 py-2 text-[11px] font-black rounded-lg transition duration-150 cursor-pointer ${activeIngestTab === "upload" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => { setActiveIngestTab("paste"); setUploadError(null); }}
                  className={`flex-1 py-2 text-[11px] font-black rounded-lg transition duration-150 cursor-pointer ${activeIngestTab === "paste" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Paste Text
                </button>
                <button
                  onClick={() => { setActiveIngestTab("simulate"); setUploadError(null); }}
                  className={`flex-1 py-2 text-[11px] font-black rounded-lg transition duration-150 cursor-pointer ${activeIngestTab === "simulate" ? "bg-white text-indigo-600 shadow-2xs" : "text-slate-500 hover:text-slate-700"}`}
                >
                  ⚡ Fast Simulation
                </button>
              </div>

              {activeIngestTab === "upload" && (
                <div className="space-y-4">
                  {/* Drag and Drop box */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition min-h-[160px] cursor-pointer ${
                      dragOver 
                        ? "border-indigo-600 bg-indigo-50/20 text-indigo-700" 
                        : "border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-50/85 hover:border-slate-350"
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
                    <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 mb-3 shadow-3xs">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 block">Drag & drop files here</span>
                    <span className="text-[10px] text-slate-400 block mt-1">Supports Media (MP3, MP4) & Documents (PDF, TXT) up to 150MB</span>
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
                          className="mt-1 self-start px-3 py-1.5 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
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
                </div>
              )}

              {activeIngestTab === "paste" && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Meeting Title</label>
                    <input
                      type="text"
                      value={pastedTitle}
                      onChange={(e) => setPastedTitle(e.target.value)}
                      placeholder="e.g. Proyecto Celia Bot: Reunión CRM"
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Transcript Notes</label>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Pega las notas de tu reunión o transcripción completa aquí..."
                      rows={5}
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-sans text-xs leading-relaxed"
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
                        setUploadError("Please provide both a title and content before processing.");
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
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition duration-150 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" /> Start Gemini Analysis
                  </button>
                </div>
              )}

              {activeIngestTab === "simulate" && (
                <div className="space-y-4 font-sans text-xs">
                  <div className="bg-indigo-50 text-indigo-900 border border-indigo-100 p-3.5 rounded-2xl leading-normal">
                    <p className="font-bold flex items-center gap-1.5 text-indigo-950">⚡ Local Simulator Active</p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Estructura tus notas al instante saltándote la subida de archivos pesados. ¡Elige un tema y pruébalo en segundos!
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Simulated Topic Theme</label>
                    <input
                      type="text"
                      value={simTopic}
                      onChange={(e) => setSimTopic(e.target.value)}
                      placeholder="e.g. Implementación de Celia Bot y CRM"
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px]">Simulation Asset Medium</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSimMediaType("audio")}
                        className={`py-2 px-3 border rounded-xl font-bold text-center transition duration-150 cursor-pointer ${simMediaType === "audio" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"}`}
                      >
                        🎙️ Simulated Audio
                      </button>
                      <button
                        onClick={() => setSimMediaType("video")}
                        className={`py-2 px-3 border rounded-xl font-bold text-center transition duration-150 cursor-pointer ${simMediaType === "video" ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"}`}
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
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition duration-150 shadow-xs active:scale-95 cursor-pointer"
                  >
                    🚀 Build Simulated Workspace Instantly
                  </button>
                </div>
              )}

                </div>
              )}

            </div>

          </section>
        )}

        {/* Template Detail Preview Modal (Capture 2) */}
        {activePreviewTemplateId && (() => {
          const tpl = SUMMARY_TEMPLATES.find(t => t.id === activePreviewTemplateId);
          if (!tpl) return null;
          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full flex flex-col p-6 md:p-8 space-y-5 animate-scale-up">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-sans font-black text-slate-900 text-lg leading-tight">{tpl.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {tpl.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">• Outlines Active</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActivePreviewTemplateId(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1 rounded-lg hover:bg-slate-50"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1 font-sans text-xs text-slate-650 leading-relaxed">
                  <div>
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[9.5px] mb-1.5">Description</h4>
                    <p className="text-slate-600 font-normal leading-relaxed text-[12.5px]">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3.5">
                    <h4 className="font-extrabold text-slate-800 uppercase tracking-wider text-[9.5px] mb-2">OUTLINE</h4>
                    <ul className="space-y-2.5 pl-1">
                      {tpl.outlinePoints.map((pt, ptIdx) => (
                        <li key={ptIdx} className="flex gap-2 items-start text-[11.5px] text-slate-650 leading-relaxed">
                          <span className="text-indigo-500 shrink-0 font-extrabold text-[13px] mt-[-2px]">•</span>
                          <span className="font-normal text-slate-650">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(tpl.id);
                      setActivePreviewTemplateId(null);
                    }}
                    className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer border border-slate-200"
                  >
                    Set for next use
                  </button>
                  {activeSession && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(tpl.id);
                        setActivePreviewTemplateId(null);
                        // Trigger immediate re-summarization
                        setTimeout(() => handleReprocessSummary(), 100);
                      }}
                      className="px-4.5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-indigo-600 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                    >
                      Regenerate current session with this format
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

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

        {/* Tenant Settings Overlay Modal */}
        {isSettingsOpen && user && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full flex flex-col p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Settings className="h-5 w-5" />
                  <h3 className="font-bold text-slate-800 text-sm">Ajustes de Organización</h3>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans overflow-y-auto">
                {/* User Google Profile */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center gap-3">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || ""} className="w-11 h-11 rounded-full border border-slate-200" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm border border-indigo-200">
                      {user.displayName ? user.displayName[0].toUpperCase() : "U"}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-slate-850 text-xs leading-none">{user.displayName || "Usuario"}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">{user.email}</p>
                    <p className="text-[8px] text-slate-400 font-mono mt-0.5">UID: {user.uid}</p>
                  </div>
                </div>

                {/* Edit Company/Workspace Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px] flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-indigo-500" /> Nombre de Compañía / Organización
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corporation, Logística Global"
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 text-xs"
                  />
                  <span className="text-[9px] text-slate-400 leading-normal font-semibold">
                    Este nombre se mostrará de forma destacada en la cabecera de tu espacio de trabajo privado.
                  </span>
                </div>

                {/* Edit Frequent Speakers List */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-600 uppercase tracking-wide text-[9px] flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Hablantes Frecuentes (Diarización Inteligente)
                  </label>
                  <input
                    type="text"
                    value={frequentSpeakers}
                    onChange={(e) => setFrequentSpeakers(e.target.value)}
                    placeholder="e.g. Julio, Sophia, Roberto"
                    className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800 text-xs"
                  />
                  <span className="text-[9px] text-slate-400 leading-normal font-semibold">
                    Ingresa los nombres de los participantes recurrentes separados por comas. La IA intentará identificarlos automáticamente en el audio.
                  </span>
                </div>

                {/* Voice Print Calibration & Enrollment (Apple-Style) */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <label className="font-bold text-slate-800 uppercase tracking-wide text-[9px] flex items-center gap-1">
                    <Mic className="h-3.5 w-3.5 text-indigo-500" /> Firma de Voz del Dueño (Voice Print)
                  </label>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold leading-normal">
                    Calibra tu voz para que la IA te reconozca automáticamente como orador en todas tus grabaciones de forma biométrica.
                  </p>

                  <div className="bg-white border border-slate-150 p-3 rounded-xl space-y-2.5 shadow-3xs">
                    <div className="text-[9px] font-bold text-indigo-600 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 leading-normal">
                      🎙️ <span className="font-black uppercase">Frase de calibración:</span> "Hola, soy el dueño de esta cuenta de PLAUD y este es mi registro de voz oficial para mi firma de voz."
                    </div>

                    <div className="flex items-center gap-3">
                      {isRecordingVoiceSig ? (
                        <button
                          type="button"
                          onClick={stopVoiceSigRecording}
                          className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer text-[10px]"
                        >
                          <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
                          Parar ({voiceSigTimer}s)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startVoiceSigRecording}
                          className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer text-[10px]"
                        >
                          🎤 Calibrar Voz
                        </button>
                      )}

                      {voiceSignatureBase64 ? (
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <span className="text-[9.5px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                            ✓ Registrada
                          </span>
                          <button
                            type="button"
                            onClick={handleClearVoiceSig}
                            className="p-1 text-slate-450 hover:text-rose-600 rounded transition cursor-pointer text-xs"
                            title="Eliminar calibración de voz"
                          >
                            🗑️
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9.5px] text-slate-400 font-semibold flex-1 text-right">
                          Sin registrar
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* GCP Tenant Resources (Read-Only auditing stats) */}
                <div className="border border-slate-100 p-3.5 rounded-xl space-y-2 bg-slate-50/50">
                  <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">Recursos GCP Activos (Plaud-own)</h4>
                  <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-slate-500">
                    <div>
                      <span className="block text-[8px] text-slate-400 uppercase font-bold">Project ID</span>
                      <span className="font-mono text-slate-700">plaud-own</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400 uppercase font-bold">GCS Storage Bucket</span>
                      <span className="font-mono text-slate-700">plaud-own-media-assets</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] text-slate-400 uppercase font-bold">Firestore NoSQL Database</span>
                      <span className="font-mono text-slate-700">(default) - Native Mode</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer bg-slate-105 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => handleSaveProfile(companyName, frequentSpeakers)}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {savingProfile ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Assistant Sliding Slide-Over Drawer - Global */}
        <div 
          className={`fixed right-0 top-16 bottom-0 w-80 sm:w-[390px] bg-white border-l border-slate-200/80 shadow-2xl z-30 transition-transform duration-300 ease-in-out flex flex-col ${
            isChatOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex-1 min-h-0 relative flex flex-col">
            <ChatBuddy 
              session={activeSession} 
              folderContext={!activeSession && activeFolderId ? {
                folder: folders.find(f => f.id === activeFolderId)!,
                sessions: sessions.filter(s => s.folderId === activeFolderId)
              } : undefined}
              onUpdateChatHistory={handleUpdateChatHistory}
            />
            
            {/* Floating internal close handle button */}
            <button
              onClick={() => setIsChatOpen(false)}
              className="absolute top-4 right-12 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              title="Close AI helper"
            >
              ✕
            </button>
          </div>
        </div>

        {/* General Floating Ask IA Action Button for convenience */}
        {(activeSessionId !== null || activeFolderId !== null) && (
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="fixed right-6 bottom-6 z-20 h-12 w-12 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center hover:bg-indigo-600 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
            title="Consultar con IA"
          >
            <Sparkles className="h-5 w-5 animate-pulse" />
          </button>
        )}

        {/* Share Modal Component */}
        {isShareModalOpen && activeSession && (
          <ShareModal 
            session={activeSession}
            onClose={() => setIsShareModalOpen(false)}
            onToggleShare={handleToggleShare}
          />
        )}

      </main>
    </div>
  );
}
