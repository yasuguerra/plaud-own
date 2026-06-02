import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageCircle, HelpCircle, Loader2, RefreshCw } from "lucide-react";
import { ChatMessage, StudySession } from "../types";

interface ChatBuddyProps {
  session: StudySession;
  onUpdateChatHistory: (updatedHistory: ChatMessage[]) => void;
}

export default function ChatBuddy({ session, onUpdateChatHistory }: ChatBuddyProps) {
  const [inputMsg, setInputMsg] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);

  // Auto Scroll to bottom when messages list updates
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [session.chatHistory]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isSending) return;
    setChatError(null);
    setIsSending(true);

    const newUserMsg: ChatMessage = {
      id: "usr_" + Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: new Date().toISOString()
    };

    // Optimistically update lists on feed
    const stagedHistory = [...session.chatHistory, newUserMsg];
    onUpdateChatHistory(stagedHistory);
    setInputMsg("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: session.chatHistory.filter(m => m.id !== "welcome_msg"), // Pass clean history
          contextSubject: session.title,
          contextSummary: session.summary + "\n\nTranscript: " + (session.transcript || "")
        })
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Communication failure");
      }

      const resJson = await response.json();

      const newModelMsg: ChatMessage = {
        id: "ai_" + Date.now().toString(36),
        role: "model",
        content: resJson.content,
        timestamp: new Date().toISOString()
      };

      onUpdateChatHistory([...stagedHistory, newModelMsg]);

    } catch (err: any) {
      console.error("Buddy Chat Error:", err);
      setChatError(err.message || "Failed to converse. Is your GEMINI_API_KEY configured?");
    } finally {
      setIsSending(false);
    }
  };

  const handlePresetPrompt = (promptText: string) => {
    handleSend(promptText);
  };

  const presetChips = [
    { label: "❓ Evaluar Acuerdos", prompt: "Hazme una pregunta de opción múltiple sobre los acuerdos tomados en esta reunión para validar el entendimiento." },
    { label: "🎓 Simplificar Temas", prompt: "Explica el punto de discusión más complejo de esta reunión en palabras muy sencillas." },
    { label: "⚡ 3 Puntos Clave", prompt: "Resume los acuerdos de esta reunión en exactamente 3 viñetas de acciones clave." }
  ];

  const clearChat = () => {
    const welcome = [
      {
        id: "welcome_msg",
        role: "model" as const,
        content: `¡Hola! He reiniciado nuestro diálogo. Estoy listo para responder cualquier duda sobre la reunión "${session.title}". Haz una pregunta o selecciona una opción de acceso rápido.`,
        timestamp: new Date().toISOString()
      }
    ];
    onUpdateChatHistory(welcome);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm" id="chatbot-buddy-component">
      {/* Sidebar header */}
      <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-indigo-50/10 to-teal-50/10 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-indigo-500 animate-pulse" />
          <div>
            <h3 className="font-sans text-sm font-bold text-slate-800">Asistente de IA</h3>
            <p className="font-sans text-[10px] text-slate-400">Pregunta dudas, acuerdos o resúmenes</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-1.5 rounded-lg border border-slate-150 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
          title="Reset Study Chat"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages console scroll list */}
      <div 
        ref={listRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[380px] min-h-[280px]"
      >
        {session.chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <span className="font-sans text-[10px] font-bold text-slate-400">
                {msg.role === "user" ? "Tú" : "Asistente de IA"}
              </span>
              <span className="font-mono text-[8px] text-slate-350 text-slate-400">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            
            <div
              className={`rounded-2xl px-4 py-2.5 max-w-[88%] text-xs leading-relaxed font-sans ${
                msg.role === "user"
                  ? "bg-slate-900 text-white rounded-tr-xs"
                  : "bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-xs whitespace-pre-line"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex flex-col items-start animate-pulse">
            <span className="font-sans text-[10px] font-bold text-slate-400 mb-1">El asistente está procesando...</span>
            <div className="rounded-2xl rounded-tl-xs bg-slate-50 p-4 border border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-550 text-indigo-500" />
              Escribiendo respuesta...
            </div>
          </div>
        )}

        {chatError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 flex flex-col gap-1">
            <div className="font-bold flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              Chat Obstacle
            </div>
            <p>{chatError}</p>
          </div>
        )}
      </div>

      {/* Touch prompt chips */}
      <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-1.5 overflow-x-auto">
        {presetChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handlePresetPrompt(chip.prompt)}
            disabled={isSending}
            className="text-[10px] font-medium bg-white hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 text-slate-600 rounded-full py-1 px-2.5 transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input element controls */}
      <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(inputMsg)}
            placeholder="Pregunta algo sobre la reunión..."
            disabled={isSending}
            className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-100 disabled:bg-slate-100 text-slate-700 transition"
            id="chat-input-box"
          />
          <button
            onClick={() => handleSend(inputMsg)}
            disabled={!inputMsg.trim() || isSending}
            className="h-8.5 w-8.5 rounded-xl bg-slate-900 border border-slate-900 text-white flex items-center justify-center hover:bg-indigo-6500 hover:bg-indigo-600 disabled:bg-slate-100 disabled:border-slate-150 disabled:text-slate-400 transition active:scale-95 shrink-0"
            title="Send message"
            id="chat-send-bin"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
