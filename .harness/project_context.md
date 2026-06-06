# PROJECT CONTEXT
# Update this file when starting each new project.
# All roles inherit this context automatically.

---

## Project Identification

```
Name:           PLAUD Corporate Intelligence (PLAUD-CI)
Domain:         Corporate SaaS / Enterprise Knowledge Management
Repository:     Local Workspace (Plaud-own)
Current env:    development
```

---

## Technical Stack

```
Primary language:       TypeScript 5.8
Runtime:                Node.js 22 LTS
Backend framework:      Express 4.21
Frontend framework:     React 19 / Vite 6 / Tailwind CSS v4 / Motion
Database:               Cloud Firestore (native via @google-cloud/firestore)
ORM / Query builder:    None (Native Firebase SDK & Firestore client libraries)
Authentication:         Firebase Authentication
Cache:                  None
Queue:                  None / Local memory buffer
Storage:                Google Cloud Storage (@google-cloud/storage)
```

---

## Development Tools

```
Package manager:        npm
Test framework:         Vitest 4.1
Linter:                 TypeScript compiler (tsc --noEmit)
CI/CD:                  None
Deploy target:          Local Docker / Cloud Run (via Dockerfile)
Containerization:       Docker
Monitoring:             Console / Debug logs
```

---

## Project Conventions

```
Code language:          TypeScript / English
Commit language:        Spanish / English (Conventional Commits)
Comment language:       Spanish / English
User language:          Spanish (CTO communicates in Spanish)
Main branch:            main
Branching strategy:     feature/*, hotfix/*, release/*
```

---

## Business Context

```
Brief description:      Enterprise-grade SaaS platform to record, transcribe with speaker diarization, and synthesize meeting audio and business documents into executive reports, checklists, mind maps, and interactive tools.
Target user:            C-level Executives, Project Managers, Engineering/Product Teams, and Business Consultants.
Key metrics:            Fast transcription speed, 100% reliable chunked upload, high diarization accuracy, and zero AI hallucinations.
Critical constraints:   Strict Google Cloud privacy compliance (no public data training), CMEK storage support, secure API credential handling.
```

---

## Critical External Dependencies

```
- Google Cloud Speech-to-Text V2 (Chirp 2) / V1 API
- Google Vertex AI / Gemini 2.5 Flash / Pro (via @google/genai SDK)
- Google Cloud Firestore & Firebase SDK
- Google Cloud Storage API
```

---

## Architecture Notes

```
- Self-Healing Audio Pipeline: Automatically routes directly to Gemini 2.5 Flash native multimodal audio transcriber when ffmpeg is missing on the host or when Speech-to-Text V1 returns empty results.
- Resilient Chunk Upload: Chunk-by-chunk client uploading with 3-attempt automated retry and 1.5s exponential backoff delay to handle unstable networks.
- Single-Column Reader UI: Clean, distraction-free document reading, with a collapsible Drawer on the right for Chat Assistant, SVG Mind Map, and Infographics Dashboard.
```

