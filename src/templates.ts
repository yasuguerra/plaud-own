export interface SummaryTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  outline: string;
  prompt: string;
}

export const SUMMARY_TEMPLATES: SummaryTemplate[] = [
  {
    id: "client-needs",
    name: "Client Needs",
    category: "Consulting",
    description: "For client meetings, capture context and goals. Input notes; get a brief with tasks and suggestions.",
    outline: "Overview, Background, Pain Points, Expectations, To-do, AI Suggestions",
    prompt: `Format the summary output strictly under the following markdown sections:

## Overview
[A concise summary of who the client is, their role, and their main goal or strategy discussed]

## Background
[Detail the context of the client's business, such as store count, target market, or historical trends mentioned]

## Pain Points
[Explicitly list the problems, bottlenecks, friction points, or inefficiencies identified during the discussion]

## Expectations
[Detail the client's expectations, desired targets, and solutions they hope to implement]

## Other Information Summary
[Summarize any secondary information, planned changes, or future partnerships mentioned]

### To do
- [Actionable task 1]
- [Actionable task 2]
- [Actionable task 3]

> AI Suggestions
The major pain point identified by AI is [summarize the main bottleneck]. Here are some possible solutions for your reference:
**[Solution 1]**: [Short description of solution 1]
**[Solution 2]**: [Short description of solution 2]
**[Solution 3]**: [Short description of solution 3]
`
  },
  {
    id: "meeting-secretary",
    name: "Meeting Secretary",
    category: "Meeting",
    description: "Summarize transcripts into action items and key notes for easier task and discussion tracking.",
    outline: "Executive Summary, Key Commitments, Detailed Breakdown by Topic",
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
