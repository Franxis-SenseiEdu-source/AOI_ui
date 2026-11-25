# AOI — Current Build Report

AOI (Academic Operations Intelligence) is the campus AI assistant frontend for MSU–Zamboanga Sibugay: Vite + React 19 + TypeScript + Tailwind v4, all app code in `src/App.tsx` and `src/views.tsx`. This report describes the build as it is; it changes no code.

## 1. Backend contract the UI expects

| | |
|---|---|
| Base URL | `VITE_AOI_LLM_URL` (on-campus) and `VITE_AOI_EXTERNAL_URL` (research). Both point at the ProBook node `http://192.168.1.10:8000/v1`. |
| `GET {base}/models` | Called only by **Settings → Model connection → Test connection**. The UI reads `data[].id` (first 50); the rest of `{object:"list", data:[{id,object,created,owned_by}]}` is ignored. |
| `POST {base}/chat/completions` | One call per message. Body: `{ model, messages, stream: true, temperature: 0.4 }`. `Authorization: Bearer …` is sent only if an API key was typed into Settings. |
| `model` | Always the selected mode id, one of exactly **`aoi-general`**, **`aoi-policy`**, **`aoi-scholar`** (UI label "STEM Deep"), **`aoi-scholarmini`** ("STEM Fast"). Labels are never sent. |
| `messages` | One `system` message (base prompt + route prompt + mode line), up to 12 prior turns, then the new `user` message. Research turns are anonymized first. |
| Response | `Content-Type: text/event-stream`. The UI reads only `choices[0].delta.content` from each `data:` line and stops at `data: [DONE]`. A clean close without `[DONE]` keeps the partial reply; a mid-stream drop shows a network error. A non-SSE JSON reply is accepted via `choices[0].message.content`. Non-2xx shows the status and the first 200 characters of the body. |

```http
POST http://192.168.1.10:8000/v1/chat/completions
Content-Type: application/json

{"model":"aoi-policy","stream":true,"temperature":0.4,
 "messages":[{"role":"system","content":"You are AOI (Academic Operations Intelligence), the campus AI assistant of …"},
             {"role":"user","content":"What are the enrollment requirements?"}]}

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1732000000,"model":"aoi-policy","choices":[{"index":0,"delta":{"content":"Freshmen need"},"finish_reason":null}]}

data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1732000000,"model":"aoi-policy","choices":[{"index":0,"delta":{"content":" Form 138 …"},"finish_reason":null}]}

data: [DONE]
```

## 2. What the UI does today

**Routing and mode selection.** Every message goes through one fixed pipeline (classify → send → deliver), and the mode picker (AOI General, Policy, STEM Deep, STEM Fast) decides which of the four backend models answers, by sending its id. *It is not:* an automatic model choice; the classifier changes the instructions given to the model, but never overrides the mode the user picked.

**Classifier.** A keyword check sorts each message into homework ("homework", "essay", "write my", "solve this"), policy ("policy", "enrollment", "tuition", "handbook", "schedule"), research ("compare", "analyze", "evaluate", or over 150 characters) or general, and each route gets its own instructions, such as "guide, don't do the assignment" for homework. *It is not:* AI understanding; it matches words, so "my essay deadline policy" counts as homework, and the homework guard is an instruction to the model that the model could still ignore.

**Consent and PII handling.** Before a research question is sent, AOI shows a "PII Stripper preview" with the original and the anonymized text: emails, phone numbers, student/ID numbers, "my name is …", honorific + surname, course codes and the university name are replaced. Only the anonymized version is sent, and only after **Continue**. *It is not:* a guarantee; it runs in the browser with pattern rules, only on the research route, and the backend does no stripping of its own.

**GPU queue.** Policy and general questions take a turn in a one-at-a-time "Campus GPU · RTX 4050 6 GB" queue, shown in a strip under the header labelled "Queue simulation for demonstration". *It is not:* the real backend queue; it is a timer in this browser (a fixed 2.1 s estimate per request), and it never sees other users.

**Audit log.** Each reply gets a correlation ID (`aoi-xxxxx`), and the log records time, ID, role, intent, the model id actually sent, route path, whether it went external and any queue wait. Students see their own rows; Admins see every account. *It is not:* a server record; it is stored in this browser (`localStorage`, last 300 rows) and starts with 12 sample rows when empty.

**Model Connection panel.** **Settings → Model connection** shows the server URL and model for the on-campus and research endpoints, with presets and a **Test connection** button that prints the exact URL probed and "connected · N models" or "unreachable · reason". *It is not:* a health monitor; it only checks when the button is pressed, and the app never pings the backend on its own.

**Streaming and error handling.** Replies appear word by word as the backend streams them, **Stop** cancels the request, and failures turn into a clear message with **Check connection** and **Try again** plus a red "On-campus model unreachable" banner above the composer. *It is not:* self-healing; there is no automatic retry, and the banner appears only after a failed request or probe, not at page load.

## 3. Known limitations

- **GPU queue is a client-side simulation, not a real backend queue.** Response: labelled on screen as a demonstration; a real queue position needs a backend endpoint, scheduled post-defense.
- **Audit log is client-side (`localStorage`), not Postgres-backed, and seeds 12 sample rows.** Response: it demonstrates the audit schema and correlation IDs; server-side persistence is scheduled post-defense.
- **The PII strip is frontend-only; the backend has no strip logic yet.** Response: it is a documented first layer; a matching server-side filter is planned.
- **The external research path is configured but not exercised.** Both URLs point at ProBook, so "external" requests never leave campus in this build. Response: the consent and anonymization flow is fully shown; a real external provider is out of scope.
- **The backend runs with `MOCK_MODE=true` by default on ProBook, so replies are canned.** Response: the demo proves the contract and the UI flow; answer quality is evaluated once real models are enabled.
- **Login is client-side only: any well-formed `@msuzs.edu.ph` email plus ID is accepted, and the role comes from the email/ID pattern** (e.g. `admin@…` or `ADM-…` → Admin). Response: this is a prototype; SSO/LDAP integration is scheduled.
- **The classifier is keyword-based and can misroute.** Response: it is deterministic and explainable by design; the backend classifies again server-side when the mode is unknown.
- **The homework guard is a prompt instruction, not enforcement.** Response: it depends on model compliance; a backend policy filter is planned.
- **Voice input uses the browser's speech engine; in Chrome this sends audio to Google's servers.** Response: keep the mic off in the demo or use typed input; on-campus speech-to-text is out of scope.
- **Attachments are not uploaded; only file names are added to the prompt.** Response: document ingestion is scheduled with the RAG work.
- **There are no real citations: the backend returns none, so source chips stay hidden; the excerpt sheet's documents are static samples.** Response: citations arrive with backend RAG.
- **A set `VITE_AOI_LLM_URL` / `VITE_AOI_EXTERNAL_URL` overrides the URL saved in Settings on every load.** URL edits made in Settings last only until the next reload. Response: change the URL in `.env.local` and restart `pnpm dev`; that is the single source of truth for the demo.
- **The HTTPS preview cannot reach the LAN backend.** A page served over HTTPS (e.g. the hosted preview) is blocked from calling `http://192.168.1.10`. Response: demo from a laptop on the campus LAN running `pnpm dev` over plain HTTP; ProBook must allow that origin via CORS.
- **The browser holds any API key typed into Settings.** Response: none is needed on the LAN; cloud keys belong behind a server proxy.
- **Static content:** portal bulletins, the character profile's stats and the 7 pre-recorded voice lines are fixed. Response: they are presentation content, not data.

## 4. Environment variables

Set in `.env.local` (template: `.env.example`). `VITE_*` values are bundled into the page, so never put secrets in them.

| Variable | Default in code | Controls | Campus LAN demo value |
|---|---|---|---|
| `VITE_AOI_LLM_URL` | `http://localhost:11434/v1` | On-campus endpoint: general, policy, homework, and research when external is unset | `http://192.168.1.10:8000/v1` |
| `VITE_AOI_LLM_MODEL` | *(empty)* | Must be non-empty for chat to be "connected"; shown in the model menu. The mode id is what is actually sent. | `aoi-general` |
| `VITE_AOI_EXTERNAL_URL` | *(empty)* | Research endpoint; if empty, research uses the on-campus endpoint | `http://192.168.1.10:8000/v1` |
| `VITE_AOI_EXTERNAL_MODEL` | *(empty)* | Must be non-empty for the research endpoint to be used | `aoi-scholar` |
| `PORT` (not `VITE_`) | `5173` | Dev server port (`strictPort`, so it fails if busy) | leave unset (`5173`) |

## 5. Safe-to-demo checklist

Before starting: confirm ProBook answers with `curl http://192.168.1.10:8000/v1/models` (four ids). Then on the demo laptop: `cp .env.example .env.local`, `pnpm install`, and `pnpm dev`.

1. **Open http://localhost:5173.** Expected: the maroon "Institutional Login" screen. *If this fails, check:* the terminal shows Vite on 5173; if the port is busy Vite exits (`strictPort`) instead of switching.
2. **Log in** with `juan.delacruz@msuzs.edu.ph` and ID `2024-00123`, then click **Verify & Login**. Expected: the portal greets "Good …, Juan." with a Student badge. *If this fails, check:* the email ends in `@msuzs.edu.ph` and the ID matches `2024-00123`; after 5 bad tries, wait 30 s.
3. **Click "Academic Chat".** Expected: AOI's animated avatar and "Hi, I'm AOI…", with no amber "No language model connected" pill. *If this fails, check:* `.env.local` exists and `pnpm dev` was restarted after editing it.
4. **Click the "AOI General ▾" header → Connection → Test connection.** Expected: `probing http://192.168.1.10:8000/v1/models ...`, then `connected · 4 models` with the GET URL below. *If this fails, check:* the laptop is on the campus LAN, ProBook:8000 is up, CORS allows `http://localhost:5173`, and the page is not HTTPS.
5. **Close Settings, open the header picker, choose "AOI Policy".** Expected: the header reads "AOI Policy". *If this fails, check:* reload; the choice is saved per browser.
6. **Send "What are the enrollment requirements?"** Expected: the "Campus GPU" strip with its simulation note, then a streamed reply ending with an `ID: aoi-xxxxx` chip. *If this fails, check:* the red banner/error bubble text; then step 4.
7. **Send "Write my essay on climate change".** Expected: a reply that offers guidance rather than an essay; in `MOCK_MODE` the text is whatever the mock returns. *If this fails, check:* that it routed as homework in the audit log (Intent "Homework (guided)").
8. **Send "My name is Juan Dela Cruz, ID 2024-00123. Compare scholarship programs for state universities."** Expected: the "External Research Query" modal shows Before/After with `[name]` and `[student ID]`; click **Continue** and the reply streams. *If this fails, check:* the message contains "compare"/"analyze" or is over 150 characters.
9. **Send any question and press the square Stop button while it streams.** Expected: the toast "Generation stopped" and the partial reply ends with "…". *If this fails, check:* the reply was still streaming (mock replies can finish instantly).
10. **Click an `ID: aoi-xxxxx` chip under any reply.** Expected: the System Audit Log opens with that row highlighted, and the Model column shows `aoi-policy` etc. *If this fails, check:* step 6 produced a reply; failed requests log the model "None" with Intent "Error".
11. **Optional failure demo:** in Settings, change the on-campus URL to `http://192.168.1.10:8001/v1` and send a message. Expected: an error bubble with Check connection / Try again and the red "On-campus model unreachable" banner, and typing still works. Restore `:8000` and click **Try again**. *If this fails, check:* the URL field saved (it saves on typing).
12. **Optional:** tap AOI's round icon in the chat header, then tap a line under "Secretary Lines". Expected: the full-body profile, and AOI speaks the line with lip-sync. *If this fails, check:* the laptop volume and the mute icon next to "Tap her to talk".
13. **Optional Admin view:** log out, then log in as `admin@msuzs.edu.ph` with ID `ADM-0001` and open System Audit Log. Expected: rows from all accounts on this browser. *If this fails, check:* the email local part is exactly `admin`.
