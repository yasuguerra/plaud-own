# ARCHITECTURAL AUDIT, SLOW-LOADING DEPRECATION & ANTI-HALLUCINATION PLAN (HARNESS v3.0)

**Project**: PLAUD Corporate Intelligence (PLAUD-CI)  
**Author**: [📐 Chief Engineer]  
**Approver**: [👑 CTO]  
**Status**: DRAFT (Awaiting User Approval)  
**Scope**: Remediation of slow uploads, complete removal of secondary visual bloat (Flashcards and Mind Map) to eliminate lag, high-fidelity extraction of ALL meeting goals, and absolute conversational anti-hallucination guardrails.

---

## 1. TECHNICAL AUDIT & ROOT CAUSE ANALYSIS

### Issue A: Incomplete Transcriptions and Silent Failures
*   **Root Cause**: The host environment lacks `ffmpeg`. As a result, transcoding to WAV in `server.ts` fails silently, leaving raw compressed media which Speech-to-Text V1 parses incorrectly under a LINEAR16 format, yielding empty results.
*   **Mitigation**: Use the established **Self-Healing Routing** that detects compressed formats and FFMPEG absence, bypassing STT and using high-speed Gemini Native Multimodal audio transcription directly.

### Issue B: Audio Uploads Taking Too Long or Failing
*   **Root Cause**: Frontend `src/App.tsx` uploads chunks sequentially without retry. Any minor packet loss or timeout aborts the entire upload.
*   **Mitigation**: Retain the 3-attempt retry cycle and 1.5s backoff delay in `src/App.tsx` chunk uploader.

### Issue C: High Generation Latency & Performance Degradation
*   **Root Cause**: The synthesis engine tries to generate complicated secondary assets like interactive Flashcards and hierarchical Mind Map coordinates. This requires an extra Stage 2 API call to Gemini, massive token generation, and complex JSON schemas, causing high wait times and blocking the user from reading their primary meeting transcripts.
*   **Mitigation**: **De-bloat the platform**. Completely delete/remove the Flashcards and Mind Map components from the UI, and eliminate their generation fields from the backend schema. Focus exclusively on delivering lightning-fast, high-density Meeting transcripts, Summaries, and actionable Goals.

### Issue D: Risk of AI Hallucinations in Chat Interactions
*   **Root Cause**: Standard system instructions for `/api/chat` can allow the model to make assumptions or fabricate outcomes (e.g., inventing sales figures or decisions) if the user asks a question about topics not covered in the transcript.
*   **Mitigation**: Implement rigid **Fact-Grounding Guardrails** in `/api/chat` that mandate an explicit refusal if the queried topic is not present in the transcript context, blocking all speculative content.

---

## 2. PROPOSED ARCHITECTURE & DATA FLOW

We will transition from a heavy multi-stage educational layout to an ultra-fast, high-density **Corporate Intelligence Dashboard** focused on raw speed, 100% transcript grounding, and exhaustive goals/action tracking.

```
                  File Uploaded
                        │
             [FFMPEG Available?]
              ↙             ↘
            Yes             No (Host default)
            │                │
     Transcode to WAV     Skip Transcoding
            │                │
     Upload to GCS        Upload to GCS / Gemini Files
            │                │
   [Run Google STT]       [Supported by STT?]
                            ↙             ↘
                          Yes (MP3/OGG)   No (WEBM/M4A)
                          │                │
                  Run Google STT   Bypass Google STT
                            │              │
                     sttSuccess = true    sttSuccess = false
                            │              │
                            ▼              ▼
                     Stage 1 Gemini   Gemini Native Multimodal
                     Summarization    Audio Analysis & Synthesis
                            │
                            ▼
              [DE-BLOAT SINGLE PASS]
              - No Mind Map Generated
              - No Flashcards Generated
              - Exhaustive Goals & Action items extracted
              - Instant UI response
```

### File Structure Changes
The following files will be refactored:
- `server.ts`: Update `studyResponseSchema` and prompts to completely remove `mindMap` and `flashcards` schemas/synthesis fields. Overhaul the summarization prompt to extract **ALL** goals, objectives, and decisions of the meeting (no skimping!). Add hard guardrails to the `/api/chat` endpoint to strictly ground responses.
- `src/App.tsx`: Remove references, imports, and rendering tabs for `MindMapCanvas` and `FlashcardsDeck`. Set default active tab to "transcript" or "summary", simplifying the interface and improving speed.

---

## 3. EDGE CASE MATRIX (5 CRITICAL FAILURE POINTS)

| # | Potential Failure Point | Impact | Mitigation Strategy |
|:-:|:---|:---|:---|
| **1** | **FFMPEG Missing on Host** | Silent STT decoder failure. | **Self-Healing Routing**: Direct to Gemini Native Multimodal audio parser for compressed media. |
| **2** | **Transient Network upload drop** | Aborted upload. | **Auto-Retry Loop**: 3-attempt backoff chunk upload in `src/App.tsx`. |
| **3** | **Incomplete Extraction of Goals** | Key decisions omitted in the summary. | **Exhaustive Prompt Injection**: Mandate the summarization engine to list *every single* goal, milestone, and target discussed (zero condensation on core commitments). |
| **4** | **Prompt Injection / Hallucination in Chat** | Agent fabricates details (e.g. sales stats). | **Grounding Guardrails**: Add strict instruction in `/api/chat` that compares user question against the context. If absent, must return a protective refusal: *"No se puede validar esta información ya que no fue mencionada en la reunión."* |
| **5** | **Empty STT Output Fallback** | Silence detected or garbage transcription. | **Minimum Word Threshold**: If STT output contains fewer than 3 words, fail immediately and trigger Gemini Multimodal transcription fallback. |

---

## 4. SECURITY & ROBUSTNESS VECTOR

1.  **Strict Context Validation**: Ensure that the chat agent strictly verifies that queries are referenced inside the meeting transcript context to prevent prompt leak or outside hallucination.
2.  **Schema Reduction**: By un-publishing `mindMap` and `flashcards` from the schemas, we reduce parse failure rates and JSON malformation errors to 0%.
3.  **No PII Infiltration**: Prevent chat responses from leaking system variables or private keys under outside probing.

---

## 5. REFACTOR IMPLEMENTATION STEPS

1.  **Step 1 [Backend]**: Modify `server.ts` schemas (`summaryResponseSchema`, `studyResponseSchema`) to remove `mindMap` and `flashcards` keys.
2.  **Step 2 [Backend]**: Update the Stage 1 summarization and single-pass prompts in `server.ts` to heavily emphasize the complete extraction of **ALL** goals, targets, and objectives discussed during the session, making sure nothing is skipped.
3.  **Step 3 [Backend]**: Enhance the `/api/chat` endpoint's system instruction with explicit anti-hallucination guardrails and specific refusal patterns when asked about unmentioned topics.
4.  **Step 4 [Frontend]**: Edit `src/App.tsx` to completely remove the "Mapa Mental" and "Flashcards" tabs, eliminating their UI rendering, and simplifying the state management of those assets.
5.  **Step 5 [QA & Verify]**: Run `npm test` and `npm run lint` to ensure type integrity and functional sanity.

