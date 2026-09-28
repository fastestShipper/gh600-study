# gh600-study

Free, open study app for the **GH-600 — GitHub Certified: Agentic AI Developer (beta)** exam.

A self-contained single-page app you run locally to drill the six exam domains: cram plan, cheatsheet, 12 artifact labs, 87 practice questions, and a timed 50-question mock with per-domain scoring. Progress is stored in your browser's localStorage. No backend, no telemetry, no signup.

> **Unofficial.** Not affiliated with or endorsed by GitHub or Microsoft. Always cross-check against the [official study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/gh-600).

## What's inside

- **Inicio** — what the exam is in plain language, exam logistics, beta testimonials, the six domains and their weights.
- **Plan** — a 3-day intensive cram plan (~17h of study time) with checkable blocks. Tweak the dates in `src/config.ts` to your booking.
- **Dominios** — cheatsheet per domain: key concepts, vocabulary, common pitfalls, GitHub features that get tested.
- **Cheatsheet** — 27 gotchas that consistently show up, glossary (searchable), critical file paths, CLI command reference, and a section on the exam's question style.
- **Lab de artefactos** — 12 real-style snippets (YAML / JSON / logs / audit events) with a question, an explanation, and *why it matters* on the exam. This is the highest-yield section.
- **Practica** — 87 scenario-based questions with full explanations. Filter by domain / by what you got wrong / by what you flagged.
- **Examen Mock** — 50 questions, 120-minute timer, weighted by the official domain percentages. Score plus per-domain breakdown so you know where to drill next.
- **Mi progreso** — KPIs, per-domain bars, mock run history.

## Getting started

```bash
git clone https://github.com/<your-user>/gh600-study.git
cd gh600-study
npm install
npm run dev
```

The dev server runs at `http://localhost:5273`. For a production build:

```bash
npm run build
npm run preview
```

## Configuring your exam date

Open `src/config.ts` and set `EXAM_DATE` to your booking time in ISO 8601 with timezone:

```ts
export const EXAM_DATE = '2026-07-15T10:00:00-05:00'
export const EXAM_LOCATION_LABEL = '' // optional, shown next to the countdown
export const EXAM_HEADER_LABEL = 'TU EXAMEN PROGRAMADO' // optional, top of home page
```

The countdown in the sidebar reads from this. The cram plan in `src/components/PlanPage.tsx` uses generic Day 1 / Day 2 / Day 3 labels — read it and slot it into your own dates.

## Stack

- Vite 8 + React 19 + TypeScript 6
- Tailwind v4 (via `@tailwindcss/vite`, no separate config file)
- No runtime dependencies beyond React. ~366 KB JS / ~114 KB gzipped. Works offline once loaded.

## Credits and acknowledgments

This app is a **consolidation** of public study material plus exam intel from candidates who already took the GH-600 beta. The question bank, gotchas, and labs were synthesized from multiple sources. **Real credit goes to the people below** who did the heavy lifting on the actual content:

### The exam workbook

- **[`naim149/a8aa41c7468685b7d984822c38863aae`](https://gist.github.com/naim149/a8aa41c7468685b7d984822c38863aae)** — the *GH-600 Public Study Guide* gist by **Reasonable_East_3023**. The single densest community workbook on the exam. Covers all six domains with concrete artifacts you need to be able to read (YAML agents, MCP configs, hook JSON, audit log events, session-state files). The path inventory, the MCP transport table, the hook events list, and several gotchas in this app come from there.
- **[`jtur671/gh-600-study-guide`](https://github.com/jtur671/gh-600-study-guide)** — **Jason Turner's** open study repo: 67 flashcards (also published as Anki decks), 41 scenario-style mock questions with a full answer key, 6 hands-on labs, and 5 Mermaid diagrams. The mock-exam logic, several of the practice questions in this app, and the per-domain weighting strategy in the mock build on his work. Jason also published a free **7-video YouTube series** (*PromptLab*), one video per domain — the best free study companion that exists: [GH-600 playlist on YouTube](https://www.youtube.com/playlist?list=PLxgUmxsBhjMhyjJhNM9dxSCdJj2yExS2Y).
- **Reddit beta threads** — the [original `Reasonable_East_3023` post + comments](https://www.reddit.com/r/AzureCertification/comments/1tmeyb2/gh600_beta_experience_and_public_study_guide_from/) and the [`Luciano_DZ` post about taking the exam](https://www.reddit.com/r/AzureCertification/comments/1tk0sfx/took_gh600_exam_today/). These are the source of the "real candidate" testimonials shown on the home page (paraphrased, not copied).

### Official sources

- **[Microsoft Learn GH-600 study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/gh-600)** — the authoritative skills outline. Defer to this when something here disagrees.
- **[Certification landing page](https://learn.microsoft.com/en-us/credentials/certifications/agentic-ai-developer/)** — booking, beta status, GA date.
- **[Microsoft Reactor: GH-600 Deep Dive (May 28, 2026)](https://developer.microsoft.com/en-us/reactor/events/27225/)** — official deep-dive session.
- **GitHub Docs** — actual documentation on Copilot cloud agent, custom agents configuration, CLI, hooks, MCP, GitHub Actions. Every gotcha and lab in this app can be traced back to a specific docs page.

### LLM analyses (used as scaffolding)

Four different LLMs produced analyses that informed this app. Their contributions were mixed and are credited in spirit, not by copy:

- **OpenAI GPT-Pro** — the most rigorous strategic PDF: domain weighting analysis, the `mcp-servers` vs `mcpServers` distinction, the preventive/detective/corrective classification, and 6 well-constructed scenario questions in the practice bank.
- **Anthropic Claude / Codex** — an honest self-evaluation of a parallel cram app and a set of 5 "read the artifact and explain" labs that motivated this app's Lab section.
- **xAI Grok** — a single-file HTML cram page with real candidate testimonials and a clean study-plan layout. The testimonial cards on the home page draw their format from there.
- **Google Gemini** — produced content that conflated GH-600 with the older GH-500 (GitHub Advanced Security) exam and was not used.

If you contributed to any of the sources above and want a specific credit or correction, open an issue.

### About this app

The skeleton, sanitization, plan structure, gotcha curation, snippet selection, and the consolidated cram app were written by a beta candidate in the 36 hours before the exam, using all of the above as inputs. **Anything wrong here is on me, not on the sources above.** Open an issue or PR.

## A note on braindumps

Don't. If something on the internet calls itself "real GH-600 questions" or a "braindump", it is either fabricated or stolen, and using it can get your certification revoked retroactively. Microsoft uses statistical forensics after the fact. Stick to public study material plus your own hands-on practice.

## License

MIT. See [LICENSE](LICENSE). Use it, fork it, send PRs, ship a translated version, build an Anki deck off it. The exam material itself is under Microsoft's NDA — **none of the actual exam questions are here**, only original questions written against the public skills outline.

## Status

Built in 36 hours by a candidate cramming for the May 29, 2026 beta. The plan, gotchas, and labs reflect what the public sources said as of late May 2026. After GA (July 2026) the official guide may evolve; cross-check before relying on any specific detail.
