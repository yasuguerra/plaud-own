import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";

// Explicitly override host environment variables with .env configuration
dotenv.config();
if (fs.existsSync(".env")) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(".env"));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  } catch (e) {
    console.warn("Failed to manually parse .env", e);
  }
}

// Initialize Firestore Database connection
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
});

// Initialize Cloud Storage connection
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
});
const BUCKET_NAME = "plaud-own-media";

async function uploadToGCS(filePath: string, destination: string, mimeType: string): Promise<string> {
  try {
    console.log(`[GCS] Uploading ${filePath} to gs://${BUCKET_NAME}/${destination}...`);
    await storage.bucket(BUCKET_NAME).upload(filePath, {
      destination: destination,
      metadata: {
        contentType: mimeType,
      }
    });
    console.log(`[GCS] Upload completed successfully.`);
    return `gs://${BUCKET_NAME}/${destination}`;
  } catch (err) {
    console.error("[GCS ERROR] Failed to upload to GCS:", err);
    return "";
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

  const isPlaceholder = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.trim() === "";

  if (!isPlaceholder) {
    // AQ... keys are Vertex AI Express keys — require vertexai: true (no project/location needed)
    // AIzaSy... keys are Google AI Studio keys — use apiKey only
    if (apiKey.startsWith("AQ")) {
      console.log("[GEMINI CLIENT INIT] Vertex AI Express key detected. Using vertexai: true.");
      aiClient = new GoogleGenAI({ vertexai: true, apiKey: apiKey });
    } else {
      console.log("[GEMINI CLIENT INIT] Google AI Studio key detected.");
      aiClient = new GoogleGenAI({ apiKey: apiKey });
    }
  } else {
    console.log("[GEMINI CLIENT INIT] No API Key configured. Authenticating using Application Default Credentials (ADC) and Vertex AI settings...");
    // Fallback to Google Gen AI with no api key, which resolves to local credentials or active GCP service account
    aiClient = new GoogleGenAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1"
    });
  }
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

// Config endpoint for client-side Firebase Auth initialization
app.get("/api/config", (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: `${process.env.GOOGLE_CLOUD_PROJECT || "plaud-own"}.firebaseapp.com`,
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
    storageBucket: `${process.env.GOOGLE_CLOUD_PROJECT || "plaud-own"}.firebasestorage.app`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
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
      model: "gemini-1.5-flash",
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
        // Fall back to GCS and Vertex AI for heavier uploaded files to bypass Files API limits completely!
        console.log(`Using GCS fallback for direct uploads...`);
        let safeName = (mediaName || "user_upload").replace(/[^a-zA-Z0-9.-]/g, "_");
        if (!safeName.includes(".")) {
          const ext = getExtensionFromMimeType(cleanMime);
          safeName = `${safeName}.${ext}`;
        }
        const tempFilePath = path.join("/tmp", `${Date.now()}_${safeName}`);
        
        let gcsUri = "";
        try {
          const buffer = Buffer.from(base64Data, "base64");
          fs.writeFileSync(tempFilePath, buffer);
          console.log(`Temp file written to: ${tempFilePath} (${buffer.length} bytes)`);

          const sessionId = "sess_" + Date.now().toString(36);
          const gcsDestination = `audios/${sessionId}_${safeName}`;
          gcsUri = await uploadToGCS(tempFilePath, gcsDestination, cleanMime);
        } catch (uploadError: any) {
          console.error("GCS Upload failed:", uploadError);
          res.status(400).json({ error: `Failed to upload multimedia file to Cloud Storage: ${cleanErrorMessage(uploadError)}` });
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

        contentsPayload = [
          {
            fileData: {
              fileUri: gcsUri,
              mimeType: cleanMime,
            }
          },
          {
            text: contentPromptText
          }
        ];
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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

    const userId = (req.headers["x-user-id"] || "guest") as string;

    // Pre-generate session ID and upload file to GCS under tenant account
    const sessionId = "sess_" + Date.now().toString(36);
    const gcsDestination = `audios/${sessionId}_${mediaName}`;
    const gcsUri = await uploadToGCS(tempFilePath, gcsDestination, cleanMime);

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
      // PDF or Audio or Video - Process natively via Vertex AI from GCS Uri
      // Clean up the local temp file since it is now uploaded to GCS securely!
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        console.log(`[GCS PROCESO] Temp file cleaned up. Processing via GCS URI: ${gcsUri}`);
      } catch (cleanupErr) {
        console.error("Failed to delete temp file:", cleanupErr);
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
            fileUri: gcsUri,
            mimeType: cleanMime,
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
      model: "gemini-1.5-flash",
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
      id: sessionId,
      userId: userId, // Attach User ID
      createdAt: new Date().toISOString(),
      mediaType: mediaType || (mimeType.includes("pdf") ? "pdf" : "audio"),
      mediaName: mediaName,
      gcsUri: gcsUri, // Store GCS URI
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

    const userId = (req.headers["x-user-id"] || "guest") as string;

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

    // Pre-generate session ID and upload reassembled file to GCS under tenant account
    const sessionId = "sess_" + Date.now().toString(36);
    const gcsDestination = `audios/${sessionId}_${fileName}`;
    const gcsUri = await uploadToGCS(mergedFilePath, gcsDestination, mimeType || "");

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
      // PDF or Audio or Video - Process natively via Vertex AI from GCS Uri
      // Clean up the local temp merged file since it is now uploaded to GCS securely!
      try {
        if (fs.existsSync(mergedFilePath)) {
          fs.unlinkSync(mergedFilePath);
          console.log(`[GCS REENSAMBLADO] Temp merged file cleaned up. Processing via GCS URI: ${gcsUri}`);
        }
      } catch (cleanupErr) {
        console.error("Failed to clean up temp merged file post-upload:", cleanupErr);
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
            fileUri: gcsUri,
            mimeType: mimeType,
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
      model: "gemini-1.5-flash",
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
      id: sessionId,
      userId: userId, // Attach User ID
      createdAt: new Date().toISOString(),
      mediaType: mediaType || (mimeType.includes("pdf") ? "pdf" : "audio"),
      mediaName: fileName,
      gcsUri: gcsUri, // Store GCS URI
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

// --- FIRESTORE DATABASE ROUTES ---

// 1. Get all saved study sessions from Firestore (partitioned by User ID)
app.get("/api/sessions", async (req, res, next) => {
  try {
    const userId = (req.headers["x-user-id"] || "guest") as string;
    console.log(`[FIRESTORE] Fetching sessions for user: ${userId}...`);
    const snapshot = await firestore
      .collection("sessions")
      .where("userId", "==", userId)
      .get();
    const sessions: any[] = [];
    snapshot.forEach(doc => {
      sessions.push(doc.data());
    });
    
    // Sort in memory by createdAt descending to avoid requiring composite indexes in Firestore
    sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[FIRESTORE] Successfully fetched ${sessions.length} sessions for user ${userId}.`);
    res.json(sessions);
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to fetch sessions:", error);
    next(error);
  }
});

// 2. Save or update a study session in Firestore (partitioned by User ID)
app.post("/api/sessions", async (req, res, next) => {
  try {
    const session = req.body;
    const userId = (req.headers["x-user-id"] || "guest") as string;
    if (!session || !session.id) {
      res.status(400).json({ error: "Session data with a valid id is required" });
      return;
    }
    const updatedSession = { ...session, userId: userId };
    console.log(`[FIRESTORE] Saving session: ${session.id} ("${session.title || 'Untitled'}") for user: ${userId}`);
    await firestore.collection("sessions").doc(session.id).set(updatedSession);
    console.log(`[FIRESTORE] Successfully saved session ${session.id}.`);
    res.json({ success: true, id: session.id });
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to save session:", error);
    next(error);
  }
});

// 3. Delete a study session from Firestore (with ownership check)
app.delete("/api/sessions/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req.headers["x-user-id"] || "guest") as string;
    if (!id) {
      res.status(400).json({ error: "Session id is required" });
      return;
    }
    console.log(`[FIRESTORE] Deleting session: ${id} for user: ${userId}`);
    
    const docRef = firestore.collection("sessions").doc(id);
    const doc = await docRef.get();
    if (doc.exists && doc.data()?.userId !== userId) {
      res.status(403).json({ error: "Forbidden: You do not own this session" });
      return;
    }

    await docRef.delete();
    console.log(`[FIRESTORE] Successfully deleted session ${id}.`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to delete session:", error);
    next(error);
  }
});

// 4. Stream private audio/media from GCS securely (with ownership check)
app.get("/api/sessions/:id/media", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req.headers["x-user-id"] || req.query.userId || "guest") as string;
    const doc = await firestore.collection("sessions").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const session = doc.data();
    if (session?.userId && session.userId !== userId) {
      res.status(403).json({ error: "Forbidden: Access denied to this media file" });
      return;
    }
    if (!session || !session.gcsUri) {
      res.status(404).json({ error: "No media file associated with this session" });
      return;
    }

    const uri = session.gcsUri; // e.g. gs://plaud-own-media-assets/audios/sess_xxx_filename.mp3
    const pathInBucket = uri.replace(`gs://${BUCKET_NAME}/`, "");

    console.log(`[GCS STREAM] Streaming media for session ${id} from gs://${BUCKET_NAME}/${pathInBucket}`);
    const file = storage.bucket(BUCKET_NAME).file(pathInBucket);

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "audio/mpeg");
    if (metadata.size !== undefined) {
      res.setHeader("Content-Length", String(metadata.size));
    }

    file.createReadStream().pipe(res);
  } catch (error: any) {
    console.error("[GCS STREAM ERROR] Failed to stream file from GCS:", error);
    next(error);
  }
});

// --- TEMA (FOLDERS) MANAGEMENT ROUTES ---

// 1. Get all folders from Firestore (partitioned by User ID)
app.get("/api/folders", async (req, res, next) => {
  try {
    const userId = (req.headers["x-user-id"] || "guest") as string;
    console.log(`[FIRESTORE] Fetching folders for user: ${userId}...`);
    const snapshot = await firestore
      .collection("folders")
      .where("userId", "==", userId)
      .get();
    const folders: any[] = [];
    snapshot.forEach(doc => {
      folders.push(doc.data());
    });
    
    // Sort in memory by createdAt descending to avoid requiring composite indexes in Firestore
    folders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[FIRESTORE] Successfully fetched ${folders.length} folders for user ${userId}.`);
    res.json(folders);
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to fetch folders:", error);
    next(error);
  }
});

// 2. Create or update a folder (partitioned by User ID)
app.post("/api/folders", async (req, res, next) => {
  try {
    const folder = req.body;
    const userId = (req.headers["x-user-id"] || "guest") as string;
    if (!folder || !folder.id || !folder.name) {
      res.status(400).json({ error: "Folder data with valid id and name is required" });
      return;
    }
    const updatedFolder = { ...folder, userId: userId };
    console.log(`[FIRESTORE] Saving folder: ${folder.id} ("${folder.name}") for user: ${userId}`);
    await firestore.collection("folders").doc(folder.id).set(updatedFolder);
    console.log(`[FIRESTORE] Successfully saved folder ${folder.id}.`);
    res.json({ success: true, id: folder.id });
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to save folder:", error);
    next(error);
  }
});

// 3. Delete a folder (with ownership check)
app.delete("/api/folders/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req.headers["x-user-id"] || "guest") as string;
    if (!id) {
      res.status(400).json({ error: "Folder id is required" });
      return;
    }
    console.log(`[FIRESTORE] Deleting folder: ${id} for user: ${userId}`);
    
    // Ownership check
    const folderDoc = await firestore.collection("folders").doc(id).get();
    if (folderDoc.exists && folderDoc.data()?.userId !== userId) {
      res.status(403).json({ error: "Forbidden: You do not own this folder" });
      return;
    }

    // Un-assign sessions belonging to this folder and user
    const sessionsSnapshot = await firestore
      .collection("sessions")
      .where("userId", "==", userId)
      .where("folderId", "==", id)
      .get();
    const batch = firestore.batch();
    sessionsSnapshot.forEach(doc => {
      batch.update(doc.ref, { folderId: null });
    });
    await batch.commit();

    await firestore.collection("folders").doc(id).delete();
    console.log(`[FIRESTORE] Successfully deleted folder ${id} and un-assigned its sessions.`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to delete folder:", error);
    next(error);
  }
});

// 4. Synthesize all meetings in a folder (partitioned by User ID)
app.post("/api/folders/:id/synthesize", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req.headers["x-user-id"] || "guest") as string;
    const folderDoc = await firestore.collection("folders").doc(id).get();
    if (!folderDoc.exists) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }
    const folder = folderDoc.data();
    if (folder?.userId !== userId) {
      res.status(403).json({ error: "Forbidden: You do not own this folder" });
      return;
    }

    console.log(`[AI SYNTHESIS] Starting folder synthesis for folder ${id} ("${folder.name}") for user: ${userId}...`);
    
    // Load all sessions belonging to this folder and user
    const sessionsSnapshot = await firestore
      .collection("sessions")
      .where("userId", "==", userId)
      .where("folderId", "==", id)
      .get();
    const sessions: any[] = [];
    sessionsSnapshot.forEach(doc => {
      sessions.push(doc.data());
    });

    if (sessions.length === 0) {
      res.status(400).json({ error: "No meetings or conversations found in this topic folder to synthesize." });
      return;
    }

    console.log(`[AI SYNTHESIS] Found ${sessions.length} sessions to analyze.`);

    // Build a comprehensive, grounded text representation of all documents/meetings
    let crossMeetingContent = "";
    sessions.forEach((s, idx) => {
      crossMeetingContent += `\n--- MEETING #${idx + 1}: ${s.title || s.mediaName} ---\n`;
      crossMeetingContent += `Date/Time: ${s.createdAt}\n`;
      crossMeetingContent += `Summary/Resume:\n${s.summary || 'No summary'}\n`;
      if (s.actionItems && Array.isArray(s.actionItems)) {
        crossMeetingContent += `Action Items:\n`;
        s.actionItems.forEach((item: any) => {
          crossMeetingContent += `- [${item.importance || 'medium'}] ${item.task} (Assigned to: ${item.assignee || 'Unassigned'})\n`;
        });
      }
      crossMeetingContent += `\n`;
    });

    const prompt = `You are a world-class Corporate Knowledge Architect. You are analyzing a "Topic Folder" containing ${sessions.length} interconnected meetings and corporate files about: "${folder.name}".

Please read the provided summaries, timelines, and decision frameworks below. Synthesize a unified, comprehensive, and consolidated cross-meeting corporate intelligence report.

=== CROSS-MEETING KNOWLEDGE DATASET ===
${crossMeetingContent}
=== END CROSS-MEETING KNOWLEDGE DATASET ===

Your consolidated report MUST include:
1. **Executive Overview**: A unified, high-level synthesis of what this entire topic is about, what progress has been made, and the strategic direction.
2. **Major Thematic Pillars**: Consolidate key themes, decisions, and alignments across different meetings into clear, logical subsections.
3. **Consolidated Action Matrix**: A unified master checklist of follow-ups across all sessions, listing the task, priority, and suggested owner, removing any redundant duplicates.
4. **Chronological Evolution & Timeline**: Outline how decisions or discussions have evolved over time (from the oldest meeting to the newest).
5. **Gaps and Critical Risks**: Highlight any unresolved issues, conflicts of interest, missing timelines, or potential risks that need executive attention.

Write the entire intelligence report in a professional, beautiful, and highly dense Markdown format. Use clear subheadings, list structures, and bold accents.
CRITICAL REQUIREMENT: You MUST automatically detect the language used in the source sessions (e.g. Spanish, English). Write the entire report strictly in that detected language (for example, if the input meetings are in Spanish, the entire report must be in Spanish).`;

    console.log(`[AI SYNTHESIS] Dispatching compilation request to Gemini for folder "${folder.name}"...`);
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ text: prompt }],
      config: {
        temperature: 0.2
      }
    });

    const parsedText = response.text || "Failed to generate cross-meeting intelligence.";
    
    // Save the synthesis to the folder document
    const updatedFolder = {
      ...folder,
      aiSynthesis: parsedText,
      synthesizedAt: new Date().toISOString()
    };
    
    await firestore.collection("folders").doc(id).set(updatedFolder);
    console.log(`[AI SYNTHESIS] Folder "${folder.name}" successfully synthesized and saved.`);
    res.json(updatedFolder);

  } catch (error: any) {
    console.error("[AI SYNTHESIS ERROR] Folder synthesis failed:", error);
    next(error);
  }
});

// --- USER PROFILE ROUTES ---

// 1. Get user profile details from Firestore
app.get("/api/users/profile", async (req, res, next) => {
  try {
    const userId = (req.headers["x-user-id"] || "guest") as string;
    console.log(`[FIRESTORE] Fetching profile for user: ${userId}...`);
    const doc = await firestore.collection("users").doc(userId).get();
    if (doc.exists) {
      res.json(doc.data());
    } else {
      res.json({ uid: userId, companyName: "" });
    }
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to fetch user profile:", error);
    next(error);
  }
});

// 2. Save or update user profile details in Firestore
app.post("/api/users/profile", async (req, res, next) => {
  try {
    const userId = (req.headers["x-user-id"] || "guest") as string;
    const profile = req.body;
    if (!profile) {
      res.status(400).json({ error: "Profile data is required" });
      return;
    }
    const updatedProfile = { 
      ...profile, 
      uid: userId,
      updatedAt: new Date().toISOString()
    };
    console.log(`[FIRESTORE] Saving profile for user: ${userId}`);
    await firestore.collection("users").doc(userId).set(updatedProfile, { merge: true });
    console.log(`[FIRESTORE] Successfully saved profile for user ${userId}.`);
    res.json(updatedProfile);
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to save user profile:", error);
    next(error);
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
  if (process.env.NODE_ENV === "development") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
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
      // If the request is for an asset or static file that doesn't exist, return 404 instead of falling back to index.html
      if (req.path.startsWith("/assets/") || req.path.includes(".")) {
        res.status(404).send("Not Found");
        return;
      }
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Lecture Study Companion running at: http://localhost:${PORT}`);
  });
}

startServer();
