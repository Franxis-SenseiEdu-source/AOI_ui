# AOI (Academic Operations Intelligence): System Concept and Handoff

**Institution:** Mindanao State University – Zamboanga Sibugay (MSU-ZS)
**Status:** The frontend prototype is complete and feature-frozen. The backend is the next phase.
**Intended readers:**
- **DeepSeek:** builds the backend. Read Parts 1–4.
- **Grok:** writes thesis Chapters 1–3. Read Parts 1, 2 and 5.

Throughout this document each fact is labelled **[Built]**, **[Simulated]** or **[Planned]**. The thesis must keep these three apart. Do not describe simulated or planned items as finished.

---

## Part 1. Concept

### 1.1 What AOI is
AOI is a campus AI assistant for the students, faculty and staff of MSU-ZS. It answers everyday academic and campus questions in a chat interface designed mobile-first. Its guiding principle is **data sovereignty**: questions are answered by language models hosted on campus first, and a question leaves the campus only when it is research, has been anonymized, and the user has explicitly consented. Every answer gets a correlation ID that appears in an audit log.

AOI also has a character: an animated, anime-style mascot named AOI, whose idle movement and lip-sync are driven by a WebGL mesh. It makes the assistant approachable for students.

### 1.2 Problem it addresses
- Students repeatedly ask offices such as the Registrar the same questions (enrollment, grading, schedules, requirements). Answers are scattered across handbooks and memos.
- Public AI chatbots send student data to third-party servers. That raises privacy concerns under the **Data Privacy Act of 2012 (RA 10173)**.
- Generic chatbots will do graded work for students, which harms academic integrity.
- Institutions can't audit what AI tools told their students.

### 1.3 Users and roles [Built]
| Role | How assigned (prototype) | Can see |
|---|---|---|
| Student | Default | Own chats; own audit rows; "My Grades" link |
| Faculty | ID prefix `FAC-`/`F-` or email word `prof`, `faculty`, `instructor`, `dr` | Own chats; own audit rows |
| Staff | ID prefix `STF-`/`S-` or email word `staff`, `registrar`, `office`, `ict` | Own chats; own audit rows |
| Admin | ID prefix `ADM-` or email word `admin` | Audit log across all accounts |

In the prototype, login only checks that the email ends in `@msuzs.edu.ph` and that the ID has a valid format. There is **no password and no server-side verification**; real authentication is backend work.

---

## Part 2. What the prototype does

### 2.1 Screens [Built]
1. **Login:**
   - Asks for the institutional email and ID number. The email must end in `@msuzs.edu.ph`.
   - Shows the three trust points: data stays on campus, privacy by design, fully traceable.
   - After 5 failed attempts the form locks for 30 seconds.
2. **Portal (homepage):**
   - A time-based greeting with AOI's avatar, and a quick "Ask AOI" box.
   - Statistics: saved chats, queries, and the percentage answered on campus.
   - Academic Services links, AOI Chat cards, and Campus Bulletins with tag filters. The bulletins are sample content.
3. **Academic Chat:**
   - Answers stream in as the model writes them, rendered as safe Markdown (lists, tables, code blocks with a Copy button).
   - Mode picker with four modes, listed in 2.3.
   - Per-reply buttons: Copy (raw Markdown), thumbs up/down, Regenerate.
   - Edit and resend for the last message.
   - Chat history grouped by date (Pinned, Today, Yesterday, Previous 7 Days, Older), with search, pin and rename.
   - The history sidebar collapses on desktop (Ctrl/Cmd+B); on phones it's a swipe drawer.
   - File attachments, voice input (browser speech recognition), chat export to `.txt`, and custom chat backgrounds.
   - A simulated GPU queue indicator.
   - Error replies with fix-it actions (Connect a model, Check connection, Try again).
4. **AI Research Hub:** explains the three-tier research ladder (see 2.5).
5. **System Audit Log:** a table, or cards on mobile, with columns Timestamp, Correlation ID, Role, Intent, Model Used, Path, External Call. Filters for All, External only and Queued only, plus search by ID.
6. **About AOI:** the three pillars and how routing works.
7. **Account Settings:** profile, assigned role, appearance, text size, timestamps, clear local data, log out.
8. **AOI Character Profile:** the full-body avatar, an expression and mood stage, and seven pre-recorded voice lines in three voice packs (Warm, Refined, Gentle). The clips were generated offline with Kokoro TTS (open source, Apache-2.0); there is **no live text-to-speech for chat replies**.
9. **Settings modal:** a General tab (theme: system, light or dark; text size; timestamps) and a Model connection tab (server URL, model, key, test connection).

**Design:** maroon `#800000`, black and white (MSU-ZS colors), with light, dark and system themes. Text contrast meets WCAG AA. The fonts (Plus Jakarta Sans and JetBrains Mono) are bundled so the app works offline. The app is built for 390px phones and scales up to desktop.

### 2.2 Query routing [Built, rule-based, in the frontend]
Every message is classified **before** sending. The rules are checked in this order, and the first match wins:

| Order | Route | Rule (case-insensitive) | Audit intent | Audit path |
|---|---|---|---|---|
| 1 | `homework` | contains `homework`, `essay`, `solve this`, `write my` | Homework (guided) | Policy Guard → Guided |
| 2 | `policy` | contains `policy`, `policies`, `enrollment`, `tuition`, `handbook`, `schedule` | Policy | Local RAG (label only; see 4.3) |
| 3 | `research` | contains `compare`, `analyze`, `analyse`, `evaluate`, **or** text longer than 150 characters | Research | PII Stripper → Local / → External |
| 4 | `general` | anything else | General | Local LLM |

The routing flow is **classify → send → deliver**:
- **Research:** first goes through the PII preview and consent step (2.4).
- **Policy and general:** go through the GPU queue before the model is called.
- **Homework:** is answered as guided help; AOI explains concepts but doesn't give final answers.

### 2.3 System prompt and modes [Built]
The frontend builds the system message by joining up to three parts with blank lines between them:

1. **Base:** "You are AOI (Academic Operations Intelligence), the campus AI assistant of MSU-ZS. Be accurate, warm and concise. Format with Markdown … If you are not sure, say so plainly and suggest which university office can confirm. Never invent policies, memo numbers, page numbers, dates or citations."
2. **Route prompt:**
   - general: everyday campus help.
   - policy: state only what official policy supports and name the office to confirm with.
   - research: synthesize, compare and suggest sources. The query is anonymized; don't ask for personal details.
   - homework: don't complete graded work. Explain the concepts, outline an approach, ask a guiding question.
3. **Mode prompt**, from the mode the user picked:

| Mode id (sent as `model`) | Display name | Extra instruction |
|---|---|---|
| `aoi-general` (default) | AOI General | none |
| `aoi-policy` | AOI Policy | Prioritise official documents; always name the office |
| `aoi-scholar` | AOI STEM Deep | Work step by step, show reasoning |
| `aoi-scholarmini` | AOI STEM Fast | Be brief: 1–4 sentences |

Request settings:
- The last 12 turns of the conversation are included.
- Temperature is 0.4.
- Messages are capped at 4,000 characters.

### 2.4 Privacy: PII stripper and consent gate [Built, pattern-based]
**Detection (shown highlighted in the consent preview):**
- **Layer 1, identifiers:** emails, student IDs (`NN-NNNN…`), Philippine mobile numbers (`+63`/`09…`), titled names (Prof./Dr./Mr./Ms./Mrs.), self-introductions ("my name is …"), and the university name.
- **Layer 2, course codes:** for example `CS 101`.

**Anonymization (what is actually sent for research):**

| Personal data | Replaced with |
|---|---|
| Instructor names | "my instructor" |
| Course codes | "a computer science course" (subject-aware) |
| Emails | `[email]` |
| Phone numbers | `[phone]` |
| Student IDs | `[student ID]` |
| Long digit runs | `[ID number]` |
| University name | "a regional state university" |
| Self-introduced names | `[name]` |

Research messages, **including earlier user turns in the history**, are anonymized before sending. The user sees a before/after preview and must approve it, or cancel to edit.

**Limitation:** this is pattern matching. Names written in ordinary sentences can slip through.

### 2.5 Research tier ladder [Designed in the UI, not yet enforced]
| Tier | Model | Rule | Location |
|---|---|---|---|
| 1 Lightweight STEM | `aoi-scholarmini` | Under 150 tokens and no synthesis keywords | Local |
| 2 Deep Local | `aoi-scholar` | 150 tokens or more, or a synthesis keyword (compare, analyze, evaluate, synthesize, critique) | Local |
| 3 External Synthesis | external, e.g. OpenRouter free tier | Broad multi-source research; only after the PII check **and** consent | External |

Today the frontend sends the mode the user selected for every route. Choosing the tier automatically is **backend work** (4.3).

### 2.6 GPU queue [Simulated]
The UI shows a first-come-first-served queue for a single campus GPU (RTX 4050, 6 GB), with each job taking a fixed 2.1 s. This is a **client-side simulation**; the real queue must live on the backend.

### 2.7 Data stored today [Built, browser localStorage only]
| Key | Content |
|---|---|
| `aoi.user`, `aoi.role` | Signed-in user `{name, email, id, role}` |
| `aoi.chats` | Conversations `{id, title, msgs[], updated, pinned?, renamed?}` |
| `aoi.audit` | Audit rows (up to 300) |
| `aoi.settings` | `{theme, fontSize, showTime, bgId, bgDim, model, sidebarCollapsed}` |
| `aoi.llm` | Endpoint config `{local, external}`, each `{baseUrl, model, apiKey}` |
| `aoi.voice`, `aoi.voicepack`, `aoi.bgimg` | Voice and background preferences |

All loaded data is checked and cleaned on read. Because everything lives in the browser, users can clear it, nothing syncs across devices, and administrators can't see campus-wide activity.

---

## Part 3. Frontend ↔ backend contract (must not break)

The frontend is frozen. The backend **must** implement this contract exactly.

### 3.1 Endpoints (OpenAI-compatible)
Base URL from `VITE_AOI_LLM_URL`; the campus default is `http://192.168.1.10:8000/v1`, served by the "ProBook" orchestration node.

**`GET {base}/models`**
- Used by the "Test connection" button in Settings.
- Response: `{"data":[{"id":"aoi-general"},{"id":"aoi-policy"},{"id":"aoi-scholar"},{"id":"aoi-scholarmini"}]}`

**`POST {base}/chat/completions`**
- Request headers: `Content-Type: application/json`, plus `Authorization: Bearer <key>` only if a key is set.
- Request body:
  ```json
  {
    "model": "aoi-general | aoi-policy | aoi-scholar | aoi-scholarmini",
    "messages": [
      {"role": "system", "content": "<base + route + mode prompt>"},
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "..."},
      {"role": "user", "content": "<latest message; anonymized if research>"}
    ],
    "stream": true,
    "temperature": 0.4
  }
  ```
- Streaming response (preferred):
  - `Content-Type: text/event-stream`.
  - Lines like `data: {"choices":[{"delta":{"content":"..."}}]}`, ending with `data: [DONE]`.
  - A clean close without `[DONE]` is accepted as success.
  - A dropped connection mid-stream shows as a network error.
- Non-streaming fallback: any non-`event-stream` response is read as JSON `choices[0].message.content`.
- Errors: any non-2xx status is shown as "The model server answered {status}: {first 200 chars of body}".

**CORS:** the backend must allow the app's origin. The local dev port is 5173; the local preview port is 8443.

### 3.2 Configuration (`.env.local`)
```
VITE_AOI_LLM_URL=http://192.168.1.10:8000/v1      # on-campus (general, policy, homework)
VITE_AOI_LLM_MODEL=aoi-general
VITE_AOI_EXTERNAL_URL=http://192.168.1.10:8000/v1 # research route (anonymized only)
VITE_AOI_EXTERNAL_MODEL=aoi-scholar
```
If the external URL is empty, research falls back to the local endpoint. A `VITE_*` value is **public**: it's compiled into the app, so never put secrets in it.

### 3.3 Known gaps in what the frontend sends
- **No route field.** The backend receives only `model` and `messages`. To apply routing or tier rules, it can either re-run the same classifier rules (2.2) on the last user message, or detect the route prompt text inside the system message. A small frontend change could add an explicit `route` field after the freeze.
- **No attachment contents.** Attachments add only their **file names** to the prompt (`[Attached files: a.pdf]`). Uploading the actual files needs a new endpoint later.
- **No citations parsed.** The UI can show source chips and a source sheet `{title, ref, score, chunk, snippet}`, but the streaming parser reads only `delta.content`. Until a frontend change, citations must be written into the answer text, for example "(Student Handbook 2025–2026, p.12)".
- **No user identity sent.** Requests carry no user or role. Real authentication (4.1) must add a session token.

---

## Part 4. Backend scope for DeepSeek (in priority order)

Constraints:
- Keep Part 3 working.
- No changes to the frozen frontend unless they're agreed separately.
- Suggested stack: Python FastAPI, or Node, behind an OpenAI-compatible façade, with vLLM or llama.cpp server on the GPU host.

### 4.1 Orchestration API on the ProBook node
1. Implement `/v1/models` and `/v1/chat/completions` exactly as in 3.1, mapping the four AOI ids to the real local models.
2. Add a real FCFS job queue for the single GPU, with a timeout, cancellation when the client disconnects, and a configurable limit on concurrent jobs.
3. Add `GET /health` reporting model status, queue length and GPU memory. The UI already tells users to check `/health`.

### 4.2 Policy grounding (RAG)
1. Load the Student Handbook, University Code and memos. Split them into chunks with page references, embed them locally, and store them in a local vector store.
2. For policy queries, retrieve the top chunks and inject them into the prompt. Instruct the model to cite document and page, and to answer "not found in official documents" when nothing matches.

### 4.3 Server-side routing and the research ladder
1. Re-classify each request using 2.2 (or the system-prompt marker) so the backend knows its route.
2. Apply the tier rules from 2.5 for research. Call external providers **only** for Tier 3, only with already-anonymized text, and run a second server-side PII pass before anything leaves.
3. Keep provider API keys on the server only.

### 4.4 Server-side audit log
An add-only table with the same columns as the UI: `cid, ts, role, user, intent, model, path, external, wait`. The correlation ID format is `aoi-` plus 5 characters. Add retention rules and an admin-only read endpoint. This prepares a later frontend switch from `localStorage` to the server.

### 4.5 Authentication (later; needs a frontend change)
Institutional SSO (Google Workspace or Microsoft 365), with roles from a server-side registry instead of email and ID patterns. The orchestration API then requires a session token.

### 4.6 Acceptance checks
- The app's Model connection test shows "connected · 4 models".
- A chat streams word by word, and Stop cancels the job on the server.
- Two clients sending at once are served in order.
- A policy question returns a cited answer, and an unknown policy returns "not found".
- An external call happens only for consented Tier 3 requests and is visible in the audit log.

---

## Part 5. Notes for Grok (thesis Chapters 1–3)

Rules for writing:
- Use only the facts in this document. Mark simulated and planned parts as such.
- **Do not invent citations, statistics, page numbers or survey results.** Wherever a source or a number is needed, write `[CITATION NEEDED]` or `[DATA TO BE COLLECTED]`.
- Use Philippine academic thesis conventions and the institution's name exactly: "Mindanao State University – Zamboanga Sibugay".

### Chapter 1: The Problem and Its Background
- **Background of the study:** AI chatbots in higher education; repetitive questions to offices; privacy risks of public AI tools; RA 10173; academic integrity concerns. Data sovereignty as the design response.
- **Statement of the problem:**
  - **General:** how to build a campus AI assistant that answers academic and campus questions while keeping student data on campus and every answer auditable.
  - **Specific questions, one per pillar:**
    1. Local-first answering.
    2. PII stripping and consent before any external call.
    3. A traceable audit log.
    4. Homework guidance instead of completed work.
    5. Usability on mobile devices.
- **Objectives:** a general objective, and specific objectives that mirror the questions above. Each should be measurable; see the evaluation plan in Chapter 3.
- **Significance:** students, faculty, the Registrar and offices, ICT and the administration, future researchers.
- **Scope and delimitation:**
  - **Scope:** the frontend as built (Part 2), and the backend as designed (Part 4).
  - **Delimitation:** prototype authentication, browser-only storage, a simulated queue, pattern-based PII stripping, sample bulletins and documents, a single RTX 4050 6 GB GPU, English-language UI.
- **Definition of terms:** AOI, LLM, local/on-campus model, RAG, PII, anonymization, consent gate, data sovereignty, correlation ID, audit log, routing/classifier, GPU queue (FCFS), OpenAI-compatible API, streaming (SSE), Live2D-style avatar, TTS, WCAG.

### Chapter 2: Review of Related Literature and Studies
Themes to cover; each needs real sources, so use `[CITATION NEEDED]`:
1. Conversational AI and chatbots in university student services.
2. Large language models and running them locally or on-premise.
3. Retrieval-augmented generation for grounded, cited answers.
4. Data privacy in education: RA 10173, NPC guidelines, PII detection and anonymization.
5. Human oversight, auditability and explainable AI.
6. AI and academic integrity: guided help versus answer generation.
7. Anthropomorphic agents, avatars and user engagement.
8. Mobile-first and accessible design: WCAG.
9. Usability evaluation: ISO/IEC 25010, System Usability Scale.

End with a **synthesis** showing the gap: few campus assistants combine local-first models, consent-gated external calls and a full audit trail.

### Chapter 3: Research Methodology
- **Research design:** developmental or applied research using Agile or iterative prototyping. The prototype went through many short build-review cycles.
- **System architecture:**
  - Browser app (React 19, TypeScript, Vite 8, Tailwind CSS 4).
  - → OpenAI-compatible orchestration API on the campus ProBook node (`192.168.1.10:8000`).
  - → local model server on the GPU host. `[CONFIRM: same machine as the ProBook node or separate]`
  - → optional external provider, for Tier 3 research only.
  - Include a context diagram and a data-flow diagram of classify → (PII preview/consent) → queue → model → stream → audit.
- **Features and modules:** from Part 2.
- **Data handling and ethics:** what is stored, anonymization, consent, retention, RA 10173 compliance plan.
- **Hardware and software requirements:** the RTX 4050 6 GB GPU host, the campus LAN, Chrome, Edge or Brave. Fonts and assets are bundled for offline use.
- **Evaluation plan:** `[DATA TO BE COLLECTED]` for all results.
  - **Functional testing:** classifier routing, PII stripping cases, consent flow, streaming and error states.
  - **Answer accuracy:** about 100 real student questions with office-approved answers, scored before and after RAG.
  - **ISO/IEC 25010 survey:** functional suitability, performance efficiency, usability, security, reliability.
  - **System Usability Scale (SUS)** with students, faculty and staff.
  - **Performance:** time to first token, tokens per second, queue wait under concurrent users.
  - **Statistical treatment:** weighted mean with a Likert interpretation scale, SUS scoring.
- **Respondents and sampling:** `[TO BE DECIDED]`, for example purposive sampling per role.

---

*Companion documents in this repository: `FUTURE_ROADMAP.md` (improvements for the Dean) and `BUILD_REPORT.md` (build notes).*
