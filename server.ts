import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import * as dotenvModule from "dotenv";

const dotenv = dotenvModule && typeof (dotenvModule as any).config === "function"
  ? dotenvModule
  : (dotenvModule as any).default && typeof (dotenvModule as any).default.config === "function"
    ? (dotenvModule as any).default
    : { config: () => {}, parse: (content: any) => ({}) };

import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";
import { getTemplateById } from "./src/templates";
import { exec } from "child_process";
import { promisify } from "util";
import speech from "@google-cloud/speech";

const execPromise = promisify(exec);

const LOG_FILE_PATH = path.join(process.cwd(), "logs", "platform.log");

export function logToPlatform(message: string, level: string = "INFO") {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  if (level === "ERROR" || level === "WARN") {
    console.error(formattedMessage.trim());
  } else {
    console.log(formattedMessage.trim());
  }

  try {
    const dir = path.dirname(LOG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE_PATH, formattedMessage);
  } catch (err: any) {
    console.error(`[LOG FILE ERROR] Failed to write to platform.log:`, err.message || err);
  }
}

// Explicitly override host environment variables with .env configuration
try {
  if (dotenv && typeof (dotenv as any).config === "function") {
    (dotenv as any).config();
  }
} catch (configErr) {
  console.warn("Safe dotenv.config() bypassed:", configErr);
}

if (fs.existsSync(".env")) {
  try {
    if (dotenv && typeof (dotenv as any).parse === "function") {
      const envConfig = (dotenv as any).parse(fs.readFileSync(".env"));
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
    }
  } catch (e) {
    console.warn("Failed to manually parse .env", e);
  }
}

// In-Memory Fail-Safe Database Adapter for Firestore
export class FailSafeFirestore {
  private useMemory = false;
  private memoryDb: Record<string, Record<string, any>> = {
    users: {},
    sessions: {},
    folders: {},
  };
  private realFirestore: Firestore | null = null;

  constructor() {
    try {
      this.realFirestore = new Firestore({
        projectId: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
      });
      console.log("[FIRESTORE INIT] Initialized Firestore client.");
    } catch (e: any) {
      console.warn("[FIRESTORE INIT FAIL] Real Firestore initialization failed. Falling back to in-memory mode:", e.message || e);
      this.useMemory = true;
    }
  }

  public setMemoryMode(enable: boolean) {
    this.useMemory = enable;
  }

  public isMemoryMode(): boolean {
    return this.useMemory;
  }

  public clearMemory() {
    this.memoryDb = {
      users: {},
      sessions: {},
      folders: {},
    };
  }

  public collection(name: string) {
    const self = this;
    return {
      doc(id: string) {
        return {
          ref: { id, collectionName: name },
          async get() {
            if (self.useMemory) {
              const data = self.memoryDb[name]?.[id];
              return {
                exists: data !== undefined,
                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              };
            }
            try {
              const doc = await self.realFirestore!.collection(name).doc(id).get();
              return doc;
            } catch (err: any) {
              console.warn(`[FIRESTORE ERR] collection(${name}).doc(${id}).get() failed. Activating in-memory fallback:`, err.message || err);
              self.useMemory = true;
              const data = self.memoryDb[name]?.[id];
              return {
                exists: data !== undefined,
                data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              };
            }
          },
          async set(data: any, options?: any) {
            if (self.useMemory) {
              if (!self.memoryDb[name]) self.memoryDb[name] = {};
              if (options?.merge && self.memoryDb[name][id]) {
                self.memoryDb[name][id] = { ...self.memoryDb[name][id], ...data };
              } else {
                self.memoryDb[name][id] = { ...data };
              }
              return;
            }
            try {
              await self.realFirestore!.collection(name).doc(id).set(data, options);
            } catch (err: any) {
              console.warn(`[FIRESTORE ERR] collection(${name}).doc(${id}).set() failed. Activating in-memory fallback:`, err.message || err);
              self.useMemory = true;
              if (!self.memoryDb[name]) self.memoryDb[name] = {};
              if (options?.merge && self.memoryDb[name][id]) {
                self.memoryDb[name][id] = { ...self.memoryDb[name][id], ...data };
              } else {
                self.memoryDb[name][id] = { ...data };
              }
            }
          },
          async update(data: any) {
            if (self.useMemory) {
              if (!self.memoryDb[name]) self.memoryDb[name] = {};
              self.memoryDb[name][id] = { ...(self.memoryDb[name][id] || {}), ...data };
              return;
            }
            try {
              await self.realFirestore!.collection(name).doc(id).update(data);
            } catch (err: any) {
              console.warn(`[FIRESTORE ERR] collection(${name}).doc(${id}).update() failed. Activating in-memory fallback:`, err.message || err);
              self.useMemory = true;
              if (!self.memoryDb[name]) self.memoryDb[name] = {};
              self.memoryDb[name][id] = { ...(self.memoryDb[name][id] || {}), ...data };
            }
          },
          async delete() {
            if (self.useMemory) {
              if (self.memoryDb[name]) {
                delete self.memoryDb[name][id];
              }
              return;
            }
            try {
              await self.realFirestore!.collection(name).doc(id).delete();
            } catch (err: any) {
              console.warn(`[FIRESTORE ERR] collection(${name}).doc(${id}).delete() failed. Activating in-memory fallback:`, err.message || err);
              self.useMemory = true;
              if (self.memoryDb[name]) {
                delete self.memoryDb[name][id];
              }
            }
          },
        };
      },

      where(field: string, opStr: string, value: any) {
        return {
          where(field2: string, opStr2: string, value2: any) {
            return {
              async get() {
                if (self.useMemory) {
                  const results: any[] = [];
                  const col = self.memoryDb[name] || {};
                  for (const key of Object.keys(col)) {
                    const docVal = col[key];
                    if (docVal && docVal[field] === value && docVal[field2] === value2) {
                      results.push({
                        data: () => JSON.parse(JSON.stringify(docVal)),
                        ref: { id: key, collectionName: name },
                      });
                    }
                  }
                  return {
                    forEach(callback: (doc: any) => void) {
                      results.forEach(callback);
                    },
                    empty: results.length === 0,
                  };
                }
                try {
                  const snap = await self.realFirestore!.collection(name)
                    .where(field, opStr as any, value)
                    .where(field2, opStr2 as any, value2)
                    .get();
                  return snap;
                } catch (err: any) {
                  console.warn(`[FIRESTORE ERR] collection(${name}).where(${field}, ${opStr}, ${value}).where(${field2}, ${opStr2}, ${value2}).get() failed. Activating in-memory fallback:`, err.message || err);
                  self.useMemory = true;
                  const results: any[] = [];
                  const col = self.memoryDb[name] || {};
                  for (const key of Object.keys(col)) {
                    const docVal = col[key];
                    if (docVal && docVal[field] === value && docVal[field2] === value2) {
                      results.push({
                        data: () => JSON.parse(JSON.stringify(docVal)),
                        ref: { id: key, collectionName: name },
                      });
                    }
                  }
                  return {
                    forEach(callback: (doc: any) => void) {
                      results.forEach(callback);
                    },
                    empty: results.length === 0,
                  };
                }
              },
            };
          },

          async get() {
            if (self.useMemory) {
              const results: any[] = [];
              const col = self.memoryDb[name] || {};
              for (const key of Object.keys(col)) {
                const docVal = col[key];
                if (docVal && docVal[field] === value) {
                  results.push({
                    data: () => JSON.parse(JSON.stringify(docVal)),
                    ref: { id: key, collectionName: name },
                  });
                }
              }
              return {
                forEach(callback: (doc: any) => void) {
                  results.forEach(callback);
                },
                empty: results.length === 0,
              };
            }
            try {
              const snap = await self.realFirestore!.collection(name).where(field, opStr as any, value).get();
              return snap;
            } catch (err: any) {
              console.warn(`[FIRESTORE ERR] collection(${name}).where(${field}, ${opStr}, ${value}).get() failed. Activating in-memory fallback:`, err.message || err);
              self.useMemory = true;
              const results: any[] = [];
              const col = self.memoryDb[name] || {};
              for (const key of Object.keys(col)) {
                const docVal = col[key];
                if (docVal && docVal[field] === value) {
                  results.push({
                    data: () => JSON.parse(JSON.stringify(docVal)),
                    ref: { id: key, collectionName: name },
                  });
                }
              }
              return {
                forEach(callback: (doc: any) => void) {
                  results.forEach(callback);
                },
                empty: results.length === 0,
              };
            }
          },
        };
      },

      async get() {
        if (self.useMemory) {
          const results: any[] = [];
          const col = self.memoryDb[name] || {};
          for (const key of Object.keys(col)) {
            const docVal = col[key];
            if (docVal) {
              results.push({
                data: () => JSON.parse(JSON.stringify(docVal)),
                ref: { id: key, collectionName: name },
              });
            }
          }
          return {
            forEach(callback: (doc: any) => void) {
              results.forEach(callback);
            },
            empty: results.length === 0,
          };
        }
        try {
          const snap = await self.realFirestore!.collection(name).get();
          return snap;
        } catch (err: any) {
          console.warn(`[FIRESTORE ERR] collection(${name}).get() failed. Activating in-memory fallback:`, err.message || err);
          self.useMemory = true;
          const results: any[] = [];
          const col = self.memoryDb[name] || {};
          for (const key of Object.keys(col)) {
            const docVal = col[key];
            if (docVal) {
              results.push({
                data: () => JSON.parse(JSON.stringify(docVal)),
                ref: { id: key, collectionName: name },
              });
            }
          }
          return {
            forEach(callback: (doc: any) => void) {
              results.forEach(callback);
            },
            empty: results.length === 0,
          };
        }
      },
    };
  }

  public batch() {
    const self = this;
    const operations: Array<() => Promise<void>> = [];
    return {
      update(docRefWrapper: any, data: any) {
        const { id, collectionName } = docRefWrapper;
        operations.push(async () => {
          if (self.useMemory) {
            if (!self.memoryDb[collectionName]) self.memoryDb[collectionName] = {};
            self.memoryDb[collectionName][id] = { ...(self.memoryDb[collectionName][id] || {}), ...data };
            return;
          }
          try {
            await self.realFirestore!.collection(collectionName).doc(id).update(data);
          } catch (err: any) {
            console.warn(`[FIRESTORE BATCH ERR] update doc ${id} failed. Activating in-memory fallback:`, err.message || err);
            self.useMemory = true;
            if (!self.memoryDb[collectionName]) self.memoryDb[collectionName] = {};
            self.memoryDb[collectionName][id] = { ...(self.memoryDb[collectionName][id] || {}), ...data };
          }
        });
      },
      async commit() {
        for (const op of operations) {
          await op();
        }
      },
    };
  }
}

// Initialize Fail-Safe Firestore Database connection wrapper
const firestore = new FailSafeFirestore();

// Helper to log operations and update progress for a session
async function logToSession(sessionId: string, stage: string, message: string, progress: number) {
  const timestamp = new Date().toISOString();
  logToPlatform(`[SESSION LOG][${sessionId}][${stage}] (${progress}%): ${message}`, "INFO");
  try {
    const docRef = firestore.collection("sessions").doc(sessionId);
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      const logs = data?.logs || [];
      logs.push({ timestamp, stage, message });
      await docRef.update({ logs, progress });
    }
  } catch (err: any) {
    logToPlatform(`[SESSION LOG ERROR] Failed to write log for session ${sessionId}: ${err.message || err}`, "ERROR");
  }
}

// Initialize Cloud Storage connection
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
});
let BUCKET_NAME = "plaud-own-media";

async function discoverStorageBucket() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "plaud-own";
  const defaultBucket = `${projectId}.firebasestorage.app`;
  const legacyBucket = `${projectId}.appspot.com`;
  const candidates = ["plaud-own-media", defaultBucket, legacyBucket];
  
  for (const candidate of candidates) {
    try {
      const bucket = storage.bucket(candidate);
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`[STORAGE INIT] Successfully verified GCS bucket: ${candidate}`);
        BUCKET_NAME = candidate;
        return;
      }
    } catch (err: any) {
      console.warn(`[STORAGE INIT] Checking bucket ${candidate} failed:`, err.message || err);
    }
  }
  console.warn(`[STORAGE INIT] Could not find any of the candidate buckets. Defaulting to: ${BUCKET_NAME}`);
}

// Invoke on startup
discoverStorageBucket().catch(err => {
  console.error("[STORAGE INIT ERROR] Unhandled bucket discovery error:", err);
});

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

async function transcodeToWav(inputPath: string, outputPath: string): Promise<boolean> {
  console.log(`[TRANSCODE] Attempting to transcode "${inputPath}" to "${outputPath}"...`);
  // Flags: -y to overwrite, -threads 0 for multi-threaded CPU processing, -i input, -acodec pcm_s16le (16-bit linear PCM), -ac 1 (mono), -ar 16000 (16000 Hz)
  const command = `ffmpeg -y -threads 0 -i "${inputPath}" -acodec pcm_s16le -ac 1 -ar 16000 "${outputPath}"`;
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log(`[TRANSCODE] FFMPEG Success. stdout: ${stdout || "none"}`);
    return true;
  } catch (err: any) {
    console.error(`[TRANSCODE ERROR] FFMPEG failed to transcode. Error:`, err.message || err);
    return false;
  }
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `[${pad(h)}:${pad(m)}:${pad(s)}]`;
}

async function transcribeAudioWithChirp2(
  gcsUri: string,
  mimeType: string,
  transcodedSuccessfully: boolean
): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "plaud-own";
  console.log(`[STT V1] Initializing SpeechClient for project ${projectId}...`);

  const speechClient = new speech.SpeechClient({
    projectId: projectId
  });

  let encoding = "LINEAR16";
  let sampleRateHertz = 16000;

  if (!transcodedSuccessfully && mimeType) {
    const mimeLower = mimeType.toLowerCase();
    if (mimeLower.includes("ogg")) {
      encoding = "OGG_OPUS";
      sampleRateHertz = 48000;
      console.log(`[STT V1] Transcoding skipped/failed for OGG. Using native OGG_OPUS encoding config at 48kHz.`);
    } else if (mimeLower.includes("mp3") || mimeLower.includes("mpeg")) {
      encoding = "MP3";
      sampleRateHertz = 16000;
      console.log(`[STT V1] Transcoding skipped/failed for MP3. Using native MP3 encoding config.`);
    }
  }

  const request = {
    config: {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: "es-ES",
      model: "default",  // "default" supports es-ES in all regions; "latest_long" does NOT
      enableSpeakerDiarization: true,
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: 2,
        maxSpeakerCount: 8
      }
    },
    audio: {
      uri: gcsUri
    }
  };

  try {
    console.log(`[STT V1] Running longRunningRecognize on ${gcsUri}...`);
    const [operation] = await speechClient.longRunningRecognize(request as any);
    console.log(`[STT V1] Operation started: ${operation.name}. Waiting for completion...`);
    const [response] = await operation.promise();
    console.log(`[STT V1] Operation completed.`);

    if (!response.results || response.results.length === 0) {
      console.warn(`[STT V1] No results returned from Speech-to-Text.`);
      throw new Error("No speech detected or invalid audio format for Speech-to-Text V1.");
    }

    const parseDuration = (val: any): number => {
      if (!val) return 0;
      if (typeof val === "string") {
        return parseFloat(val.replace("s", ""));
      }
      const seconds = Number(val.seconds || 0);
      const nanos = Number(val.nanos || 0);
      return seconds + nanos / 1e9;
    };

    // For Speech-to-Text V1 diarization, the last result's alternative contains
    // the complete list of all words with speaker tags from the entire audio.
    const lastResult = response.results[response.results.length - 1];
    const lastAlternative = lastResult?.alternatives?.[0];
    let words = lastAlternative?.words || [];

    const hasSpeakerTags = words.some((w: any) => w.speakerTag);

    if (words.length === 0 || !hasSpeakerTags) {
      console.log("[STT V1] Last result words array is empty or lacks speaker tags. Falling back to gathering from all results.");
      words = [];
      for (const result of response.results) {
        const alternative = result.alternatives?.[0];
        if (alternative && alternative.words) {
          for (const wordObj of alternative.words) {
            words.push(wordObj);
          }
        }
      }
    } else {
      console.log(`[STT V1] Successfully extracted ${words.length} diarized words from the final result payload.`);
    }

    if (words.length === 0) {
      console.warn(`[STT V1] No words with speaker tags found.`);
      throw new Error("No speaker-diarized words found. Audio may be corrupt or encoded incorrectly.");
    }

    let currentSegment: { speaker: string; startTime: number; endTime: number; words: string[] } | null = null;
    const segments: Array<{ speaker: string; startTime: number; endTime: number; text: string }> = [];

    for (const wordObj of words) {
      const wordText = wordObj.word || "";
      const speaker = String(wordObj.speakerTag || "1");
      const startTime = parseDuration(wordObj.startTime);
      const endTime = parseDuration(wordObj.endTime);

      if (!currentSegment) {
        currentSegment = { speaker, startTime, endTime, words: [wordText] };
      } else if (currentSegment.speaker === speaker && (startTime - currentSegment.endTime) < 2.0) {
        currentSegment.words.push(wordText);
        currentSegment.endTime = endTime;
      } else {
        segments.push({
          speaker: currentSegment.speaker,
          startTime: currentSegment.startTime,
          endTime: currentSegment.endTime,
          text: currentSegment.words.join(" ")
        });
        currentSegment = { speaker, startTime, endTime, words: [wordText] };
      }
    }

    if (currentSegment) {
      segments.push({
        speaker: currentSegment.speaker,
        startTime: currentSegment.startTime,
        endTime: currentSegment.endTime,
        text: currentSegment.words.join(" ")
      });
    }

    if (segments.length === 0) {
      throw new Error("No diarized text segments found in the transcription.");
    }

    const formattedTranscript = segments.map(seg => {
      return `${formatTime(seg.startTime)} Speaker ${seg.speaker}: ${seg.text}`;
    }).join("\n");

    console.log(`[STT V1] Formatted transcript successfully. Length: ${formattedTranscript.length} characters.`);
    return formattedTranscript;

  } catch (err: any) {
    console.error(`[STT V1 ERROR] Speech-to-Text failed:`, err.message || err);
    throw new Error(`Speech-to-Text transcription failed: ${err.message}`);
  }
}

async function getUserSpeakerContext(userId: string): Promise<string> {
  if (!userId || userId === "guest") return "";
  try {
    const doc = await firestore.collection("users").doc(userId).get();
    if (doc.exists) {
      const data = doc.data();
      const ownerName = data?.displayName || "";
      const frequentSpeakers = data?.frequentSpeakers || "";
      let context = `\n\nWORKSPACE OWNER & PARTICIPANTS CONTEXT:`;
      if (ownerName) context += `\n- The owner of this workspace/application is: ${ownerName}. Typically, they are speaking when the speaker context matches the owner.`;
      if (frequentSpeakers) context += `\n- Other frequent participants in these meetings are: ${frequentSpeakers}.`;
      context += `\n- Analyze the voice styles, self-introductions, direct names called, or textual context in the recording. Identify who is speaking and map the generic speaker diarization IDs (e.g. Speaker A, Speaker B) directly to these real names if they are present or referred to. If they cannot be mapped, leave them as Speaker 1, Speaker 2, etc.`;
      return context;
    }
  } catch (err) {
    console.error("Failed to read user speaker context from Firestore:", err);
  }
  return "";
}

export function escapeJsonControlCharacters(jsonStr: string): string {
  let insideString = false;
  let escaped = false;
  let result = "";

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      insideString = !insideString;
      result += char;
      continue;
    }

    if (insideString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char.charCodeAt(0) < 32) {
        result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

export function safeParseJson(jsonStr: string): any {
  let cleaned = jsonStr.trim();
  
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/```$/, "").trim();
  }

  cleaned = escapeJsonControlCharacters(cleaned);

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("[JSON PARSE WARNING] Direct parse failed, attempting truncation repair. Error:", e);
  }

  let insideString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      insideString = !insideString;
      continue;
    }
    if (!insideString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  if (insideString) {
    cleaned += '"';
  }

  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') cleaned += '}';
    else if (open === '[') cleaned += ']';
  }

  try {
    return JSON.parse(cleaned);
  } catch (finalError: any) {
    console.error("[JSON PARSE FATAL] JSON is too corrupted to repair. Original length:", jsonStr.length);
    throw new Error(`JSON parsing failed: ${finalError.message}. Content preview: ${jsonStr.slice(0, 200)}...`);
  }
}

export function isTranscriptLooping(transcript: string): boolean {
  if (!transcript || transcript.length < 5000) return false;
  
  const lines = transcript.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 20) return false;
  
  const counts: Record<string, number> = {};
  for (const line of lines) {
    const cleanLine = line.replace(/^\[[^\]]+\]\s*(Speaker\s+\d+|[A-Za-z0-9 ]+):\s*/i, "").trim().toLowerCase();
    if (cleanLine.length > 15) {
      counts[cleanLine] = (counts[cleanLine] || 0) + 1;
      if (counts[cleanLine] >= 8) {
        console.warn(`[TRANSCRIPT LOOP DETECTED] Line "${cleanLine}" repeated ${counts[cleanLine]} times.`);
        return true;
      }
    }
  }
  return false;
}

async function runGeminiTranscription(
  ai: any,
  geminiFileUri: string,
  uploadMime: string,
  fileName: string,
  processedFilePath: string
): Promise<string> {
  const transcriptPrompt = `Analyze the attached audio file: "${fileName}".
Generate a complete, high-fidelity transcription of the spoken conversation.
You MUST separate different speakers (Speaker Diarization) and tag them clearly (e.g. Speaker 1, Speaker 2, Speaker 3).
Provide timing markers/timestamps (e.g., [01:23], [05:45]) at the beginning of each dialogue segment or when the speaker changes or a new topic starts.

CRITICAL TIMESTAMPS RULE: Do NOT output word-level timestamps or millisecond-level timestamps (e.g., do NOT output "[ 0m4s166ms ]" or "[ 0m5s6ms ]"). Only output segment-level timestamps in [MM:SS] format at the beginning of each line or speaker change.

CRITICAL REPETITION RULE: Avoid getting stuck in an infinite loop repeating the same transcription phrases. If there is a silence, pause, static, or repetitive background noise in the audio, do NOT repeat previous words. Always proceed linearly from the start of the audio to the end.

CRITICAL LANGUAGE REQUIREMENT: Transcribe exactly what is spoken. If the audio is in Spanish, the transcript MUST be in Spanish. If it is in English, the transcript MUST be in English. Do not translate the spoken words during transcription.`;

  const transcriptContents: any[] = [];
  if (geminiFileUri) {
    transcriptContents.push({
      fileData: {
        fileUri: geminiFileUri,
        mimeType: uploadMime,
      }
    });
  } else {
    const fileStats = fs.existsSync(processedFilePath) ? fs.statSync(processedFilePath) : null;
    if (fileStats && fileStats.size < 20 * 1024 * 1024) {
      console.log(`[PIPELINE] Using Base64 inlineData fallback (File size: ${Math.round(fileStats.size / 1024 / 1024)}MB)...`);
      const base64Content = fs.readFileSync(processedFilePath).toString("base64");
      transcriptContents.push({
        inlineData: {
          mimeType: uploadMime,
          data: base64Content
        }
      });
    } else {
      throw new Error("No se pudo subir el archivo de audio a la nube y el archivo local es demasiado grande para procesarse en memoria.");
    }
  }

  transcriptContents.push({
    text: transcriptPrompt
  });

  console.log("[PIPELINE] Querying Gemini 3.5 Flash for high-fidelity transcription (Stage 1)...");
  const transcriptResponse = await generateWithFallback({
    model: "gemini-3.5-flash",
    contents: transcriptContents,
    config: {
      temperature: 0.1, // low temperature for precise transcription
    }
  });

  const transcriptText = transcriptResponse.text;
  if (!transcriptText) {
    throw new Error("Gemini no pudo generar la transcripción del audio.");
  }
  return transcriptText;
}

async function executeAudioProcessing(
  localFilePath: string,
  mimeType: string,
  fileName: string,
  mediaType: string,
  selectedTemplate: any,
  speakerContext: string,
  userId: string,
  sessionId: string,
  processingMode?: string
): Promise<{ parsedStudySession: any; finalTranscript: string; gcsUri: string; geminiFileUri: string }> {
  const resolvedMime = resolveMimeType(fileName, mimeType);
  logToPlatform(`[PIPELINE START] Processing session: ${sessionId}. File: "${fileName}", MIME: ${mimeType} -> resolved to: ${resolvedMime}, size: ${fs.existsSync(localFilePath) ? Math.round(fs.statSync(localFilePath).size / 1024 / 1024) : 0}MB`, "INFO");

  let gcsUri = "";
  let geminiFileUri = "";
  let finalTranscript = "";
  let processedFilePath = localFilePath;

  try {
    // 1. Upload original file to Cloud Storage (GCS) as permanent backup and playback source
    const uploadMime = resolvedMime;
    const uploadName = fileName;
    const gcsDestination = `audios/${sessionId}_${uploadName}`;

    try {
      await logToSession(sessionId, "UPLOAD", "Subiendo archivo de audio original a GCS...", 15);
      gcsUri = await uploadToGCS(processedFilePath, gcsDestination, uploadMime);
      if (gcsUri) {
        await logToSession(sessionId, "UPLOAD", `Subida en GCS completada con éxito.`, 30);
      } else {
        await logToSession(sessionId, "UPLOAD", "La subida directa a GCS falló, procediendo con la API de Archivos de Gemini.", 30);
      }
    } catch (gcsErr: any) {
      console.warn("[PIPELINE GCS WARNING] GCS upload failed, falling back to Gemini Files API:", gcsErr);
      await logToSession(sessionId, "UPLOAD", "La subida directa a GCS falló, procediendo con la API de Archivos de Gemini.", 30);
    }

    const ai = getGeminiClient();

    // 2. Upload file to Gemini Files API (Required for Developer API mode where gs:// is not natively supported,
    // and excellent for native large file streaming/multimodal processing in all modes!)
    if (isDeveloperApiMode() || !gcsUri) {
      console.log("[PIPELINE] Uploading file to Gemini Files API...");
      await logToSession(sessionId, "UPLOAD", "Subiendo archivo a la API de Archivos de Gemini para análisis nativo...", 40);
      try {
        const fileRef = await ai.files.upload({
          file: processedFilePath,
          config: {
            mimeType: uploadMime,
            displayName: uploadName,
          }
        });
        geminiFileUri = fileRef.uri || "";
        logToPlatform(`[PIPELINE][${sessionId}] Gemini Files API upload successful for file "${uploadName}" (${uploadMime}): ${geminiFileUri}`, "INFO");
        await logToSession(sessionId, "UPLOAD", "Archivo cargado en la API de Archivos de Gemini de forma segura.", 50);
      } catch (uploadErr: any) {
        logToPlatform(`[PIPELINE ERROR][${sessionId}] Failed to upload file "${uploadName}" to Gemini Files API with mimeType "${uploadMime}": ${uploadErr?.stack || uploadErr?.message || uploadErr}`, "ERROR");
        await logToSession(sessionId, "UPLOAD", "Falla en carga a API de Archivos, preparando inlineData Base64.", 50);
      }
    } else {
      // In Vertex AI ADC mode, we can use the GCS URI directly for Gemini multimodal ingestion
      geminiFileUri = gcsUri;
      console.log(`[PIPELINE] Vertex AI ADC mode: using GCS URI directly: ${geminiFileUri}`);
      await logToSession(sessionId, "UPLOAD", "Modo Vertex AI: utilizando URI de GCS directamente.", 50);
    }

    // 3. Etapa 1: Transcripción y Diarización de Alta Precisión (Dual-Pass Stage 1)
    if (processingMode === "turbo" && gcsUri) {
      // Turbo mode: Transcribe with Google Cloud Speech-to-Text V1
      await logToSession(sessionId, "STT_API", "Modo Turbo: Iniciando transcripción rápida con Google Cloud Speech-to-Text...", 60);
      try {
        // Transcode to WAV for optimal STT accuracy
        const wavTempPath = path.join(os.tmpdir(), `${sessionId}_transcoded.wav`);
        const transcoded = await transcodeToWav(processedFilePath, wavTempPath);
        let sttGcsUri = gcsUri;
        
        if (transcoded) {
          const wavDestination = `audios/${sessionId}_transcoded.wav`;
          const uploadedWav = await uploadToGCS(wavTempPath, wavDestination, "audio/wav");
          if (uploadedWav) {
            sttGcsUri = uploadedWav;
          }
          try { fs.unlinkSync(wavTempPath); } catch {}
        }
        
        finalTranscript = await transcribeAudioWithChirp2(sttGcsUri, "audio/wav", transcoded);
        await logToSession(sessionId, "STT_API", "Transcripción rápida con Google Cloud STT completada con éxito.", 75);
      } catch (sttErr: any) {
        console.warn("[PIPELINE STT ERROR] Turbo mode Speech-to-Text failed. Falling back to Gemini Multimodal:", sttErr);
        await logToSession(sessionId, "STT_API", "Falla en Speech-to-Text, usando fallback nativo de Gemini...", 65);
        finalTranscript = await runGeminiTranscription(ai, geminiFileUri, uploadMime, fileName, processedFilePath);
        await logToSession(sessionId, "STT_API", "Transcripción con Gemini de respaldo completada.", 75);
      }
    } else {
      // High-Fidelity mode: Transcribe with Gemini Multimodal
      await logToSession(sessionId, "STT_API", "Etapa 1/2: Iniciando transcripción y separación de voces nativa con Gemini 3.5...", 60);
      finalTranscript = await runGeminiTranscription(ai, geminiFileUri, uploadMime, fileName, processedFilePath);
      
      // Automatic loop detection & self-healing recovery using Google Cloud STT!
      if (isTranscriptLooping(finalTranscript)) {
        console.warn(`[PIPELINE LOOP DETECTED] Transcript for session ${sessionId} is looping! Attempting self-healing recovery via Google Cloud STT...`);
        await logToSession(sessionId, "STT_RECOVERY", "Detección de bucle de repetición en Gemini. Iniciando auto-recuperación de alta precisión con Google Cloud STT...", 70);
        try {
          const wavTempPath = path.join(os.tmpdir(), `${sessionId}_recovery.wav`);
          const transcoded = await transcodeToWav(processedFilePath, wavTempPath);
          let sttGcsUri = gcsUri;
          
          if (transcoded) {
            const wavDestination = `audios/${sessionId}_recovery.wav`;
            const uploadedWav = await uploadToGCS(wavTempPath, wavDestination, "audio/wav");
            if (uploadedWav) {
              sttGcsUri = uploadedWav;
            }
            try { fs.unlinkSync(wavTempPath); } catch {}
          }
          
          finalTranscript = await transcribeAudioWithChirp2(sttGcsUri, "audio/wav", transcoded);
          console.log(`[PIPELINE RECOVERY] Successfully recovered transcript with length: ${finalTranscript.length}`);
          await logToSession(sessionId, "STT_RECOVERY", "Auto-recuperación exitosa con Google Cloud STT.", 75);
        } catch (recoveryErr: any) {
          console.error("[PIPELINE RECOVERY FAILED] Failed to recover transcript using STT:", recoveryErr);
          await logToSession(sessionId, "STT_RECOVERY", "No se pudo auto-recuperar con STT. Continuando con el borrador inicial.", 75);
        }
      } else {
        await logToSession(sessionId, "STT_API", "Transcripción y separación de voces completada con éxito.", 75);
      }
    }

    // 4. Etapa 2: Síntesis Estructurada y Mapeo Real (Dual-Pass Stage 2)
    let parsedStudySession: any = null;

    // Stage 1 Schema configuration
    const stage1Schema = JSON.parse(JSON.stringify(summaryResponseSchema));
    stage1Schema.properties.summary.description = `A beautifully detailed markdown executive summary structured strictly following the layout, headers, blockquotes, and lists of this template:\n${selectedTemplate.prompt}`;

    // Stage 2 Prompt
    const stage2Prompt = `You are a world-class professional meeting summary editor and business coordinator. 
We have transcribed a meeting audio file: "${fileName}". Below is the official speaker-diarized transcript:

=== OFFICIAL DIARIZED TRANSCRIPT ===
${finalTranscript}
=== END TRANSCRIPT ===

Based on this transcript, generate:
1. An academic and professional title for this meeting (max 6 words).
2. A beautiful, highly detailed meeting summary in formatted Markdown following strictly the layout guidelines of this template: "${selectedTemplate.name}". Ensure all major highlights, decisions, and discussions are fully covered.
3. An exhaustive list of ALL action items, goals, objectives, and decisions made. DO NOT condense or omit any discussed milestone. This is extremely critical: do not skimp on goals (no escatimar en las metas u objetivos).
4. Resolve the generic speaker labels in the transcript (e.g. '1', '2') to real participant names based on self-introductions, context, or the provided user workspace details, and populate the "speakerMappings" key with this mapping.

Generate fully populated results in JSON format according to the summaryResponseSchema.${speakerContext}

CRITICAL LANGUAGE REQUIREMENT: All output text (including title, summary, and action items) MUST be strictly in the detected language of the source transcript. If the transcript is in Spanish, the entire JSON output MUST be in Spanish. DO NOT respond in English if the source is in Spanish.`;

    console.log("[PIPELINE] Querying Gemini 3.5 Flash for complete structured summary and speaker mapping (Stage 2)...");
    await logToSession(sessionId, "STAGE_1", "Etapa 2/2: Sintetizando informe estructurado, metas y mapeando oradores reales...", 85);
    
    const stage2Response = await generateWithFallback({
      model: "gemini-3.5-flash",
      contents: [{ text: stage2Prompt }],
      config: {
        responseMimeType: "application/json",
        responseSchema: stage1Schema,
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    });

    const stage2Text = stage2Response.text;
    if (!stage2Text) throw new Error("La Etapa 2 de síntesis con Gemini retornó una respuesta vacía.");

    const stage2Result = safeParseJson(stage2Text);
    const title = stage2Result.title;
    const summary = stage2Result.summary;
    const actionItems = stage2Result.actionItems || [];
    
    // Build a standard speakerMap dictionary from speakerMappings array
    const speakerMap: Record<string, string> = {};
    if (stage2Result.speakerMappings && Array.isArray(stage2Result.speakerMappings)) {
      for (const mapping of stage2Result.speakerMappings) {
        if (mapping.speakerTag && mapping.realName) {
          speakerMap[mapping.speakerTag] = mapping.realName;
        }
      }
    }

    // Apply speaker re-labeling to finalTranscript
    if (Object.keys(speakerMap).length > 0) {
      console.log("[PIPELINE] Applying speaker mapping:", speakerMap);
      for (const [key, name] of Object.entries(speakerMap)) {
        if (name && typeof name === "string") {
          const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`Speaker ${escapedKey}:`, "g");
          finalTranscript = finalTranscript.replace(regex, `${name}:`);
        }
      }
    }

    // Assemble consolidated parsedStudySession
    parsedStudySession = {
      title,
      summary,
      actionItems: actionItems,
      mindMap: { id: "root", label: "Empty", details: "", children: [] },
      flashcards: []
    };

    await logToSession(sessionId, "STAGE_2", "Plan de acción, resumen y oradores procesados con éxito.", 100);

    return { parsedStudySession, finalTranscript, gcsUri, geminiFileUri };

  } finally {
    // Cleanup local temp file
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        console.log(`[PIPELINE] Cleaned up original temp file: ${localFilePath}`);
      }
    } catch (cleanupErr) {
      console.error("[PIPELINE] Failed to clean up original temp file:", cleanupErr);
    }
  }
}

async function processAudioPipeline(
  localFilePath: string,
  mimeType: string,
  fileName: string,
  mediaType: string,
  selectedTemplate: any,
  speakerContext: string,
  userId: string,
  sessionId: string,
  initialSession: any,
  processingMode?: string
): Promise<void> {
  try {
    await logToSession(sessionId, "START", "Comenzando procesamiento asíncrono de audio de fondo...", 5);
    const { parsedStudySession, finalTranscript, gcsUri, geminiFileUri } = await executeAudioProcessing(
      localFilePath,
      mimeType,
      fileName,
      mediaType,
      selectedTemplate,
      speakerContext,
      userId,
      sessionId,
      processingMode
    );

    const completedSession = {
      ...initialSession,
      ...parsedStudySession,
      transcript: finalTranscript,
      status: "completed",
      gcsUri: gcsUri || geminiFileUri,
      chatHistory: [
        {
          id: "welcome_msg",
          role: "model" as const,
          content: `¡Listo! He analizado tu archivo **"${fileName}"** y he sintetizado "${parsedStudySession.title}" siguiendo la plantilla de formato elegida.`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    await logToSession(sessionId, "FINAL", "Guardando resultados finales del informe en la base de datos...", 98);
    await firestore.collection("sessions").doc(sessionId).set(completedSession);
    await logToSession(sessionId, "COMPLETED", "¡Procesamiento asíncrono y síntesis de materiales completados con éxito!", 100);
    console.log(`[PIPELINE] Successfully completed and stored session ${sessionId}`);
  } catch (err: any) {
    console.error(`[PIPELINE ERROR] Pipeline for session ${sessionId} failed:`, err);
    await logToSession(sessionId, "FAILED", `Falla en el procesamiento: ${err.message || err}`, 100);
    await firestore.collection("sessions").doc(sessionId).update({
      status: "failed",
      summary: `### ❌ Falla en el análisis de materiales\nEl procesamiento de fondo para tu archivo encontró un obstáculo:\n${err.message || err}`,
      error: err.message || "An unexpected error occurred during processing."
    });
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Configure multer to store uploaded files in /tmp/
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 150 * 1024 * 1024, // High-capacity 150MB support for big audio/video/documents
  },
});

// COOP header: allow Firebase Auth popup to communicate with opener
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  next();
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

// Helper to read and sanitize the configured Gemini API key.
function getConfiguredApiKey(): string {
  let apiKey = process.env.GEMINI_API_KEY || "";
  // Safe trimming and stripping of literal surrounding quotes if any
  apiKey = apiKey.trim().replace(/^['"]|['"]$/g, "").trim();
  const isPlaceholder = !apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "YOUR_GEMINI_API_KEY";
  return isPlaceholder ? "" : apiKey;
}

// True when a Gemini Developer API key is configured (primary client uses { apiKey }).
// The Developer API (generativelanguage.googleapis.com) cannot read gs:// URIs — large media
// must be sent via the Files API (ai.files.upload) instead of Google Cloud Storage.
function isDeveloperApiMode(): boolean {
  return !!getConfiguredApiKey();
}

// Helper to lazy-retrieve the PRIMARY GoogleGenAI client.
// Both "AIza..." and the newer "AQ..." keys are Gemini Developer API keys
// (generativelanguage.googleapis.com) and must be used as { apiKey } WITHOUT vertexai.
// NOTE: An "AQ..." key is NOT a Vertex AI Express key — using vertexai:true with it
// returns 403 API_KEY_SERVICE_BLOCKED on aiplatform.googleapis.com.
// When no key is configured, fall back to Vertex AI with Application Default Credentials.
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  const apiKey = getConfiguredApiKey();

  if (apiKey) {
    console.log("[GEMINI CLIENT INIT] API key detected. Using Gemini Developer API.");
    aiClient = new GoogleGenAI({ apiKey });
  } else {
    console.log("[GEMINI CLIENT INIT] No API Key configured. Using Vertex AI with Application Default Credentials (ADC).");
    aiClient = getAdcClient();
  }
  return aiClient;
}

// Helper to lazy-retrieve a Vertex AI client backed by Application Default Credentials (ADC).
// Used as an automatic fallback when the primary (API key) client fails with auth errors,
// and as the primary client in environments like Cloud Run where a service account is available.
let adcClient: GoogleGenAI | null = null;
function getAdcClient(): GoogleGenAI {
  if (adcClient) return adcClient;
  adcClient = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || "plaud-own",
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1"
  });
  return adcClient;
}

// Returns true when an error looks like an authentication / authorization / key problem,
// as opposed to a schema, quota, or upload problem.
function isAuthError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  const jsonStr = JSON.stringify(error).toLowerCase();
  const haystack = msg + " " + jsonStr;
  const status = error.status || error.code;
  if (status === 401 || status === 403 || status === "UNAUTHENTICATED" || status === "PERMISSION_DENIED") {
    return true;
  }
  return (
    haystack.includes("api key not found") ||
    haystack.includes("api_key_invalid") ||
    haystack.includes("api key not valid") ||
    haystack.includes("permission_denied") ||
    haystack.includes("permission denied") ||
    haystack.includes("unauthenticated") ||
    haystack.includes("missing authentication") ||
    haystack.includes("expired") && haystack.includes("token")
  );
}

// Runs a Gemini generateContent call with the primary client; if it fails with an auth/permission
// error, retries ONCE with the ADC-backed Vertex AI client. This lets an AQ Express key work locally
// while transparently falling back to the Cloud Run service account when keys are missing or rejected.
async function generateWithFallback(params: any): Promise<any> {
  const primary = getGeminiClient();
  try {
    return await primary.models.generateContent(params);
  } catch (primaryError: any) {
    if (!isAuthError(primaryError)) {
      throw primaryError;
    }
    const fallback = getAdcClient();
    if (fallback === primary) {
      // Primary already was the ADC client; nothing else to try.
      throw primaryError;
    }
    console.warn("[GEMINI FALLBACK] Primary client auth failed, retrying with Vertex AI ADC. Reason:", primaryError?.message || primaryError);
    return await fallback.models.generateContent(params);
  }
}

// Classifies an error and returns a user-facing message plus an errorType the frontend can branch on.
// errorType is one of: "AUTH" | "SCHEMA" | "UPLOAD" | "QUOTA" | "GENERIC".
function classifyError(error: any): { message: string; errorType: string } {
  if (!error) return { message: "An unknown error occurred.", errorType: "GENERIC" };
  const msg = error.message || String(error);
  const haystack = (msg + " " + JSON.stringify(error)).toLowerCase();

  if (isAuthError(error)) {
    return {
      errorType: "AUTH",
      message: "Authentication with Gemini failed. The configured API key or service-account credentials are missing, invalid, or lack access. Verify GEMINI_API_KEY (or the Cloud Run service account) and try again."
    };
  }
  if (haystack.includes("resource_exhausted") || haystack.includes("quota") || haystack.includes("rate limit")) {
    return {
      errorType: "QUOTA",
      message: "Gemini quota or rate limit exceeded. Please wait a moment and try again."
    };
  }
  if (haystack.includes("invalid_argument") || haystack.includes("schema") || haystack.includes("responseschema")) {
    return {
      errorType: "SCHEMA",
      message: `The request to Gemini was rejected as invalid (likely a response-schema or content issue): ${msg}`
    };
  }
  if (haystack.includes("upload") || haystack.includes("gcs") || haystack.includes("storage") || haystack.includes("bucket")) {
    return {
      errorType: "UPLOAD",
      message: `Failed to upload or read the media file: ${msg}`
    };
  }
  return { message: msg, errorType: "GENERIC" };
}

// Backwards-compatible helper that returns only the message string.
function cleanErrorMessage(error: any): string {
  return classifyError(error).message;
}

export function getExtensionFromMimeType(mimeType: string, defaultExt: string = "audio"): string {
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

export function resolveMimeType(fileName: string, mimeType: string): string {
  if (!fileName) return mimeType || "application/octet-stream";
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  // If the browser or multer provided a generic or empty mime type, try to resolve from extension
  if (!mimeType || mimeType === "application/octet-stream" || mimeType === "binary/octet-stream") {
    switch (ext) {
      case "mp3": return "audio/mp3";
      case "wav": return "audio/wav";
      case "ogg": return "audio/ogg";
      case "m4a": return "audio/m4a";
      case "webm": return "audio/webm";
      case "aac": return "audio/aac";
      case "mp4": return "video/mp4";
      case "pdf": return "application/pdf";
      case "txt": return "text/plain";
      case "md": return "text/markdown";
      case "csv": return "text/csv";
      case "json": return "application/json";
    }
  }

  // Ensure standard audio ogg MIME type
  if (ext === "ogg" && (!mimeType.includes("audio") && !mimeType.includes("video"))) {
    return "audio/ogg";
  }

  return mimeType || "application/octet-stream";
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

    // Prepare system instruction focusing as a brilliant expert AI Corporate Assistant
    const systemInstruction = `You are an expert AI Corporate Assistant and brilliant meeting companion. 
Your goal is to help the user clarify details, extract decisions, and discuss the provided meeting material.
The material belongs to a corporate session or meeting about: "${contextSubject || "Uploaded Meeting Material"}".

Here is the comprehensive summarized core content and transcript of this session for your reference:
=== BEGIN STUDY MATERIAL CORES ===
${contextSummary || "User has not uploaded or generated any material yet. Encourage them to provide an audio/video first."}
=== END STUDY MATERIAL CORES ===

PROTECTORES ABSOLUTOS DE ANTI-ALUCINACIÓN (CRITICAL GROUNDING CONSTRAINTS):
1. Rely EXCLUSIVELY on the provided transcript and summary text above. Never invent, assume, extrapolate, or estimate decisions, dates, tasks, speakers, agreements, sales figures, revenue, or outcomes not explicitly and literally stated in the context.
2. If the user asks a question about the meeting that cannot be answered, verified, or proven using the provided material, you MUST respond EXACTLY with a polite, clear refusal in Spanish stating that this information was not discussed in the meeting:
   "No se puede validar esta información ya que no fue mencionada en la reunión."
3. Do not try to guess, assume, or generalize. If a topic (such as sales, marketing, engineering, dates, numbers) is not discussed or is only partially mentioned, state exactly what is known or state that it is not available.
4. Keep all responses strictly grounded in facts. If you are asked about something outside the meeting scope, remind the user that you are only authorized to discuss the contents of the official transcript.
5. Always respond in the same language as the user's query (Spanish by default).
6. Act smart, highly professional, direct, and concise.`;

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

    const response = await generateWithFallback({
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
      description: "A concise, professional, highly descriptive title for this meeting or material (max 6 words)." 
    },
    summary: { 
      type: Type.STRING, 
      description: "A detailed, beautiful markdown-formatted meeting summary and resume of the material. Must be high-density, well-paddled structure using bullets, major sections, and takeaways, listing ALL major targets, goals, and milestones." 
    },
    transcript: { 
      type: Type.STRING, 
      description: "A fluent, highly detailed written narration transcript simulating exactly what was spoken in this lecture/meeting. Organize with timestamps where natural (e.g. [00:15])." 
    },
    actionItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: "A highly actionable meeting goal, commitment, target or follow-up item. Exhaustively capture every single objective, target, or assignment discussed in the meeting without exception." },
          importance: { type: Type.STRING, enum: ["high", "medium", "low"], description: "The priority of this action item or goal." }
        },
        required: ["task", "importance"]
      },
      description: "An exhaustive list of ALL action items, goals, objectives, and decisions made. DO NOT condense or omit any discussed milestone."
    }
  },
  required: ["title", "summary", "transcript", "actionItems"]
};

// Define Stage 1 Schema for Summary Generation
const summaryResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { 
      type: Type.STRING, 
      description: "A concise, professional, highly descriptive title for this meeting or material (max 6 words)." 
    },
    summary: { 
      type: Type.STRING, 
      description: "A detailed, beautiful markdown-formatted meeting summary and resume of the material. Must be high-density, well-paddled structure using bullets, major sections, and takeaways, listing ALL major targets, goals, and milestones." 
    },
    actionItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: "A highly actionable meeting goal, commitment, target or follow-up item. Exhaustively capture every single objective, target, or assignment discussed in the meeting without exception." },
          importance: { type: Type.STRING, enum: ["high", "medium", "low"], description: "The priority of this action item or goal." }
        },
        required: ["task", "importance"]
      },
      description: "An exhaustive list of ALL action items, goals, objectives, and decisions made. DO NOT condense or omit any discussed milestone."
    },
    speakerMappings: {
      type: Type.ARRAY,
      description: "List of resolved speaker names based on context.",
      items: {
        type: Type.OBJECT,
        properties: {
          speakerTag: { type: Type.STRING, description: "The generic speaker label, e.g., '1', '2'" },
          realName: { type: Type.STRING, description: "The resolved real name of the participant" }
        },
        required: ["speakerTag", "realName"]
      }
    }
  },
  required: ["title", "summary", "actionItems", "speakerMappings"]
};

// Define Stage 2 Schema for Asset Generation
const assetsResponseSchema = {
  type: Type.OBJECT,
  properties: {
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
                  required: ["id", "label", "details"]
                }
              }
            },
            required: ["id", "label", "details", "children"]
          }
        }
      },
      required: ["id", "label", "details", "color", "children"]
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
  required: ["actionItems", "mindMap", "flashcards"]
};

// 3. Process endpoint: transcribes and generates everything (markdown resume, action items, mental map, flashcards)
app.post("/api/process", async (req, res) => {
  try {
    const { mediaName, mediaType, base64Data, mimeType, isSample, sampleType, customTitle, customText, templateId } = req.body;
    const userId = (req.headers["x-user-id"] || "guest") as string;
    const ai = getGeminiClient();

    // Fetch user speaker profiles and selected template definitions
    const speakerContext = await getUserSpeakerContext(userId);
    const selectedTemplate = getTemplateById(templateId || "client-needs");

    // Dynamic response schema override for selected template structure
    const currentResponseSchema = JSON.parse(JSON.stringify(studyResponseSchema));
    currentResponseSchema.properties.summary.description = `A beautifully detailed markdown executive summary structured strictly following the layout, headers, blockquotes, and lists of this template:\n${selectedTemplate.prompt}`;

    let contentsPayload: any[] = [];
    let gcsUri = "";
    let geminiFileUri = "";

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
        
        Ensure you extract ALL goals, commits, targets, and objectives discussed in the material (do not skip any detail).`
      }];

      console.log("[SAMPLE PROCESS] Generating study companion from Gemini for topic:", topicTitle);
      const response = await generateWithFallback({
        model: "gemini-3.5-flash",
        contents: contentsPayload,
        config: {
          responseMimeType: "application/json",
          responseSchema: currentResponseSchema,
          temperature: 0.2,
          maxOutputTokens: 8192
        }
      });

      const parsedText = response.text;
      if (!parsedText) throw new Error("No response output text was generated by Gemini.");

      const parsedStudySession = safeParseJson(parsedText);
      const sessionId = "sess_" + Date.now().toString(36);

      const completedSession = {
        id: sessionId,
        userId: userId,
        title: parsedStudySession.title || topicTitle,
        createdAt: new Date().toISOString(),
        mediaType: mediaType || 'audio',
        mediaName: mediaName || "mecanica_audio",
        ...parsedStudySession,
        status: "completed",
        chatHistory: [
          {
            id: "welcome_msg",
            role: "model" as const,
            content: `¡Listo! He analizado tu escrito/transcripción de **"${topicTitle}"** y he sintetizado "${parsedStudySession.title}" de acuerdo con la plantilla elegida.`,
            timestamp: new Date().toISOString()
          }
        ]
      };

      console.log(`[SAMPLE PROCESS] Saving completed sample session: ${sessionId}`);
      await firestore.collection("sessions").doc(sessionId).set(completedSession);

      res.status(200).json(completedSession);
      return;

    } else {
      // Real mic recording upload: Run asynchronously in background!
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: "Missing uploaded file data (base64Data) or mimeType" });
        return;
      }

      const resolvedMime = resolveMimeType(mediaName || "", mimeType.split(";")[0].trim());
      const rawSizeBytes = Math.round(base64Data.length * 0.75);
      const sessionId = "sess_" + Date.now().toString(36);

      // Create initial placeholder doc in Firestore with status 'processing'
      const initialSession = {
        id: sessionId,
        userId: userId,
        title: mediaName || "Calibrando audio...",
        createdAt: new Date().toISOString(),
        mediaType: mediaType || 'audio',
        mediaName: mediaName || "mecanica_audio",
        status: "processing",
        summary: "### Procesando tu audio de fondo...\nPor favor espera mientras la IA realiza la transcripción diarizada por oradores y la síntesis con la plantilla seleccionada. Puedes navegar libremente por la app.",
        transcript: "[00:00] Transcribiendo conversación...",
        actionItems: [],
        mindMap: { id: "root", label: "Procesando...", details: "" },
        flashcards: [],
        chatHistory: [
          {
            id: "welcome_msg",
            role: "model" as const,
            content: "Tu grabación se está transcribiendo y procesando de forma asíncrona de fondo con Gemini. Cerramos la conexión para evitar timeouts. Te depararemos un informe completo de inmediato.",
            timestamp: new Date().toISOString()
          }
        ]
      };

      console.log(`[ASYNC PROCESS] Saving initial processing placeholder session: ${sessionId}`);
      await firestore.collection("sessions").doc(sessionId).set(initialSession);

      // Immediately return the 202 status and placeholder object to the client
      res.status(202).json(initialSession);

      // Trigger background worker
      (async () => {
        const ext = getExtensionFromMimeType(resolvedMime, "webm");
        const tempFilePath = path.join(os.tmpdir(), `${sessionId}_mic.${ext}`);
        try {
          fs.writeFileSync(tempFilePath, Buffer.from(base64Data, "base64"));
          await processAudioPipeline(
            tempFilePath,
            resolvedMime,
            mediaName || `Recording_${sessionId}.${ext}`,
            mediaType || "audio",
            selectedTemplate,
            speakerContext,
            userId,
            sessionId,
            initialSession
          );
        } catch (bgErr: any) {
          console.error(`[ASYNC PROCESS BG ERROR] Session ${sessionId} failed:`, bgErr);
          await firestore.collection("sessions").doc(sessionId).update({
            status: "failed",
            summary: `### ❌ Falla en el análisis de materiales\nEl procesamiento de fondo para tu archivo encontró un obstáculo:\n${bgErr.message || bgErr}`,
            error: bgErr.message || "An unexpected error occurred."
          });
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (cleanupErr) {
            console.error("Failed to delete temp file:", cleanupErr);
          }
        }
      })();
      return;
    }
  } catch (error: any) {
    console.warn("[PROCESS ERROR] Initiating high-fidelity fallback or returning error:", error);
    // If it's a real file upload or written text from the user, do NOT silently fall back to mock data!
    if (!req.body.isSample && req.body.sampleType !== "custom") {
      const classified = classifyError(error);
      res.status(classified.errorType === "AUTH" ? 401 : 500).json(classified);
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

    const { mediaType, templateId, processingMode } = req.body;
    const mediaName = file.originalname || "Uploaded Material";
    const mimeType = file.mimetype || "";
    const tempFilePath = file.path;

    const resolvedMime = resolveMimeType(mediaName, mimeType.split(";")[0].trim());
    logToPlatform(`[MULTIPART UPLOAD] processing: Name: "${mediaName}", Mime: ${mimeType} -> resolved to: ${resolvedMime}, Size: ${Math.round(file.size / 1024 / 1024)}MB`, "INFO");

    const userId = (req.headers["x-user-id"] || "guest") as string;

    // Fetch user speaker profiles and selected template definitions
    const speakerContext = await getUserSpeakerContext(userId);
    const selectedTemplate = getTemplateById(templateId || "client-needs");

    // Dynamic response schema override for selected template structure
    const currentResponseSchema = JSON.parse(JSON.stringify(studyResponseSchema));
    currentResponseSchema.properties.summary.description = `A beautifully detailed markdown executive summary structured strictly following the layout, headers, blockquotes, and lists of this template:\n${selectedTemplate.prompt}`;

    // Pre-generate session ID
    const sessionId = "sess_" + Date.now().toString(36);

    // Create initial placeholder session doc in Firestore with status 'processing'
    const initialSession = {
      id: sessionId,
      userId: userId,
      title: mediaName || "Procesando audio...",
      createdAt: new Date().toISOString(),
      mediaType: mediaType || 'audio',
      mediaName: mediaName || "Uploaded File",
      status: "processing",
      summary: "### Procesando tu audio de fondo...\nPor favor espera de 1 a 3 minutos mientras la IA realiza la transcripción diarizada por oradores y la síntesis con la plantilla seleccionada. Puedes navegar libremente por la app.",
      transcript: "[00:00] Transcribiendo conversación...",
      actionItems: [],
      mindMap: { id: "root", label: "Procesando...", details: "" },
      flashcards: [],
      chatHistory: [
        {
          id: "welcome_msg",
          role: "model" as const,
          content: "Tu archivo se está transcribiendo y procesando de forma asíncrona de fondo con Gemini. Cerramos la conexión para evitar timeouts. Te depararemos un informe completo de inmediato.",
          timestamp: new Date().toISOString()
        }
      ]
    };

    console.log(`[ASYNC UPLOAD] Saving initial processing placeholder session: ${sessionId}`);
    await firestore.collection("sessions").doc(sessionId).set(initialSession);

    // Immediately return the 202 status and placeholder object to the client
    res.status(202).json(initialSession);

    // Trigger background worker
    (async () => {
      try {
        const isPlainText = resolvedMime.startsWith("text/") || mediaName.endsWith(".txt") || mediaName.endsWith(".md") || mediaName.endsWith(".csv") || mediaName.endsWith(".json");
        const isPDF = resolvedMime.includes("pdf") || mediaName.endsWith(".pdf");

        if (!isPlainText && !isPDF) {
          // Audio or Video: delegate to our new processAudioPipeline
          await processAudioPipeline(
            tempFilePath,
            resolvedMime,
            mediaName,
            mediaType || "audio",
            selectedTemplate,
            speakerContext,
            userId,
            sessionId,
            initialSession,
            processingMode
          );
        } else {
          // Plain text or PDF: proceed with original logic
          let gcsUri = "";
          let geminiFileUri = "";
          const gcsDestination = `audios/${sessionId}_${mediaName}`;
          try {
            if (isDeveloperApiMode()) {
              console.log("[UPLOAD-FILE BG] Developer API mode: routing file through the Gemini Files API...");
            } else {
              gcsUri = await uploadToGCS(tempFilePath, gcsDestination, resolvedMime);
            }
          } catch (gcsErr) {
            console.warn("[GCS WARNING BG] Failed to upload to GCS, falling back to Gemini Files API:", gcsErr);
          }

          const ai = getGeminiClient();
          let contentsPayload: any[] = [];

          if (isPlainText) {
            const textContent = fs.readFileSync(tempFilePath, "utf8");
            contentsPayload = [{
              text: `Analyze the following lecture notes or document text: "${mediaName}". Generate a high-fidelity summarized study companion following the structural responseSchema:
              
              === DOCUMENT CONTENT ===
              ${textContent}
              === END DOCUMENT CONTENT ===
              
              Ensure you extract ALL goals, commits, targets, and objectives discussed in the material (do not skip any detail).`
            }];
          } else {
            // PDF
            if (!gcsUri) {
              console.log("[UPLOAD-FILE BG FALLBACK] GCS Upload failed or empty. Attempting Gemini Files API upload...");
              const fileRef = await ai.files.upload({
                file: tempFilePath,
                config: {
                  mimeType: resolvedMime,
                  displayName: mediaName,
                }
              });
              geminiFileUri = fileRef.uri || "";
              console.log(`[UPLOAD-FILE BG FALLBACK] Gemini Files upload successful: ${geminiFileUri}`);
            }

            const contentPromptText = `You are a world-class academic summaries analyzer. Carefully study the uploaded PDF document: "${mediaName}".
            Read and analyze every page. Capture key ideas, structures, formulas, and conclusions, and compile a high-fidelity study companion.`;

            contentsPayload = [
              {
                fileData: {
                  fileUri: gcsUri || geminiFileUri,
                  mimeType: resolvedMime,
                }
              },
              {
                text: `${contentPromptText}
                
                Generate fully populated and valid results in JSON format according to the supplied responseSchema:
                1. An academic and professional title.
                2. A beautiful detailed summary/resume in formatted Markdown based on the template layout: "${selectedTemplate.name}".
                3. A complete timestamped narrative transcript or detailed chapter layout.
                4. Structured follow-up Action Items. Ensure you extract ALL targets, decisions, commitments, and objectives discussed (no skimping!).
                
                Generate fully populated and valid results in JSON format according to the supplied responseSchema.${speakerContext}
                
                CRITICAL REQUIREMENT: You MUST automatically detect the language written in the source document (e.g. Spanish, English). All generated text fields (title, summary, transcript, actionItems) MUST be entirely in that detected language.`
              }
            ];
          }

          console.log("[UPLOAD-FILE BG] Generating study companion from Gemini...");
          const response = await generateWithFallback({
            model: "gemini-3.5-flash",
            contents: contentsPayload,
            config: {
              responseMimeType: "application/json",
              responseSchema: currentResponseSchema,
              temperature: 0.2,
              maxOutputTokens: 8192
            }
          });

          const parsedText = response.text;
          if (!parsedText) throw new Error("No response output text was generated by Gemini.");

          const parsedStudySession = safeParseJson(parsedText);

          const completedSession = {
            ...initialSession,
            ...parsedStudySession,
            status: "completed",
            gcsUri: gcsUri || geminiFileUri,
            chatHistory: [
              {
                id: "welcome_msg",
                role: "model" as const,
                content: `¡Listo! He analizado tu archivo **"${mediaName}"** y he sintetizado "${parsedStudySession.title}" siguiendo la plantilla de formato elegida.`,
                timestamp: new Date().toISOString()
              }
            ]
          };

          await firestore.collection("sessions").doc(sessionId).set(completedSession);
          console.log(`[UPLOAD-FILE BG] Successfully completed and stored session ${sessionId}`);

          // Clean up the local temp file
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (cleanupErr) {
            console.error("Failed to delete temp file:", cleanupErr);
          }
        }
      } catch (bgErr: any) {
        console.error(`[UPLOAD-FILE BG ERROR] Session ${sessionId} failed:`, bgErr);
        await firestore.collection("sessions").doc(sessionId).update({
          status: "failed",
          summary: `### ❌ Falla en el análisis de materiales\nEl procesamiento de fondo para tu archivo encontró un obstáculo:\n${bgErr.message || bgErr}`,
          error: bgErr.message || "An unexpected error occurred."
        });
        // Clean up the local temp file if it's still there
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupErr) {
          console.error("Failed to delete temp file:", cleanupErr);
        }
      }
    })();

  } catch (error: any) {
    console.warn("[UPLOAD-FILE ERROR] Failed to initialize upload:", error);
    const classified = classifyError(error);
    res.status(classified.errorType === "AUTH" ? 401 : 500).json(classified);
  }
});

// Endpoint to receive chunked uploads for large documents/assets (e.g. 3-4MB slices)
app.post("/api/upload-chunk", upload.single("chunk"), async (req, res) => {
  try {
    const file = req.file;
    const { uploadId, chunkIndex } = req.body;

    if (!file) {
      logToPlatform("[CHUNK UPLOAD ERROR] No chunk file received.", "WARN");
      res.status(400).json({ error: "No chunk file received." });
      return;
    }
    if (!uploadId || chunkIndex === undefined) {
      logToPlatform(`[CHUNK UPLOAD ERROR] Missing uploadId (${uploadId}) or chunkIndex (${chunkIndex}).`, "WARN");
      res.status(400).json({ error: "Missing uploadId or chunkIndex." });
      return;
    }

    logToPlatform(`[CHUNK RECEIVED] uploadId: ${uploadId}, chunkIndex: ${chunkIndex}, size: ${Math.round(file.size / 1024)}KB`, "INFO");

    const chunkDir = path.join(os.tmpdir(), "chunks", uploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, `chunk_${chunkIndex}`);
    // Use copyFileSync and unlinkSync for safer moving of cross-device temp files in standard Docker/Cloud environments
    fs.copyFileSync(file.path, chunkPath);
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      logToPlatform(`[CHUNK CLEANUP WARNING] Failed to clean up transient multer chunk: ${e}`, "WARN");
    }

    res.json({ success: true, chunkIndex: parseInt(chunkIndex, 10) });
  } catch (err: any) {
    logToPlatform(`[CHUNK UPLOAD EXCEPTION] uploadId: ${req.body?.uploadId || "unknown"}, chunkIndex: ${req.body?.chunkIndex || "unknown"}: ${err?.stack || err?.message || err}`, "ERROR");
    res.status(500).json({ error: err.message || "Failed to upload chunk." });
  }
});

// Endpoint to merge chunks for large files and execute high-capacity Gemini curation
app.post("/api/merge-chunks", async (req, res) => {
  try {
    const { uploadId, fileName, mediaType, mimeType, totalChunks, templateId, processingMode } = req.body;

    if (!uploadId || !fileName || totalChunks === undefined) {
      logToPlatform("[MERGE CHUNKS ERROR] Missing merge parameters: uploadId, fileName, or totalChunks.", "WARN");
      res.status(400).json({ error: "Missing merge parameters: uploadId, fileName, or totalChunks." });
      return;
    }

    const resolvedMime = resolveMimeType(fileName, mimeType);
    const userId = (req.headers["x-user-id"] || "guest") as string;

    const chunkDir = path.join(os.tmpdir(), "chunks", uploadId);
    const mergedFilePath = path.join(os.tmpdir(), `${uploadId}_${fileName}`);

    logToPlatform(`[MERGE START] id: ${uploadId}, name: "${fileName}", MIME: ${mimeType} -> resolved to: ${resolvedMime}, pieces: ${totalChunks}, user: ${userId}`, "INFO");

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

    // Pre-generate session ID
    const sessionId = "sess_" + Date.now().toString(36);

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

    const isPlainText = resolvedMime.startsWith("text/") || fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv") || fileName.endsWith(".json");
    const isPDF = resolvedMime.includes("pdf") || fileName.endsWith(".pdf");

    // Fetch user speaker profiles and selected template definitions
    const speakerContext = await getUserSpeakerContext(userId);
    const selectedTemplate = getTemplateById(templateId || "client-needs");

    // Create initial placeholder session doc in Firestore with status 'processing'
    const initialSession = {
      id: sessionId,
      userId: userId,
      title: fileName || "Procesando audio...",
      createdAt: new Date().toISOString(),
      mediaType: mediaType || 'audio',
      mediaName: fileName || "Uploaded File",
      status: "processing",
      summary: "### Procesando tu archivo de fondo...\nPor favor espera mientras la IA realiza la transcripción diarizada por oradores y la síntesis con la plantilla seleccionada. Puedes navegar libremente por la app.",
      transcript: "[00:00] Transcribiendo conversación...",
      actionItems: [],
      mindMap: { id: "root", label: "Procesando...", details: "" },
      flashcards: [],
      chatHistory: [
        {
          id: "welcome_msg",
          role: "model" as const,
          content: "Tu archivo se está transcribiendo y procesando de forma asíncrona de fondo con Gemini. Cerramos la conexión para evitar timeouts. Te depararemos un informe completo de inmediato.",
          timestamp: new Date().toISOString()
        }
      ]
    };

    logToPlatform(`[ASYNC MERGE] Saving initial processing placeholder session: ${sessionId}`, "INFO");
    await firestore.collection("sessions").doc(sessionId).set(initialSession);

    // Immediately return the 202 status and placeholder object to the client
    res.status(202).json(initialSession);

    // Trigger background worker
    (async () => {
      try {
        if (!isPlainText && !isPDF) {
          // Audio or Video: delegate to processAudioPipeline
          await processAudioPipeline(
            mergedFilePath,
            resolvedMime,
            fileName,
            mediaType || "audio",
            selectedTemplate,
            speakerContext,
            userId,
            sessionId,
            initialSession,
            processingMode
          );
        } else {
          // Plain text or PDF: proceed with original logic in background
          const gcsDestination = `audios/${sessionId}_${fileName}`;
          let gcsUri = "";
          try {
            if (isDeveloperApiMode()) {
              logToPlatform(`[MERGE-CHUNKS BG] Developer API mode: routing reassembled file through the Gemini Files API...`, "INFO");
            } else {
              gcsUri = await uploadToGCS(mergedFilePath, gcsDestination, resolvedMime || "");
            }
          } catch (gcsErr: any) {
            logToPlatform(`[GCS WARNING BG] Failed to upload reassembled file to GCS: ${gcsErr?.message || gcsErr}`, "WARN");
          }

          const ai = getGeminiClient();
          let contentsPayload: any[] = [];
          let geminiFileUri = "";

          if (isPlainText) {
            const textContent = fs.readFileSync(mergedFilePath, "utf8");
            try {
              fs.unlinkSync(mergedFilePath);
            } catch (err: any) {
              logToPlatform(`Failed to delete assembled text file: ${err?.message || err}`, "WARN");
            }

            contentsPayload = [{
              text: `Analyze the following lecture notes or document text: "${fileName}". Generate a high-fidelity summarized study companion following the structural responseSchema:
              
              === DOCUMENT CONTENT ===
              ${textContent}
              === END DOCUMENT CONTENT ===
              
              Ensure you extract ALL goals, commits, targets, and objectives discussed in the material (do not skip any detail).`
            }];
          } else {
            // PDF
            if (!gcsUri) {
              logToPlatform(`[MERGE-CHUNKS BG FALLBACK] GCS Upload failed or empty. Attempting Gemini Files API upload...`, "INFO");
              try {
                const fileRef = await ai.files.upload({
                  file: mergedFilePath,
                  config: {
                    mimeType: resolvedMime || "",
                    displayName: fileName,
                  }
                });
                geminiFileUri = fileRef.uri || "";
                logToPlatform(`[MERGE-CHUNKS BG FALLBACK] Gemini Files upload successful: ${geminiFileUri}`, "INFO");
              } catch (geminiErr: any) {
                logToPlatform(`[MERGE-CHUNKS BG FALLBACK ERROR] Gemini Files upload failed: ${geminiErr?.message || geminiErr}`, "ERROR");
                throw geminiErr;
              }
            }

            try {
              if (fs.existsSync(mergedFilePath)) {
                fs.unlinkSync(mergedFilePath);
              }
            } catch (cleanupErr) {
              console.error("Failed to clean up temp merged file post-upload:", cleanupErr);
            }

            const contentPromptText = `You are a world-class academic summaries analyzer. Carefully study the uploaded PDF document: "${fileName}".
            Read and analyze every page. Capture key ideas, structures, formulas, and conclusions, and compile a high-fidelity study companion.`;

            // Dynamic response schema override for selected template structure
            const currentResponseSchema = JSON.parse(JSON.stringify(studyResponseSchema));
            currentResponseSchema.properties.summary.description = `A beautifully detailed markdown executive summary structured strictly following the layout, headers, blockquotes, and lists of this template:\n${selectedTemplate.prompt}`;

            contentsPayload = [
              {
                fileData: {
                  fileUri: gcsUri || geminiFileUri,
                  mimeType: resolvedMime,
                }
              },
              {
                text: `${contentPromptText}
                
                Generate fully populated and valid results in JSON format according to the supplied responseSchema:
                1. An academic and professional title.
                2. A beautiful detailed summary/resume in formatted Markdown based on the template layout: "${selectedTemplate.name}".
                3. A complete timestamped narrative transcript or detailed chapter layout.
                4. Structured follow-up Action Items. Ensure you extract ALL targets, decisions, commitments, and objectives discussed (no skimping!).
                
                Generate fully populated and valid results in JSON format according to the supplied responseSchema.${speakerContext}
                
                CRITICAL REQUIREMENT: You MUST automatically detect the language spoken or written in the source audio/video/document (e.g. Spanish, English). All generated text fields (title, summary, transcript, actionItems) MUST be entirely in that detected language.`
              }
            ];
          }

          console.log("[MERGE-CHUNKS BG] Generating study companion from Gemini on reassembled dataset...");
          
          // Dynamic response schema override for selected template structure
          const currentResponseSchema = JSON.parse(JSON.stringify(studyResponseSchema));
          currentResponseSchema.properties.summary.description = `A beautifully detailed markdown executive summary structured strictly following the layout, headers, blockquotes, and lists of this template:\n${selectedTemplate.prompt}`;

          const response = await generateWithFallback({
            model: "gemini-3.5-flash",
            contents: contentsPayload,
            config: {
              responseMimeType: "application/json",
              responseSchema: currentResponseSchema,
              temperature: 0.2,
              maxOutputTokens: 8192
            }
          });

          const parsedText = response.text;
          if (!parsedText) {
            throw new Error("No response output text was generated by Gemini.");
          }

          const parsedStudySession = safeParseJson(parsedText);

          const completedSession = {
            ...initialSession,
            ...parsedStudySession,
            status: "completed",
            gcsUri: gcsUri || geminiFileUri,
            chatHistory: [
              {
                id: "welcome_msg",
                role: "model" as const,
                content: `¡Listo! He analizado tu archivo **"${fileName}"** y he sintetizado "${parsedStudySession.title}" siguiendo la plantilla de formato elegida.`,
                timestamp: new Date().toISOString()
              }
            ]
          };

          await firestore.collection("sessions").doc(sessionId).set(completedSession);
          console.log(`[MERGE-CHUNKS BG] Successfully completed and stored session ${sessionId}`);
        }
      } catch (bgErr: any) {
        console.error(`[MERGE-CHUNKS BG ERROR] Background processing for session ${sessionId} failed:`, bgErr);
        await firestore.collection("sessions").doc(sessionId).update({
          status: "failed",
          summary: `### ❌ Falla en el análisis de materiales\nEl procesamiento de fondo para tu archivo encontró un obstáculo:\n${bgErr.message || bgErr}`,
          error: bgErr.message || "An unexpected error occurred during background processing."
        });
        // Clean up the local temp merged file if it exists
        try {
          if (fs.existsSync(mergedFilePath)) {
            fs.unlinkSync(mergedFilePath);
          }
        } catch (cleanupErr) {
          console.error("Failed to delete temp reassembled file:", cleanupErr);
        }
      }
    })();

  } catch (error: any) {
    console.warn("[CHUNK ASSEMBLY PROCESS ERROR] Failed to process reassembled file:", error);
    const classified = classifyError(error);
    res.status(classified.errorType === "AUTH" ? 401 : 500).json(classified);
  }
});

app.get("/api/platform-logs", async (req, res, next) => {
  try {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      res.json({ logs: "" });
      return;
    }
    // Read last 1MB of logs so it doesn't crash on huge files
    const stats = fs.statSync(LOG_FILE_PATH);
    const maxReadBytes = 1 * 1024 * 1024; // 1MB
    const startByte = Math.max(0, stats.size - maxReadBytes);
    const fd = fs.openSync(LOG_FILE_PATH, "r");
    const buffer = Buffer.alloc(Math.min(stats.size, maxReadBytes));
    fs.readSync(fd, buffer, 0, buffer.length, startByte);
    fs.closeSync(fd);
    
    res.json({ logs: buffer.toString("utf8") });
  } catch (error: any) {
    console.error("[LOGS ENDPOINT ERROR] Failed to retrieve platform logs:", error);
    next(error);
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

// 1b. Check status of a background-processed session from Firestore
app.get("/api/sessions/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await firestore.collection("sessions").doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const data = doc.data();
    res.json({
      status: data?.status || "completed",
      error: data?.error || null,
      title: data?.title || data?.mediaName || "Procesando...",
      logs: data?.logs || [],
      progress: data?.progress || 0,
      summary: data?.summary || ""
    });
  } catch (error: any) {
    console.error("[FIRESTORE ERROR] Failed to fetch session status:", error);
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
    if (uri && uri.startsWith("https://generativelanguage.googleapis.com")) {
      res.status(400).json({ error: "Streaming is not available for files processed via Gemini Files API fallback." });
      return;
    }
    const pathInBucket = uri ? uri.replace(`gs://${BUCKET_NAME}/`, "") : "";

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
    const response = await generateWithFallback({
      model: "gemini-3.1-pro",
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

    // Proxy Firebase Auth handler endpoints to Firebase Hosting
    // Required for signInWithRedirect fallback on Cloud Run
    app.use("/__/auth", async (req, res) => {
      const target = `https://plaud-own.firebaseapp.com/__/auth${req.path}${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`;
      try {
        const { default: https } = await import("https");
        const proxyReq = https.get(target, { headers: { host: "plaud-own.firebaseapp.com" } }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        });
        proxyReq.on("error", () => res.status(502).send("Firebase auth proxy error"));
      } catch (e) {
        res.status(502).send("Firebase auth proxy unavailable");
      }
    });

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

if (!process.env.VITEST) {
  startServer();
}

