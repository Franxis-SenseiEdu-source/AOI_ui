# AOI (Academic Operations Intelligence): Future Roadmap

**Institution:** Mindanao State University – Zamboanga Sibugay
**Status of current build:** Working prototype, feature-frozen for the thesis defense.

This document lists what the prototype needs before it can serve the campus. Section A covers what must be fixed before any real rollout. Section B lists features with high value for the college. Section C describes how to show that the system works. None of these items are in the current prototype.

---

## A. Fix before any real campus rollout

1. **The login doesn't verify anyone.**
   - Sign-in only checks that the email ends in `@msuzs.edu.ph` and that the ID looks like a valid ID. There is no password and no check against the registrar's records.
   - The role comes from words in the email or from the ID prefix. Anyone can type `admin@msuzs.edu.ph` with ID `ADM-1` and get Admin access.
   - **Proposal:** sign in with the university's Google or Microsoft 365 accounts (whichever msuzs.edu.ph uses), with roles assigned on a server from the official list.

2. **The audit log and chat history live only in each user's browser.**
   - Users can clear them, they are lost when switching devices, and no administrator can see campus-wide activity. An audit trail the user can delete isn't really an audit trail.
   - **Proposal:** a server-side, add-only audit log with a written retention policy. This also helps compliance with the Data Privacy Act of 2012 (RA 10173): consent records, the role of the Data Protection Officer, and how long data is kept.

3. **Policy answers aren't tied to official documents.**
   - The audit log labels the policy route "Local RAG", but the app sends only an instruction to the model; it doesn't look anything up. The source chips under replies are never filled in for live answers.
   - Unless the backend does its own document retrieval, AOI answers grading and enrollment rules from the model's memory, and it can confidently state wrong rules.
   - **Proposal:** load the Student Handbook and University Code into a retrieval index on the backend. Every policy answer would cite the section it came from, and AOI would say "not found in the handbook" instead of guessing.
   - **This is the single most valuable improvement for academic accuracy.**

4. **The GPU queue is a simulation, and one laptop is the whole server.**
   - An RTX 4050 laptop with 6 GB of video memory can serve only a few users at once, and it is a single point of failure.
   - **Proposal:**
     - Measure real speed and how many users it can handle at once.
     - Use a server that can batch requests, such as vLLM or the llama.cpp server.
     - Replace the simulated queue with a real one.
     - Host it on a campus machine with a UPS.

5. **API keys and model settings are exposed in the browser.**
   - An external API key typed into Settings is saved in the browser and sent from it.
   - Any value in a `VITE_` setting is baked into the public app files, so anyone can read it.
   - Students can currently see the Model connection settings at all.
   - **Proposal:** a backend that holds the keys and forwards the requests, with model settings visible to Admins only.

6. **Personal-data removal is best-effort.**
   - Before research questions are sent out, personal data is stripped by pattern matching, so names written in ordinary sentences can slip through.
   - **Proposal:** a policy decision on whether the external route is allowed at all, opt-in or off by default.

---

## B. Features with high value for the college

| Feature | Why it matters to the college | Needs backend? |
|---|---|---|
| **Filipino, Cebuano and Chavacano** answers and UI | Matches the student population in Zamboanga Sibugay | No (UI and prompt changes) |
| **Office content updates**: Registrar or Student Affairs post deadlines, enrollment dates and announcements | Keeps answers current without code changes | Yes |
| **Dean's dashboard**: top questions, unanswered questions, thumbs-up/down rates | Shows where students are confused about policy, which supports decisions | Yes (ratings are already collected, but only stored per browser) |
| **"Ask a human" handoff**: office contact and hours when AOI can't answer | Avoids dead ends and builds trust | No |
| **"Report wrong answer"** linked to the existing reference ID on each reply | A feedback loop for fixing content | Yes, to collect reports |
| **Installable phone app (PWA)** with a home-screen icon | Most students use mobile data on phones | No |
| **Visible AI-use policy** for homework help | Supports academic integrity; faculty can see what AOI will and won't do | No |
| **Read aloud** | Accessibility | Kokoro or browser voices |

---

## C. Proving it works

- **Accuracy test set:** collect about 100 real student questions with answers approved by the offices. Report the percentage AOI answers correctly before and after document retrieval.
- **Automated tests** for the router that sorts questions, the personal-data stripper and the saved-data checks. There are none in the project right now.
- **Accessibility check:** an accessibility review with screen-reader testing. Text contrast has already been brought up to the WCAG AA standard.
- **Pilot plan:** one college for 2–4 weeks, then a usability survey (a standard System Usability Scale, or SUS, score), usage numbers and feedback, then a decision on expanding.
