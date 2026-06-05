export interface SummaryTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  outline: string;
  outlinePoints: string[];
  prompt: string;
}

export const SUMMARY_TEMPLATES: SummaryTemplate[] = [
  {
    id: "client-needs",
    name: "Client Needs",
    category: "Consulting",
    description: "For client meetings, capture context and goals. Input notes; get a brief with tasks and suggestions.",
    outline: "Overview, Background, Pain Points, Expectations, To-do, AI Suggestions",
    outlinePoints: [
      "Overview: Capture a detailed and exhaustive strategic summary of the client's role and main goals.",
      "Background: Deeply analyze business background, store counts, geography, and historical performance metrics.",
      "Pain Points: Explicitly map every single problem, bottleneck, inventory issue, or communication friction discussed.",
      "Expectations: State target turnover rates, experience upgrades, or analytical tools the client expects.",
      "Other Info: Summarize secondary parameters like points systems, partnerships, or future pilots.",
      "To-Do List: Generate a comprehensive checklist of specific, actionable task descriptions.",
      "AI Suggestions: Provide multi-sentence concrete advice and frameworks for each primary bottleneck."
    ],
    prompt: `CRITICAL DEPTH INSTRUCTION: Do NOT generate a brief or brief summary. You must produce an EXHAUSTIVE, highly comprehensive, and deeply detailed overview. Expand on every single argument, problem, and expectation discussed. Be extremely specific, citing exact names, numbers, volumes, and metrics. Your output must serve as a permanent, standalone operational work document.

Format the summary output strictly under the following markdown sections:

## Overview
[A highly comprehensive summary of who the client is, their business role, and their main strategic goal debated]

## Background
[Detail the context of the client's business thoroughly. List company sizes, locations, store counts, or historical market trends mentioned]

## Pain Points
[Explicitly list and expand on every problem, bottleneck, friction point, or system inefficiency identified during the discussion]

## Expectations
[Detail the client's desired goals, timeline expectations, inventory turnover targets, or customer experience improvements they hope to achieve]

## Other Information Summary
[Summarize any secondary context, future point systems, brand partnerships, or next-phase plans mentioned]

### To do
- [Actionable task 1 - expand with description]
- [Actionable task 2 - expand with description]
- [Actionable task 3 - expand with description]

> AI Suggestions
The major pain point identified by AI is [summarize the main bottleneck]. Here are some possible solutions for your reference:
**[Solution 1 Title]**: [Exhaustive description of solution 1 detailing how to implement it]
**[Solution 2 Title]**: [Exhaustive description of solution 2]
**[Solution 3 Title]**: [Exhaustive description of solution 3]
`
  },
  {
    id: "meeting-secretary",
    name: "Meeting Secretary",
    category: "Meeting",
    description: "Summarize transcripts into action items and key notes for easier task and discussion tracking.",
    outline: "Executive Summary, Key Commitments, Detailed Breakdown by Topic",
    outlinePoints: [
      "Executive Summary: Summarize virtual meetings in high-fidelity notes capturing general sentiment.",
      "Experienced Assistant Role: Act as a senior assistant producing professional, clear, and actionable notes.",
      "Topic Analysis: Identify key discussion themes, conclusions, and main topics from the transcript.",
      "Key Commitments: List actionable tasks with clear assigned parties, responsibilities, and timelines.",
      "Professional Layout: Organize notes into three comprehensive sections utilizing bullet points and bolding."
    ],
    prompt: `Format the summary output strictly under the following markdown sections:

## Executive Summary
[Provide a clear, high-level summary of the entire meeting, identifying the core discussion and general sentiment]

## Key Action Items/Commitments
[Extract all tasks, follow-ups, and commitments made during the meeting. For each item, state the action, who is responsible, and the timeline if mentioned]

## Detailed Breakdown by Topic
[Break down the discussion into the main topics discussed. For each topic, provide:
- A bold sub-heading
- A concise bullet-pointed summary of what was debated and concluded]
`
  },
  {
    id: "detailed-summary",
    name: "Detailed Summary",
    category: "Meeting",
    description: "Organizes notes into topic summaries, task tables, and quotes for clear team follow-up.",
    outline: "Overall Summary, Topic Summaries with Quotes, Action Items Grid",
    outlinePoints: [
      "Header Specs: Capture the meeting title, date, time, and participant list beautifully.",
      "Overall Summary: Synthesize objectives, outcomes, and major team-wide agreements.",
      "Topic Summaries: Detail discussed topics in chronological order with header and bulleted arguments.",
      "Fidelity Check: Mark unclear quotes as [???]. Never invent facts or context outside the transcript.",
      "Key Quotes: Extract faithful direct quotes explicitly attributed to each participant.",
      "Action Items Grid: Map out clear task lists with deadlines, assignees, and implementation notes."
    ],
    prompt: `Format the summary output strictly under the following markdown sections:

## Overall Summary
[A thorough synthesis of the meeting's objectives, accomplishments, and high-level decisions]

## Topic Summaries & Quotes
[List the topics discussed in the chronological order they occurred. For each topic:
- **[Topic Title]**: Summarize key arguments, decisions made, and problems debated.
- *Key Quotes*: Extract direct, faithful quotes from participants discussing this topic, explicitly identifying who said what (using mapped speaker names, e.g., Yasu Guerra, Julio, etc.).]

## Action Items Grid
[Present a structured grid of action items, detailing:
- Title of task
- Brief task description
- Responsible party
- Deadline and notes]
`
  },
  {
    id: "speaker-presentation",
    name: "Speaker Presentation",
    category: "Speech",
    description: "Convert event notes into summaries. Features themes, quotes, and audience action items.",
    outline: "Speech Overview, Key Themes, Notable Quotes, Audience Deliverables",
    outlinePoints: [
      "Speech Context: Identify presentation title, speaker name, event name, location, and key setting.",
      "Key Themes: Map out high-level arguments and major themes of the keynote speech.",
      "Presentation Key Points: Detail significant findings, statistics, methodologies, or data points.",
      "Memorability Quotes: Extract 3 to 5 powerful quotes capturing the speaker's original tone.",
      "Audience Deliverables: Define concrete, actionable lessons the audience can execute."
    ],
    prompt: `Format the summary output strictly under the following markdown sections:

## Speech Overview
[Provide context on the speaker, presentation title, and the main thesis or focus of the talk]

## Key Themes
[Analyze and explain the major high-level themes and arguments presented by the speaker]

## Presentation Key Points
[Detail the most significant takeaways, models, or data points discussed during the presentation]

## Notable Quotes
[Extract 3 to 5 powerful and memorable direct quotes from the talk, keeping the speaker's original tone and word choice]

## Audience Deliverables & Actions
[List clear, actionable guidelines or steps that the audience should implement based on the speaker's advice]
`
  },
  {
    id: "deep-speech",
    name: "Walter G Jr's Deep Lecture",
    category: "Speech",
    description: "Detailed summaries with original tone. Includes quotes, core concepts, and clear action steps.",
    outline: "Main Message, Relevance, Chapter Breakdown, Metaphors, 8-15 Quotes, Teaching Toolbox",
    outlinePoints: [
      "Tone Matching: Capture and mimic the speaker's original tone, terms, expressions, and style.",
      "Main Message: Synthesis of primary thesis in 1 or 2 high-impact paragraphs using original phrasing.",
      "timeless Relevance: Pinpoint the problem solved or the timeless value of the speaker's insight.",
      "Chapter Breakdown: Provide a descriptive, chapter-by-chapter flow detailing the speaker's arguments.",
      "Toolbox & Frameworks: List and explain steps, methodologies, data, or scientific find models.",
      "Audience Interaction: Note rhetoric questions, humor, surprising statistics, or emotional moments.",
      "Faithful Quotes (8-15): Extract a comprehensive list of memorable inspirational quotes or definitions.",
      "Teaching Concept list: Define core conceptual building blocks as a practical teaching toolbox.",
      "Audience Action Steps: Define 3 to 7 command-style strategic guidelines with quote-based justifications."
    ],
    prompt: `Format the summary output strictly under the following markdown sections:

## Main Message & Tone
[One or two powerful paragraphs summarizing the primary thesis, mirroring the speaker's tone, metaphors, and phrasing]

## Relevance & Problem Solved
[Identify what timeless problem this lecture addresses or its unique insight]

## Chapter-by-Chapter Flow
[Provide a chronological chapter breakdown of the speaker's delivery, summarizing the core idea and purpose of each chapter]

## Frameworks & Methodologies
[Detail any steps, frameworks, models, or tools presented by the speaker]

### Teaching Toolbox & Core Concepts
- **[Key Concept 1]**: [Rich description of theoretical foundations or mental models introduced]
- **[Key Concept 2]**: [Rich description]

### Memorable Direct Quotes (8 to 15)
- "[Faithful Quote 1]" - [Speaker Name]
- "[Faithful Quote 2]" - [Speaker Name]
- "[Faithful Quote 3]" - [Speaker Name]
- [List at least 8 direct quotes mapping catchphrases or memorable metaphors]

### Strategic Action Points
- **[Action Point 1]**: [Practical command or guideline directly inspired by the talk, with a quote justification]
- **[Action Point 2]**: [Guideline]
`
  },
  {
    id: "training-summary",
    name: "Training Summary",
    category: "Speech",
    description: "For trainers and attendees to capture sessions. Outputs key points, notes, edge cases, and tasks.",
    outline: "Key Words, Work Guide by Module, Considerations, Special Circumstances, To-Do list",
    outlinePoints: [
      "Keywords Index: Summarize key words and core training vocabulary in a clean index list.",
      "Modular Guide: Step-by-step breakdown of key modules, takeaways, and lessons.",
      "Precautions & Safety: List key considerations, warnings, and precautions for practice.",
      "Special Circumstances: Explain how to manage exceptions or handle edge cases.",
      "Assigned To-Do's: Map out a task checklist with clear assignments and strict deadlines."
    ],
    prompt: `Format the summary output strictly under the following markdown sections:

## Key Words & Concepts
\`[Comma-separated list of keywords of this training]\`

## Work Guide by Module
[Break down each module covered during the training:
- **Module Name**
  - **Key Points**: List key points covered.
  - **Considerations**: List precautions, warnings, or tips for practice.]

## Special Circumstances
[Detail how to manage exceptions or handle edge cases mentioned in the training]

## To-do lists
- [Task 1] - *[person assigned]* - Deadline: [Date]
- [Task 2] - *[person assigned]* - Deadline: [Date]
`
  }
];

export function getTemplateById(id: string): SummaryTemplate {
  return SUMMARY_TEMPLATES.find(t => t.id === id) || SUMMARY_TEMPLATES[0];
}
