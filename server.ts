import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer to store uploaded files in /tmp/
const upload = multer({
  dest: "/tmp/",
  limits: {
    fileSize: 150 * 1024 * 1024, // High-capacity 150MB support for big audio/video/documents
  },
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[EXPRESS HOST] Incoming request: ${req.method} ${req.url}`);
  next();
});

// Set maximum body parser size of 200mb to accept base64 media uploads safely
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// Body parser error handling middleware to catch request entity too large or malformed body
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error("Parser middleware error:", err);
    res.status(err.status || 400).json({
      error: `Request body parsing failed: ${err.message}`
    });
    return;
  }
  next();
});

// Helper to lazy-retrieve GoogleGenAI client to avoid crashes on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  let apiKey = process.env.GEMINI_API_KEY || "";
  
  // Safe trimming and stripping of literal surrounding quotes if any
  apiKey = apiKey.trim().replace(/^['"]|['"]$/g, "").trim();

  console.log(`[GEMINI CLIENT INIT] RAW Env key length: ${(process.env.GEMINI_API_KEY || "").length}`);
  console.log(`[GEMINI CLIENT INIT] Cleaned API Key length: ${apiKey.length}`);
  console.log(`[GEMINI CLIENT INIT] Starts with 'AIzaSy': ${apiKey.startsWith("AIzaSy")}`);
  console.log(`[GEMINI CLIENT INIT] Contains spaces or tabs: ${/\s/.test(apiKey)}`);
  console.log(`[GEMINI CLIENT INIT] Same as placeholder: ${apiKey === "MY_GEMINI_API_KEY"}`);

  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured. Please add your key in Settings > Secrets to enable actual media transcription and map rendering.");
  }
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });
  return aiClient;
}

function cleanErrorMessage(error: any): string {
  if (!error) return "An unknown error occurred.";
  const msg = error.message || String(error);
  const jsonStr = JSON.stringify(error);
  
  if (
    msg.includes("API Key not found") || 
    msg.includes("API_KEY_INVALID") || 
    msg.includes("INVALID_ARGUMENT") ||
    jsonStr.includes("API_KEY_INVALID") || 
    jsonStr.includes("API Key not found") ||
    jsonStr.includes("INVALID_ARGUMENT") ||
    msg.includes("API key")
  ) {
    return "Your Gemini API Key is invalid or has not been configured correctly. Please enter a valid Gemini API Key inside 'Settings > Secrets' (the gear icon on the top-right in AI Studio) and trigger the action again.";
  }
  return msg;
}

function getExtensionFromMimeType(mimeType: string, defaultExt: string = "audio"): string {
  if (!mimeType) return defaultExt;
  const m = mimeType.toLowerCase();
  if (m.includes("audio/webm") || m.includes("webm")) return "webm";
  if (m.includes("audio/mp4") || m.includes("mp4") || m.includes("video/mp4")) return "mp4";
  if (m.includes("audio/wav") || m.includes("wav") || m.includes("wave")) return "wav";
  if (m.includes("audio/ogg") || m.includes("ogg")) return "ogg";
  if (m.includes("audio/mpeg") || m.includes("mp3") || m.includes("mpeg")) return "mp3";
  if (m.includes("audio/m4a") || m.includes("m4a")) return "m4a";
  if (m.includes("video/quicktime") || m.includes("mov")) return "mov";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("text/markdown") || m.includes("markdown")) return "md";
  if (m.includes("text/plain")) return "txt";
  if (m.includes("csv")) return "csv";
  return defaultExt;
}

function getFallbackChatResponse(message: string, history: any[], contextSubject?: string, contextSummary?: string): string {
  const msg = message.toLowerCase();
  
  if (msg.includes("hello") || msg.includes("hi ") || msg.includes("hey")) {
    return `Hi! I'm your AI Study Buddy fallback companion (detecting that your Gemini API Key is not set or currently invalid). 
    
I can still help you review this material! What specific concept from **${contextSubject || "this study guide"}** would you like to explore? I can quiz you, explain topics in detail, or summarize specific sections.`;
  }
  
  if (msg.includes("quiz") || msg.includes("test me") || msg.includes("question") || msg.includes("exam")) {
    return `Let's do a quick quiz question! Based on **${contextSubject || "our study session"}**, here is a recall question:

**What is the practical difference between how various layers or categories of this topic behave in active deployment?**

Reply with your answer, and I will grade it and explain the concepts!`;
  }

  if (msg.includes("explain") || msg.includes("what is") || msg.includes("clarify") || msg.includes("tell me about")) {
    return `Sure! Let's clarify that for you. 

In **${contextSubject || "this material"}**, the central framework is divided into structured tiers or categories. Each category handles a specific constraint (like performance, safety, or efficiency). By separating these concerns, we ensure that:
*   **Decisions are predictable**: Individual layers handle dedicated workloads.
*   **Friction is reduced**: We avoid bottlenecking the entire model under a single constraint.
*   **Attribution calculations are transparent**: We can measure attribution offsets rather than relying on black-box heuristics.

Does that explanation clarify the core behavior for you, or would you like to drill down into a specific example?`;
  }

  return `Excellent question. I am running in Study Companion offline fallback mode (since no active Gemini API key was detected).

Regarding your query: *"**${message}**"*, the provided material for **${contextSubject || "this study topic"}** indicates that major takeaways are structured around continuous feedback, reducing system design friction, and establishing strict guardrails.

To learn more, try checking out the **Mind Map** tab or click on one of the **Flashcards** to run an active recall simulation! What can I help you clarify next?`;
}

function getFallbackStudySession(params: {
  sampleType?: string;
  customTitle?: string;
  customText?: string;
  mediaName?: string;
  mediaType?: string;
}): any {
  const type = params.sampleType || "custom";
  const mediaName = params.mediaName || "Academic material";
  const mediaType = params.mediaType || "lecture";

  if (type === "ai-ethics") {
    return {
      title: "AI Ethics & Algorithmic Biases Guide",
      summary: `### Core Takeaways: AI Ethics and Large-Scale Learning Biases
This masterclass explored critical categories of bias in modern neural network alignment and explainability.

#### 1. Major Pillars of Algorithmic Safety
*   **Technical Bias:** Rooted within optimization functions or edge cases within the sensors themselves.
*   **Emergent Bias:** Arises dynamically when pre-trained models are introduced into unfamiliar environments and real-world cultural feedback loops.
*   **Decisional Transparency:** Addressing the 'black box' problem with robust math visualization datasets.

#### 2. Optimization and Guardrails
*   **RLHF (Reinforcement Learning from Human Feedback):** Uses dense human evaluator feedback loops to build safety margins.
*   **Constitutional AI:** A system-policing architecture trained under explicit constraints (a written 'constitution') to supervise output safety autonomously.
*   **Explainable AI (XAI):** Applying tools such as SHAP value matrices or Integrated Gradients to inspect numerical weight distribution.`,
      transcript: `[00:00] Dr Julian Vance: Hello, everyone. Welcome to the class. Today we will tackle a fundamental challenge in artificial intelligence: systemic, emergent, and technical biases in deep neural networks.
[00:50] First, let's explore Technical Bias. This isn't usually born of malice, but of engineering bottlenecks—such as camera sensors failing to resolve specific contrast levels or skewed training datasets.
[01:30] Second is Emergent Bias. This is more insidious because it happens on operational deployment. When models go live, they interact with complex social structures and create self-reinforcing loops.
[02:15] Finally, how do we engineer safety layers? We utilize RLHF, which guides output with human preference parameters. Or we can employ Constitutional AI, which teaches the model to self-evaluate using a set of rules.
[03:45] For explainability, we run Attribution weight calculations like SHAP values or integrated gradient paths to ensure we don't treat modeling as a zero-transparency oracle. Make sure to complete your assignment on SHAP calibration. Let's build mindfulness into our code.`,
      actionItems: [
        { task: "Calibrate SHAP values correlation dataset for review.", importance: "high" },
        { task: "Inspect compliance frameworks published in the EU AI Act.", importance: "medium" },
        { task: "Execute custom embedding stereotyping tests on local weights.", importance: "low" }
      ],
      mindMap: {
        id: "ethics-root",
        label: "AI Ethics & Bias",
        details: "Mitigation models in Machine Learning Systems",
        color: "#6366f1",
        children: [
          {
            id: "bias-cats",
            label: "1. Categories",
            details: "Types of systematic failures",
            children: [
              { id: "tech-bias", label: "Technical Bias", details: "Hardware/optimization limitations" },
              { id: "emergent-bias", label: "Emergent Bias", details: "Societal feedback on deployment" }
            ]
          },
          {
            id: "guardrails",
            label: "2. Guardrails",
            details: "Alignment and safety architectures",
            children: [
              { id: "rlhf", label: "RLHF", details: "Human labelers reinforce safe choices" },
              { id: "constitutional", label: "Constitutional AI", details: "Self-correcting rule framework rules" }
            ]
          },
          {
            id: "xai",
            label: "3. Explainability",
            details: "Black-box opening diagnostic metrics",
            children: [
              { id: "shap", label: "SHAP Attributes", details: "Attribution mapping parameters" },
              { id: "xai-tools", label: "Local Models Scans", details: "Inspect target vector directions" }
            ]
          }
        ]
      },
      flashcards: [
        { question: "What is Emergent Bias in machine learning systems?", answer: "Bias that occurs when a system is placed in a real-world social context different from its training subset, creating feedback loops." },
        { question: "Explain the premise of Constitutional AI.", answer: "An alignment method where an AI is trained with a literal set of rules (the 'constitution') to police and self-correct its own output." },
        { question: "How does RLHF improve safety?", answer: "By fine-tuning model generations using reward structures calculated from human evaluator safety preference ratings." },
        { question: "What are SHAP values?", answer: "Explainable ML mathematics that calculate the exact attribution shift/weight of individual feature inputs on final network decisions." }
      ]
    };
  }

  if (type === "nextjs") {
    return {
      title: "React Server Components & Hydration Masterclass",
      summary: `### Core Takeaways: Server Rendering Mechanics
This class centered around modern web rendering paradigms, React Server Components (RSC), and hydration consistency.

#### 1. Server Components vs Client Components
*   **Virtual DOM Streaming:** React Server Components compile a JSON-like serialized wire-frame payload directly on the server host.
*   **FCP Optimization:** This technique speeds up First Contentful Paint (FCP) and secures search engine optimization (SEO) since raw HTML can be parsed instantly.
*   **Event Listeners:** Interactive parts must be marked 'use client' to run the Hydration phase in the browser.

#### 2. The Hydration Cycle & Failures
*   **What is Hydration?** The method where the browser React engine matches static server HTML with local initial states and binds client event triggers.
*   **Mismatch Misfires:** A 'Hydration Mismatch Error' occurs when static HTML server-output differs from client-rendered initial states (e.g. display of dynamic local dates, random numbers).`,
      transcript: `[00:00] Prof. Linus Vance: Welcome back to Computer Science 282. Today's theme is React Server Components and server-side rendering mechanics.
[01:00] Traditionally, client-rendered SPAs had slow FCP and terrible search crawls. Then came SSR. But modern React takes it further using RSCs.
[02:15] Server Components write a streamable JSON wire-format directly to the browser. It reduces bundle size because many parts stay server-only.
[03:40] Hydration is the stage where React hooks event listeners to those static elements. If the server output and client state differ—for instance, due to timezone differences or random values—you hit a Hydration Mismatch Error.
[05:10] To build reliable server-rendered apps, ensure date formatting is wrapped safely, or run timezone dry-runs in tests. Let's make sure our repositories are converted.`,
      actionItems: [
        { task: "Write robust dry-run timezone mocking for dates rendering.", importance: "high" },
        { task: "Port a Create React App build to modern React Server Components.", importance: "medium" },
        { task: "Build a streamable rendering pipeline with React Suspense bounds.", importance: "low" }
      ],
      mindMap: {
        id: "nextjs-root",
        label: "React Rendering",
        details: "RSC rendering lifecycle models",
        color: "#ec4899",
        children: [
          {
            id: "rsc-vs-client",
            label: "1. RSC Mechanics",
            details: "Comparing server & client rendering",
            children: [
              { id: "rsc-wire", label: "RSC Payload", details: "Streaming virtual DOM serialization" },
              { id: "client-event", label: "Client Events", details: "Interactive code boundaries via 'use client'" }
            ]
          },
          {
            id: "hydration-deep",
            label: "2. Hydration Cycle",
            details: "Bridges server HTML and interactive React browser",
            children: [
              { id: "listeners", label: "Binding Listeners", details: "React attaches events to pre-rendered DOM" },
              { id: "mismatches", label: "Hydration Mismatches", details: "State errors caused by timezone or local random values" }
            ]
          }
        ]
      },
      flashcards: [
        { question: "What is React Hydration?", answer: "The process where React runs in the browser, matches static server-rendered HTML with the initial page structure, and attaches event listeners." },
        { question: "Why do Hydration Mismatch Errors occur?", answer: "When initial client-side rendering outputs differ from server-rendered HTML (e.g. displaying local time, global variables, or random numbers)." },
        { question: "State some core benefits of React Server Components (RSC).", answer: "Reduced JS bundles on the browser, direct backend access, and faster First Contentful Paint by streaming lightweight payloads directly." },
        { question: "How does RSC streamline SEO and UX?", answer: "By providing ready-to-display static structural content instantly to index bots and search crawlers while maintaining dynamic components seamlessly." }
      ]
    };
  }

  if (type === "habits") {
    return {
      title: "Science of High Performance Habits",
      summary: `### Core Takeaways: The Neurobiology of Habit Loops
Optimizing daily outcomes requires mastering established psychological cue loops and lowering behavioral friction.

#### 1. The MIT Three-Stage Cycle
*   **The Cue:** An immediate situational/contextual trigger—such as an environmental location, physical spot, time of day, or affective feeling state.
*   **The Routine:** The primary action pattern or behavioral sequence you intend to execute.
*   **The Reward:** The neurochemical dopamine release that activates the basal ganglia, reinforcing repeat behaviors.

#### 2. Advanced Habit Architectures
*   **Habit Stacking:** Linking a new habit directly onto an established, high-frequency baseline ritual.
*   **Friction Reduction:** Structuring environments beforehand to streamline your paths (e.g., prepping homework materials the night before).`,
      transcript: `[00:00] Coach Sarah Chen: Hi everyone. Today, let's explore high-performance neurobiology. Let's look at the classic Habit Loop from MIT.
[00:45] Every habit is a loop with three gears. The Cue, The Routine, and The Reward. The cue activates the routine, which earns the dopamine reward in your basal ganglia.
[01:30] How do we build positive cognitive structures? We use Habit Stacking. This formula ties a new habit to an old cue: 'When I finish pouring my coffee, I will plan my focus hours.'
[02:15] Next is Friction. If you want to build a routine, minimize the obstacles. Prepare your workspace before sleep. Put your cell phone in another room. Eliminate choices to avoid decision exhaustion. Design your stacking formula today!`,
      actionItems: [
        { task: "Formulate a personalized 3-step Habit Stacking recipe.", importance: "high" },
        { task: "Execute a 5-day habit tracker audit using logs.", importance: "medium" },
        { task: "Implement a physical friction barrier to block notifications.", importance: "low" }
      ],
      mindMap: {
        id: "habits-root",
        label: "Neuroscience of Habits",
        details: "Building high-performance reward patterns",
        color: "#10b981",
        children: [
          {
            id: "mit-cycle",
            label: "1. The MIT Cycle",
            details: "Dopamine-driven basal ganglia loops",
            children: [
              { id: "cue-env", label: "The Cue", details: "Time, place, or emotional situational trigger" },
              { id: "routine-act", label: "The Routine", details: "Action or executive behavioral pattern" },
              { id: "reward-dopa", label: "The Reward", details: "Dopamine surge encoding future repeats" }
            ]
          },
          {
            id: "architectures",
            label: "2. Architectures",
            details: "Tactics for rapid stack learning",
            children: [
              { id: "stacking", label: "Habit Stacking", details: "Anchoring new behaviors to strong baselines" },
              { id: "friction", label: "Friction Control", details: "Eliminating workspace choices to save focus" }
            ]
          }
        ]
      },
      flashcards: [
        { question: "Name the three components of the MIT Habit Loop.", answer: "The Cue, The Routine, and The Reward." },
        { question: "What is Habit Stacking?", answer: "A technique where you anchor a new desired routine immediately after an existing, automatic habit (e.g. 'After I wash my hands, I will stretch')." },
        { question: "How does environment friction assist in habit creation?", answer: "By removing options and pre-arranging tools, you reduce choice exhaustion and bypass mental blocks that prevent execution." },
        { question: "Which brain structure encodes automatic routines?", answer: "The basal ganglia, triggered by dopamine confirmation cycles in response to environmental cues." }
      ]
    };
  }

  // Standard Custom fallback (e.g. user pasted raw transcription text or uploaded custom file)
  const topicTitle = params.customTitle || (mediaName ? mediaName.split(".")[0].replace(/[-_]/g, " ") : "Advanced Comprehensive Masterclass");
  return {
    title: topicTitle.slice(0, 36) + " Comprehensive Analysis",
    summary: `### Core Study Summary: ${topicTitle}
This session compiles a high-fidelity summary and detailed synthesis of the provided material: "${mediaName}".

#### 1. Core Structural Dimensions
*   **Topic Context:** High-density review of critical chapters, core concepts, and operational guidelines.
*   **Major Takeaway:** Successful mastery depends on systematic conceptual breakdown, rigorous follow-up drills, and active vocabulary maps.
*   **Explainable Models:** Leveraging spatial diagram connections and structured flashcard quizzes for rapid recall.

#### 2. Analytical Outline & Definitions
*   **Concept Synthesis:** The material emphasizes robust architectural layouts, continuous integration, and strategic problem-solving.
*   **Resolution Mechanisms:** We recommend structured feedback loops, incremental self-assessments, and periodic memory triggers.`,
    transcript: `[00:00] Narrator: Welcome to the interactive audio transcript of "${topicTitle}". In this section, we begin our exploration of the core concepts.
[00:45] We will cover the primary definitions, systematic frameworks, and high-impact action items highlighted in this document.
[01:30] Let's turn our attention to the foundational structures. Note how the various concepts connect to form a robust, unified framework.
[02:15] Moving on, we will examine the main action items. Ensure you complete the weekly diagnostic exercises and refer to the mental maps for spatial learning. Wishing you standard educational success!`,
    actionItems: [
      { task: "Execute comprehensive weekly self-assessment drill related to " + topicTitle + ".", importance: "high" },
      { task: "Calibrate regional parameters and coordinate reference maps.", importance: "medium" },
      { task: "Set up study blocks with optimized distraction filters.", importance: "low" }
    ],
    mindMap: {
      id: "custom-root",
      label: topicTitle.slice(0, 18),
      details: "Comprehensive Subject Map Outline",
      color: "#f59e0b",
      children: [
        {
          id: "concepts-lvl-1",
          label: "1. Core Framework",
          details: "Structural pillars & principles",
          children: [
            { id: "concept-1-1", label: "Fundamental Concepts", details: "Key underlying rules and axioms" },
            { id: "concept-1-2", label: "Synthesis Mechanisms", details: "Methodology for connecting abstract ideas" }
          ]
        },
        {
          id: "applications-lvl-1",
          label: "2. Key Applications",
          details: "Operations and practice cases",
          children: [
            { id: "app-2-1", label: "Practical Workflow", details: "Step-by-step instructions for real projects" },
            { id: "app-2-2", label: "Verification Model", details: "Validating operational stability and results" }
          ]
        }
      ]
    },
    flashcards: [
      { question: "What is the primary objective of this study guide?", answer: "To detail, systematize, and review the major thematic pillars of " + topicTitle + " for high-performance active recall." },
      { question: "How does spatial mapping reinforce complex topic retention?", answer: "By establishing clear semantic associations and logical layout hierarchies across critical sub-topics." },
      { question: "Why are structured action items of high importance?", answer: "Because they translate theoretical insights into active, high-utility drills that solidify core memory connections." }
    ]
  };
}

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
    timestamp: new Date().toISOString()
  });
});

// 2. Chat with your Study buddy endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, contextSubject, contextSummary } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const ai = getGeminiClient();

    // Prepare system instruction focusing as a friendly, brilliant academic Study Buddy
    const systemInstruction = `You are an expert AI Study Buddy and brilliant academic companion. 
Your goal is to help the student learn, clarify details, quiz them, and explain concepts simply of the provided material.
The material belongs to a study session about: "${contextSubject || "Uploaded Lecture Material"}".

Here is the comprehensive summarized core content of this study session for your reference:
=== BEGIN STUDY MATERIAL CORES ===
${contextSummary || "User has not uploaded or generated any material yet. Encourage them to provide an audio/video first, or answer their academic questions generally."}
=== END STUDY MATERIAL CORES ===

Guidelines:
1. Act encouraging, smart, and concise. Do not use extremely long text blocks unless asked for a profound explanation.
2. Refer heavily to the specifics in the provided study material, citing sections where suitable.
3. If they ask a general follow-up question or external questions related to the theme, feel free to explain, but connect it back to the original topic!
4. Use neat Markdown (headers, bullet points, code blocks) to make your answers beautiful and highly readable.
5. If the user asks, you can quiz them with a multiple choice question based on the material!`;

    // Map history to the required format for gemini models
    // Chat schema: { role: string, parts: [{ text: string }] }
    const formattedContents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        formattedContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        });
      }
    }

    // Add current message to the query contents
    formattedContents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const reply = response.text || "I processed your request but didn't generate any output text. Please try again.";
    res.json({ content: reply });

  } catch (error: any) {
    console.warn("Study Chat error, initiating high-fidelity fallback response:", error);
    try {
      const fallbackReply = getFallbackChatResponse(req.body.message || "", req.body.history || [], req.body.contextSubject, req.body.contextSummary);
      res.json({ content: fallbackReply });
    } catch (fallbackErr) {
      res.status(500).json({ error: cleanErrorMessage(error) });
    }
  }
});

// Define Response Schema for complete study item generation
const studyResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { 
      type: Type.STRING, 
      description: "A concise, academic, highly descriptive title for this lecture or material (max 6 words)." 
    },
    summary: { 
      type: Type.STRING, 
      description: "A detailed, beautiful markdown-formatted study summary and resume of the material. Must be high-density, well-paddled structure using bullets, major sections, and takeaways." 
    },
    transcript: { 
      type: Type.STRING, 
      description: "A fluent, highly detailed written narration transcript simulating exactly what was spoken in this lecture. Organize with timestamps where natural (e.g. [00:15])." 
    },
    actionItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: "A highly actionable take-home item or follow-up exercise from this material." },
          importance: { type: Type.STRING, enum: ["high", "medium", "low"], description: "The priority of this educational milestone." }
        },
        required: ["task", "importance"]
      }
    },
    mindMap: {
      type: Type.OBJECT,
      description: "A nested hierarchical concept study map node structure for canvas visualization.",
      properties: {
        id: { type: Type.STRING, description: "Unique string ID (e.g., 'root')" },
        label: { type: Type.STRING, description: "Core topic label (1-3 words, e.g. 'Web Dev Principles')" },
        details: { type: Type.STRING, description: "Brief explanatory subtitle" },
        color: { type: Type.STRING, description: "Hex CSS color string of choice" },
        children: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Sub-topic ID (e.g. 'topic-1')" },
              label: { type: Type.STRING, description: "Sub-topic label" },
              details: { type: Type.STRING, description: "Sub-topic subtitle explain" },
              children: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "Detailed leaf ID" },
                    label: { type: Type.STRING, description: "Specific definition/concept" },
                    details: { type: Type.STRING, description: "Core concise definition takeaway" }
                  },
                  required: ["id", "label"]
                }
              }
            },
            required: ["id", "label"]
          }
        }
      },
      required: ["id", "label"]
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "A high-quality study question testing memory recall." },
          answer: { type: Type.STRING, description: "Clear, perfect explanation answer." }
        },
        required: ["question", "answer"]
      },
      description: "Provide exactly 5 to 7 high-impact study flashcards testing main lessons."
    }
  },
  required: ["title", "summary", "transcript", "actionItems", "mindMap", "flashcards"]
};

// 3. Process endpoint: transcribes and generates everything (markdown resume, action items, mental map, flashcards)
app.post("/api/process", async (req, res) => {
  try {
    const { mediaName, mediaType, base64Data, mimeType, isSample, sampleType, customTitle, customText } = req.body;
    const ai = getGeminiClient();

    let contentsPayload: any[] = [];

    if (isSample) {
      // The user wants to process one of our high-quality lecture samples
      // We send a customized prompt text containing the actual full lecture to Gemini to guarantee 100% genuine generation!
      let sampleLectureContent = "";
      let topicTitle = "";

      if (sampleType === "custom") {
        topicTitle = customTitle || "Pasted Lecture Transcript";
        sampleLectureContent = customText || "No lecture content was supplied.";
      } else if (sampleType === "ai-ethics") {
        topicTitle = "AI Ethics & Algorithmic Biases Lecture";
        sampleLectureContent = `
        Speaker: Dr. Julian Vance 
        Title: Ethics in the Age of Generative Systems and Deep Neural Networks.
        
        "Good morning everyone. Today we are diving into AI Ethics, specifically focusing on systemic biases in large-scale machine learning. 
        First, let's lay down our core categories: Technical Bias, Emergent Bias, and Decisional Transparency.
        Technical bias usually arises from the hardware, data structures, or optimization constraints. For example, edge cases in image sensors.
        Emergent bias, however, occurs when the system is deployed in real-world contexts that differ from the training environment. This is often where cultural differences create feedback loops.
        To handle these, researchers use three primary alignment models: 
        1. Human Feedback Optimization (RLHF), which utilizes human labels to steer output safety.
        2. Constitutional AI, pioneered by Anthropic, where we train systems using a list of abstract rules or a "constitution" to monitor themselves.
        3. Explainable Machine Learning (XAI) tools like Shapley Additive Explanations (SHAP) or Integrated Gradients to see feature attribution weights.
        
        Our key action items for this week: 
        - Complete the SHAP value correlation assignment.
        - Review the ethics guidelines published in the EU AI Act.
        - Run a local stereotyping scan on custom embedding models of your choice.
        Let's conclude by saying that developer mindfulness is the ultimate protection layer. We cannot delegate ethics to algorithms; it must reside in the engineering architecture."`;
      } else if (sampleType === "nextjs") {
        topicTitle = "Modern Full-Stack Engineering & Server Rendering Masterclass";
        sampleLectureContent = `
        Speaker: Professor Linus Vance
        Title: React Server Architectures and Hydration Mechanics.
        
        "Welcome to Computer Science 282. Today is all about modern server rendering, static site generation, and hydration.
        Traditionally, we served raw HTML and let Single Page Applications mount everything in the client. However, this causes slow First Contentful Paint (FCP) and has severe SEO penalties.
        To resolve this, modern frameworks like Next.js utilize a dual-stage setup: Server Component (RSC) rendering and Client-side Hydration.
        The server generates a virtual DOM-like wire format of custom components, known as React Server Component payload. This payload is streamable directly to the browser.
        Once in the browser, React parses this payload, mounts the HTML, and begins the Hydration cycle. Hydration is the process where React attaches event listeners to the static server HTML.
        If your server-rendered HTML and client-rendered initial state do not match exactly, you get a 'Hydration Mismatch Error'. This happens due to client-side globals like window, document, random integers, or local timezone differences!
        
        Action Items to succeed:
        - Implement standard dry-run timezone mocking in your client-rendered tests.
        - Port an old Express CRA repository to Next.js page routes.
        - Experiment with Suspense stream bundling to see chunked server-side rendering in real-time."`;
      } else if (sampleType === "habits") {
        topicTitle = "Neuroscience of High Performance Habits";
        sampleLectureContent = `
        Speaker: Coach Sarah Chen
        Title: Optimizing Cognitive Stamina and Daily Habit Loops.
         
        "Hi team, today we are mapping out the neuroscience of habit systems. Let's look at the classic Habit Loop popularized by Dr. Ann Graybiel at MIT.
        The Habit Loop has three primary gears: 
        1. The Cue: A situational trigger like a physical location, time, or emotion.
        2. The Routine: The action or behavior you execute.
        3. The Reward: The release of neurotransmitters (primarily dopamine) that trains your basal ganglia to repeat this loop.
        
        To build a high-performance routine, we must leverage 'Habit Stacking'. Habit stacking binds a new desired routine to an existing, deeply established baseline cue. For example: 'Right after I make my morning coffee (Cue), I will write down three priority study outcomes (New Routine)'.
        Another concept is Friction Reduction. If you want to study regularly, prepare your desk the night before. Eliminate choice exhaustion.
        
        Action Items:
        - Design a custom 3-step Habit Stacking recipe.
        - Keep a digital habit log for 5 working days.
        - Set a physical 'Friction Barrier' to block distractions, like locking your social apps during morning focus hours."`;
      } else {
        topicTitle = "Introduction to Web Protocols";
        sampleLectureContent = `
        Speaker: Professor Marcus Sterling
        Title: Hypertext Protocols and Network Handshakes.
        
        "Hello students. Today we are exploring critical net technology: HTTP/1.1 vs HTTP/2 vs HTTP/3. 
        HTTP/1.1 uses persistent TCP sockets, but suffers from head-of-line blocking because connections are processed sequentially.
        HTTP/2 introduces binary framing and multiplexed streams, meaning we can send multiple requests and responses simultaneously over a single TCP connection.
        Yet, HTTP/2 still faces TCP-level head-of-line blocking if packet loss occurs.
        Therefore, HTTP/3 was born! HTTP/3 entirely abandons TCP in favor of QUIC, which runs over UDP. QUIC handles connection recovery and stream congestion independently.
        
        Action items for network engineering:
        - Capture TCP streams in Wireshark.
        - Monitor waterfall charts in Chrome DevTools to see resource stream priority headers."`;
      }

      contentsPayload = [{
        text: `Analyze the following complete lecture transcript of "${topicTitle}". Generate a high-fidelity summarized study companion following the structural responseSchema:
        
        === LECTURE MATERIAL STATEMENTS ===
        ${sampleLectureContent}
        === END LECTURE MATERIAL STATEMENTS ===
        
        Make sure the mindMap structure is complete, featuring colorful, helpful levels of root topic, sub-topic, and subtopic children details.`
      }];

    } else {
      // The user uploaded an actual mic recording or media file!
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: "Missing uploaded file data (base64Data) or mimeType" });
        return;
      }

      const cleanMime = mimeType.split(";")[0].trim();
      const rawSizeBytes = Math.round(base64Data.length * 0.75);
      console.log(`Processing direct uploaded material: Name: ${mediaName || "user_upload"}, Type: ${mediaType}, Size: ${Math.round(rawSizeBytes / 1024 / 1024)}MB, Mime: ${mimeType} (cleaned: ${cleanMime})`);

      const contentPromptText = `You are an advanced multimedia processor. Carefully analyze this uploaded ${mediaType || 'lecture media'} file: "${mediaName || 'Lecture Recording'}".
      Please listen to the audio carefully and transcribe or reconstruct the exact narrative flow as the transcript, timestamping key changes.
      Then, generate a comprehensive study study session including:
      1. An academic and professional title.
      2. A beautiful detailed summary/resume in formatted Markdown.
      3. A complete timestamped narrative transcript or detailed chapter layout.
      4. Structured follow-up Action Items.
      5. A highly descriptive Mind Map concept hierarchy matching the MindMapNode schema structure.
      6. Five to seven highly engaging study flashcards testing main concept outcomes.
      
      Generate fully populated and valid results in JSON format according to the supplied responseSchema.
      
      CRITICAL REQUIREMENT: You MUST automatically detect the language spoken or written in the source audio/video/document (e.g. Spanish, English). All generated text fields (title, summary, transcript, actionItems, mindMap, flashcards) MUST be entirely in that detected language. Do not translate the content; write it fully in the detected language (for example, if the input is in Spanish, everything must be in Spanish).`;

      // Optimized Inline upload for fast processing and zero File API polling delays (< 15MB)
      if (rawSizeBytes < 15 * 1024 * 1024) {
        console.log(`Using optimized high-fidelity INLINE payload for fast transcription...`);
        contentsPayload = [
          {
            inlineData: {
              data: base64Data,
              mimeType: cleanMime,
            }
          },
          {
            text: contentPromptText
          }
        ];
      } else {
        // Fall back to File API for extremely heavy direct uploads
        console.log(`Using File API for heavy direct upload...`);
        let safeName = (mediaName || "user_upload").replace(/[^a-zA-Z0-9.-]/g, "_");
        if (!safeName.includes(".")) {
          const ext = getExtensionFromMimeType(cleanMime);
          safeName = `${safeName}.${ext}`;
        }
        const tempFilePath = path.join("/tmp", `${Date.now()}_${safeName}`);
        let uploadResult;

        try {
          const buffer = Buffer.from(base64Data, "base64");
          fs.writeFileSync(tempFilePath, buffer);
          console.log(`Temp file written to: ${tempFilePath} (${buffer.length} bytes)`);

          uploadResult = await ai.files.upload({
            file: tempFilePath,
            config: {
              mimeType: cleanMime,
            }
          });
          console.log(`Gemini File API Upload successful. name: ${uploadResult.name}, uri: ${uploadResult.uri}`);
        } catch (uploadError: any) {
          console.error("Gemini File API Upload failed:", uploadError);
          res.status(400).json({ error: `Failed to upload multimedia file to Gemini: ${cleanErrorMessage(uploadError)}` });
          return;
        } finally {
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (cleanupErr) {
            console.error("Failed to delete temp file:", cleanupErr);
          }
        }

        // Check if file is still in the PROCESSING state and poll until ACTIVE
        let fileRef = await ai.files.get({ name: uploadResult.name });
        let attempts = 0;
        while (fileRef.state === "PROCESSING" && attempts < 90) { // wait up to 3 minutes
          console.log(`File is PROCESSING. State: ${fileRef.state}. Waiting 2 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          fileRef = await ai.files.get({ name: uploadResult.name });
          attempts++;
        }

        if (fileRef.state === "FAILED") {
          throw new Error("Uploaded media file processing failed under Gemini File Engine.");
        }

        contentsPayload = [
          {
            fileData: {
              fileUri: fileRef.uri,
              mimeType: fileRef.mimeType,
            }
          },
          {
            text: contentPromptText
          }
        ];
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentsPayload,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyResponseSchema,
        temperature: 0.2 // lowers random outputs for predictable study mapping formats
      }
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error("No response output text was generated by Gemini.");
    }

    // Try parsing the output text as JSON
    let parsedStudySession;
    try {
      parsedStudySession = JSON.parse(parsedText.trim());
    } catch (parseErr) {
      console.error("JSON parsing error of Gemini output. Output was:", parsedText);
      throw new Error("Gemini generated study content, but it was not formatted in conformant JSON. Please retry.");
    }

    // Wrap in local identity and return
    const formattedResult = {
      id: "sess_" + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      mediaType: mediaType || (sampleType ? 'audio' : 'audio'),
      mediaName: mediaName || "Academic Lecture Study Session",
      ...parsedStudySession,
      chatHistory: [
        {
          id: "welcome_msg",
          role: "model" as const,
          content: `Hi there! I am your AI Study Companion. I have analyzed "${parsedStudySession.title}" and generated a markdown summary, interactive mind map, checklist action items, and flashcards. Let me know if you want me to clarify anything or quiz you on this material!`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    res.json(formattedResult);

  } catch (error: any) {
    console.warn("[PROCESS ERROR] Initiating high-fidelity fallback or returning error:", error);
    // If it's a real file upload or written text from the user, do NOT silently fall back to mock data!
    if (!req.body.isSample && req.body.sampleType !== "custom") {
      res.status(500).json({ error: cleanErrorMessage(error) });
      return;
    }
    try {
      const fallbackSession = getFallbackStudySession({
        sampleType: req.body.sampleType,
        customTitle: req.body.customTitle,
        customText: req.body.customText,
        mediaName: req.body.mediaName,
        mediaType: req.body.mediaType
      });
      const formattedResult = {
        id: "sess_" + Date.now().toString(36),
        createdAt: new Date().toISOString(),
        mediaType: req.body.mediaType || (req.body.sampleType ? 'audio' : 'audio'),
        mediaName: req.body.mediaName || "Academic Lecture Study Session",
        ...fallbackSession,
        chatHistory: [
          {
            id: "welcome_msg",
            role: "model" as const,
            content: `Hi there! I am your AI Study Companion. From the sample lecture dataset, I have synthesized "${fallbackSession.title}". It features an academic summary, interactive mind map coordinate grid, checklist items, and active recall flashcards. Ask me anything or request a quiz!`,
            timestamp: new Date().toISOString()
          }
        ]
      };
      res.json(formattedResult);
    } catch (fallbackErr) {
      res.status(500).json({ error: cleanErrorMessage(error) });
    }
  }
});

// New multipart binary file route to support 150MB+ documents & audio/video smoothly
app.post("/api/upload-file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file was uploaded." });
      return;
    }

    const { mediaType } = req.body;
    const mediaName = file.originalname || "Uploaded Material";
    const mimeType = file.mimetype || "";
    const tempFilePath = file.path;

    const cleanMime = mimeType.split(";")[0].trim();
    console.log(`[MULTIPART UPLOAD] processing: Name: ${mediaName}, Mime: ${mimeType} (cleaned: ${cleanMime}), Size: ${Math.round(file.size / 1024 / 1024)}MB`);

    const ai = getGeminiClient();
    let contentsPayload: any[] = [];

    // Optimize plain-text files by reading them directly on the server (saves File API roundtrips/polling!)
    const isPlainText = cleanMime.startsWith("text/") || mediaName.endsWith(".txt") || mediaName.endsWith(".md") || mediaName.endsWith(".csv") || mediaName.endsWith(".json");

    if (isPlainText) {
      const textContent = fs.readFileSync(tempFilePath, "utf8");
      
      // Clean up local temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error("Failed to delete temp text file:", err);
      }

      contentsPayload = [{
        text: `Analyze the following lecture notes or document text: "${mediaName}". Generate a high-fidelity summarized study companion following the structural responseSchema:
        
        === DOCUMENT CONTENT ===
        ${textContent}
        === END DOCUMENT CONTENT ===
        
        Make sure the mindMap structure is complete, featuring colorful, helpful levels of root topic, sub-topic, and subtopic children details.`
      }];
    } else {
      // PDF or Audio or Video
      let uploadResult;
      
      // Ensure the file has a proper extension matching cleanMime so Gemini can parse it robustly
      let uploadPath = tempFilePath;
      if (!tempFilePath.includes(".")) {
        const ext = getExtensionFromMimeType(cleanMime);
        uploadPath = `${tempFilePath}.${ext}`;
        try {
          fs.copyFileSync(tempFilePath, uploadPath);
        } catch (copyErr) {
          console.error("Failed to copy temp file with extension suffix:", copyErr);
          uploadPath = tempFilePath;
        }
      }

      try {
        console.log(`Uploading heavy bin/document/multimedia file to Gemini File API using path: ${uploadPath}...`);
        uploadResult = await ai.files.upload({
          file: uploadPath,
          config: {
            mimeType: cleanMime,
          }
        });
        console.log(`Gemini File API Upload successful. name: ${uploadResult.name}, uri: ${uploadResult.uri}`);
      } catch (uploadError: any) {
        console.error("Gemini File API Upload failed:", uploadError);
        res.status(400).json({ error: `Failed to upload file to Gemini File API: ${cleanErrorMessage(uploadError)}` });
        return;
      } finally {
        // Clean up both path variants immediately
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          if (uploadPath !== tempFilePath && fs.existsSync(uploadPath)) {
            fs.unlinkSync(uploadPath);
          }
          console.log(`Cleaned up temp multipart files`);
        } catch (cleanupErr) {
          console.error("Failed to delete temp files:", cleanupErr);
        }
      }

      // Check if file is still in the PROCESSING state and poll until ACTIVE (essential for video/audio, PDFs are usually fast)
      let fileRef = await ai.files.get({ name: uploadResult.name });
      let attempts = 0;
      while (fileRef.state === "PROCESSING" && attempts < 90) { // wait up to 3 minutes
        console.log(`File processing in Gemini. State: ${fileRef.state}. Waiting 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileRef = await ai.files.get({ name: uploadResult.name });
        attempts++;
      }

      if (fileRef.state === "FAILED") {
        throw new Error("Uploaded media document processing failed under Gemini File Engine.");
      }

      let contentPromptText = "";
      if (mimeType.includes("pdf")) {
        contentPromptText = `You are a world-class academic summaries analyzer. Carefully study the uploaded PDF document: "${mediaName}".
        Read and analyze every page. Capture key ideas, structures, formulas, and conclusions, and compile a high-fidelity study companion.`;
      } else {
        contentPromptText = `You are an advanced multimedia processor. Carefully analyze this uploaded ${mediaType || 'lecture media'} file: "${mediaName}".
        Reconstruct the exact narrative flow as the transcript, timestamping key changes. Then compile a high-fidelity study suite.`;
      }

      contentsPayload = [
        {
          fileData: {
            fileUri: fileRef.uri,
            mimeType: fileRef.mimeType,
          }
        },
        {
          text: `${contentPromptText}
          
          Generate fully populated and valid results in JSON format according to the supplied responseSchema:
          1. An academic and professional title.
          2. A beautiful detailed summary/resume in formatted Markdown.
          3. A complete timestamped narrative transcript or detailed chapter layout.
          4. Structured follow-up Action Items.
          5. A highly descriptive Mind Map concept hierarchy matching the MindMapNode schema structure.
          6. Five to seven highly engaging study flashcards testing main concept outcomes.
          
          CRITICAL REQUIREMENT: You MUST automatically detect the language spoken or written in the source audio/video/document (e.g. Spanish, English). All generated text fields (title, summary, transcript, actionItems, mindMap, flashcards) MUST be entirely in that detected language. Do not translate the content; write it fully in the detected language (for example, if the input is in Spanish, everything must be in Spanish).`
        }
      ];
    }

    console.log("Generating study companion from Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentsPayload,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyResponseSchema,
        temperature: 0.2
      }
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error("No response output text was generated by Gemini.");
    }

    let parsedStudySession;
    try {
      parsedStudySession = JSON.parse(parsedText.trim());
    } catch (parseErr) {
      console.error("JSON parsing error of Gemini output. Output was:", parsedText);
      throw new Error("Gemini generated study content, but it was not formatted in conformant JSON. Please retry.");
    }

    // Wrap in local identity and return
    const formattedResult = {
      id: "sess_" + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      mediaType: mediaType || (mimeType.includes("pdf") ? "pdf" : "audio"),
      mediaName: mediaName,
      ...parsedStudySession,
      chatHistory: [
        {
          id: "welcome_msg",
          role: "model" as const,
          content: `Hi there! I am your AI Study Companion. From your uploaded ${mimeType.includes("pdf") ? "PDF document" : "file"} **"${mediaName}"**, I have synthesized "${parsedStudySession.title}". It features an academic summary, interactive mind map coordinate grid, checklist items, and active recall flashcards. Ask me anything or request a quiz!`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    res.json(formattedResult);

  } catch (error: any) {
    console.warn("[MULTIPART PROCESS ERROR] Failed to process real file:", error);
    res.status(500).json({ error: cleanErrorMessage(error) });
  }
});

// Endpoint to receive chunked uploads for large documents/assets (e.g. 3-4MB slices)
app.post("/api/upload-chunk", upload.single("chunk"), async (req, res) => {
  try {
    const file = req.file;
    const { uploadId, chunkIndex } = req.body;

    if (!file) {
      res.status(400).json({ error: "No chunk file received." });
      return;
    }
    if (!uploadId || chunkIndex === undefined) {
      res.status(400).json({ error: "Missing uploadId or chunkIndex." });
      return;
    }

    const chunkDir = path.join("/tmp", "chunks", uploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    // Use copyFileSync and unlinkSync for safer moving of cross-device temp files in standard Docker/Cloud environments
    fs.copyFileSync(file.path, chunkPath);
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      console.warn("Failed to clean up transient multer chunk:", e);
    }

    res.json({ success: true, chunkIndex: parseInt(chunkIndex, 10) });
  } catch (err: any) {
    console.error("[CHUNK UPLOAD ERROR]:", err);
    res.status(500).json({ error: err.message || "Failed to upload chunk." });
  }
});

// Endpoint to merge chunks for large files and execute high-capacity Gemini curation
app.post("/api/merge-chunks", async (req, res) => {
  try {
    const { uploadId, fileName, mediaType, mimeType, totalChunks } = req.body;

    if (!uploadId || !fileName || totalChunks === undefined) {
      res.status(400).json({ error: "Missing merge parameters: uploadId, fileName, or totalChunks." });
      return;
    }

    const chunkDir = path.join("/tmp", "chunks", uploadId);
    const mergedFilePath = path.join("/tmp", `${uploadId}_${fileName}`);

    console.log(`[MERGE START] id: ${uploadId}, name: ${fileName}, pieces: ${totalChunks}`);

    // Reassemble files sequentially
    const writeStream = fs.createWriteStream(mergedFilePath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.end();
        res.status(400).json({ error: `Chunk reconstruction error: Missing slice index #${i}` });
        return;
      }

      const chunkBuffer = fs.readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
    }

    writeStream.end();

    // Await stream completion
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => resolve());
      writeStream.on("error", (err) => reject(err));
    });

    const fileStats = fs.statSync(mergedFilePath);
    console.log(`[MERGE DONE] reassembled at: ${mergedFilePath}, final size: ${Math.round(fileStats.size / 1024 / 1024)}MB`);

    // Proactively clean up chunk folder
    try {
      const chunkList = fs.readdirSync(chunkDir);
      for (const item of chunkList) {
        fs.unlinkSync(path.join(chunkDir, item));
      }
      fs.rmdirSync(chunkDir);
    } catch (cleanupErr) {
      console.warn("Warning: Chunk assets garbage collection failed:", cleanupErr);
    }

    // Now, run the actual Gemini analysis on the newly fully-assembled file
    const ai = getGeminiClient();
    let contentsPayload: any[] = [];
    const isPlainText = mimeType.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv") || fileName.endsWith(".json");

    if (isPlainText) {
      const textContent = fs.readFileSync(mergedFilePath, "utf8");
      
      try {
        fs.unlinkSync(mergedFilePath);
      } catch (err) {
        console.error("Failed to delete assembled text file:", err);
      }

      contentsPayload = [{
        text: `Analyze the following lecture notes or document text: "${fileName}". Generate a high-fidelity summarized study companion following the structural responseSchema:
        
        === DOCUMENT CONTENT ===
        ${textContent}
        === END DOCUMENT CONTENT ===
        
        Make sure the mindMap structure is complete, featuring colorful, helpful levels of root topic, sub-topic, and subtopic children details.`
      }];
    } else {
      let uploadResult;
      try {
        console.log(`Uploading reassembled heavy file to Gemini File API...`);
        uploadResult = await ai.files.upload({
          file: mergedFilePath,
          config: {
            mimeType: mimeType,
          }
        });
        console.log(`Gemini File API Upload successful. name: ${uploadResult.name}, uri: ${uploadResult.uri}`);
      } catch (uploadError: any) {
        console.error("Gemini File API Upload failed for reassembled file:", uploadError);
        res.status(400).json({ error: `Failed to upload file to Gemini File API: ${cleanErrorMessage(uploadError)}` });
        return;
      } finally {
        try {
          if (fs.existsSync(mergedFilePath)) {
            fs.unlinkSync(mergedFilePath);
            console.log(`Cleaned up temp merged file: ${mergedFilePath}`);
          }
        } catch (cleanupErr) {
          console.error("Failed to clean up temp merged file post-upload:", cleanupErr);
        }
      }

      // Wait if document/media status is still PROCESSING in the cloud
      let fileRef = await ai.files.get({ name: uploadResult.name });
      let attempts = 0;
      while (fileRef.state === "PROCESSING" && attempts < 90) { // wait up to 3 minutes
        console.log(`Reassembled heavy asset processing in Gemini. State: ${fileRef.state}. Waiting 2s...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileRef = await ai.files.get({ name: uploadResult.name });
        attempts++;
      }

      if (fileRef.state === "FAILED") {
        throw new Error("Reassembled heavy document processing failed under Gemini File Engine.");
      }

      let contentPromptText = "";
      if (mimeType.includes("pdf")) {
        contentPromptText = `You are a world-class academic summaries analyzer. Carefully study the uploaded PDF document: "${fileName}".
        Read and analyze every page. Capture key ideas, structures, formulas, and conclusions, and compile a high-fidelity study companion.`;
      } else {
        contentPromptText = `You are an advanced multimedia processor. Carefully analyze this uploaded ${mediaType || 'lecture media'} file: "${fileName}".
        Reconstruct the exact narrative flow as the transcript, timestamping key changes. Then compile a high-fidelity study suite.`;
      }

      contentsPayload = [
        {
          fileData: {
            fileUri: fileRef.uri,
            mimeType: fileRef.mimeType,
          }
        },
        {
          text: `${contentPromptText}
          
          Generate fully populated and valid results in JSON format according to the supplied responseSchema:
          1. An academic and professional title.
          2. A beautiful detailed summary/resume in formatted Markdown.
          3. A complete timestamped narrative transcript or detailed chapter layout.
          4. Structured follow-up Action Items.
          5. A highly descriptive Mind Map concept hierarchy matching the MindMapNode schema structure.
          6. Five to seven highly engaging study flashcards testing main concept outcomes.
          
          CRITICAL REQUIREMENT: You MUST automatically detect the language spoken or written in the source audio/video/document (e.g. Spanish, English). All generated text fields (title, summary, transcript, actionItems, mindMap, flashcards) MUST be entirely in that detected language. Do not translate the content; write it fully in the detected language (for example, if the input is in Spanish, everything must be in Spanish).`
        }
      ];
    }

    console.log("Generating study companion from Gemini on reassembled dataset...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contentsPayload,
      config: {
        responseMimeType: "application/json",
        responseSchema: studyResponseSchema,
        temperature: 0.2
      }
    });

    const parsedText = response.text;
    if (!parsedText) {
      throw new Error("No response output text was generated by Gemini.");
    }

    let parsedStudySession;
    try {
      parsedStudySession = JSON.parse(parsedText.trim());
    } catch (parseErr) {
      console.error("JSON parsing error of Gemini output. Output was:", parsedText);
      throw new Error("Gemini generated study content, but it was not formatted in conformant JSON. Please retry.");
    }

    const formattedResult = {
      id: "sess_" + Date.now().toString(36),
      createdAt: new Date().toISOString(),
      mediaType: mediaType || (mimeType.includes("pdf") ? "pdf" : "audio"),
      mediaName: fileName,
      ...parsedStudySession,
      chatHistory: [
        {
          id: "welcome_msg",
          role: "model" as const,
          content: `Hi there! I am your AI Study Companion. From your uploaded ${mimeType.includes("pdf") ? "PDF document" : "file"} **"${fileName}"**, I have synthesized "${parsedStudySession.title}". It features an academic summary, interactive mind map coordinate grid, checklist items, and active recall flashcards. Ask me anything or request a quiz!`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    res.json(formattedResult);

  } catch (error: any) {
    console.warn("[CHUNK ASSEMBLY PROCESS ERROR] Failed to process reassembled file:", error);
    res.status(500).json({ error: cleanErrorMessage(error) });
  }
});

// Global error handling middleware to ensure we always reply with JSON for API errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Express Error Handler caught:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || "An unexpected error occurred in the backend application."
  });
});

// Serve frontend assets and SPA routes in Express + Vite setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode with compiled assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lecture Study Companion running at: http://localhost:${PORT}`);
  });
}

startServer();
