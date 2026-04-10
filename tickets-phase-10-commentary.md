# Cantor — Phase 10 ticket batch (learning & commentary layer)

Cantor shows all the right numbers but a beginner can't read them. Phase 10 adds a local-LLM commentary layer that explains, in plain English, what the dashboard is actually doing as events happen — plus an on-demand "teach me" feature that lets you click any metric, indicator, or signal entry for a longer contextual explanation.

**Backend:** a locally running Ollama instance (`http://localhost:11434`). Default model: `llama3.2:3b` — 2GB, <1s responses on Apple Silicon, plenty smart for short event commentary. Later upgrade to `qwen2.5:7b` by changing a single constant if depth is needed.

**Prerequisite (not a ticket):** user runs `ollama pull llama3.2:3b` once before opening the app. If Ollama isn't running, the commentary UI degrades gracefully — the rest of the app is unaffected.

**Dependency order:** 10.1 → 10.2 → 10.3. Each ticket strictly depends on the previous one.

<!-- BEGIN BATCH -->

### 10.1 Ollama client and useCommentator hook

- **Category:** Feature
- **Priority:** High
- **Size:** M
- **Status:** Backlog

## Overview
Add a streaming client for the local Ollama chat API, an event detector that emits a typed event whenever something narratable happens on the Live tab, and a `useCommentator` hook that composes the two. No UI in this ticket — the hook is exposed for 10.2 to consume.

The event detector is the important architectural piece. Calling the LLM on every price tick would be wasteful and noisy. Instead, the hook watches dashboard state and only fires an event when state crosses a meaningful boundary.

## Acceptance Criteria
- [ ] New module `src/lib/ollama.ts` exports `streamChat({ model, system, user, onToken, onDone, signal })` — POSTs to `http://localhost:11434/api/chat` with `stream: true`, parses newline-delimited JSON chunks, calls `onToken(delta)` per chunk, and `onDone(fullText)` when the stream ends
- [ ] `streamChat` accepts an `AbortSignal` so callers can cancel in-flight generations when state moves on
- [ ] New file `src/types/commentary.ts` exports a `CommentaryEvent` discriminated union covering: `signal-change`, `filter-veto`, `ema-cross`, `rsi-zone-enter`, `rsi-zone-exit`, `position-open`, `position-close`, `funding-threshold-cross`
- [ ] New file `src/lib/detectEvents.ts` exports `detectEvents(prev, next): CommentaryEvent[]` — a pure function that compares two dashboard snapshots and returns the events that just fired. Includes all contextual values needed to explain the event (candle close, EMA values, RSI, funding, F&G, veto reason)
- [ ] New hook `src/hooks/useCommentator.ts` subscribes to dashboard state, runs `detectEvents` on each state change, and for each event: builds a short structured prompt, calls `streamChat`, appends a `CommentaryEntry` to an internal buffer, and returns the buffer
- [ ] Commentary buffer is bounded at 50 entries (rolling)
- [ ] Ollama base URL and model are constants at the top of `ollama.ts` with explanatory comments so swapping is a one-line change
- [ ] Default model: `llama3.2:3b`
- [ ] System prompt: "You are a trading coach explaining a paper trading dashboard to a beginner. Keep every response to 2 short sentences. Use plain English. Define any jargon inline. Never give buy/sell advice."
- [ ] If Ollama returns an error or the fetch fails, the hook logs it once per session and returns a single placeholder entry ("Commentary unavailable — is Ollama running on localhost:11434?")
- [ ] Unit tests cover: `detectEvents` fires on each event type, `detectEvents` returns [] when nothing narratable changed, `streamChat` parses NDJSON correctly with a mocked fetch, hook debounces rapid successive events (<500ms apart collapse into one)
- [ ] `docs/glossary.md` gains entries for "Ollama", "local LLM", "commentary event"
- [ ] Commit: `feat: ollama client and commentator hook`

## Notes
The event detector is the thing to get right. Over-fire and the commentary is noise; under-fire and it misses the moments that matter. Start with the 8 events above — they cover all the teaching moments in the v0.1 + Phase 7/8 feature set.

Streaming matters for perceived latency — the first token should appear within ~150ms on llama3.2:3b. Do not buffer the whole response before displaying.

Abort in-flight generations when a new event fires. Stale commentary on old events is worse than no commentary.

The system prompt is deliberately strict about length. The panel in 10.2 has limited vertical space and long commentary wastes it.

---

### 10.2 Commentator panel on the Live tab

- **Category:** Feature
- **Priority:** High
- **Size:** M
- **Status:** Backlog

## Overview
Add a new panel under the Signal Log on the Live tab that renders the commentary buffer from `useCommentator`. Each entry shows the event timestamp, a short event label (e.g. "Golden cross"), and the streaming LLM explanation. Newest entries at the bottom, panel auto-scrolls.

## Acceptance Criteria
- [ ] New component `src/components/CommentatorPanel.tsx` consumes `useCommentator(state)` and renders the commentary buffer
- [ ] Each entry: timestamp (HH:MM:SS), event label (bold, one of the 8 event types formatted human-readably), and explanation text (muted colour, wraps)
- [ ] Currently-streaming entry shows a blinking cursor at the end of the text until `onDone` fires
- [ ] Panel auto-scrolls to the newest entry unless the user has scrolled up (preserve read position)
- [ ] Empty state: "Events will appear here as the market moves. Make sure Ollama is running with `llama3.2:3b`."
- [ ] Error state: shows the single placeholder entry from 10.1 with a muted warning icon, does not keep retrying in a tight loop
- [ ] Panel slots into the right column of the Live tab between SignalLog and EtfFlowsPanel, with a minimum height of 180px and a maximum of 320px (scrolls inside)
- [ ] Panel has a clear header: "LIVE COMMENTARY" with a small Ollama model badge on the right (e.g. "llama3.2:3b")
- [ ] A small "clear" button in the header empties the commentary buffer
- [ ] Unit tests with React Testing Library: renders empty state, renders streaming entry with cursor, renders completed entry, auto-scroll respects user scroll position, clear button empties buffer
- [ ] `docs/glossary.md` gains an entry for "commentary event"
- [ ] Commit: `feat: commentator panel on live tab`

## Notes
This is a pure consumer ticket — all the logic lives in 10.1. Keep the component dumb.

Auto-scroll-unless-user-scrolled-up is the one tricky interaction. Use an `IntersectionObserver` on the bottom sentinel element, or track a `stickToBottom` ref that flips to `false` when the user scrolls up more than 40px from the bottom, and back to `true` when they scroll back down.

Visual style should match the existing Signal Log — same font, same muted colour palette, same terminal feel. It's a diary of what just happened, not a dashboard widget.

---

### 10.3 "Teach me" contextual explanations

- **Category:** Feature
- **Priority:** Medium
- **Size:** M
- **Status:** Backlog

## Overview
Add a "teach me" affordance to every educational element on the dashboard. Clicking the affordance opens a modal that fetches a longer contextual explanation from the same Ollama model, with the element's current value baked into the prompt so the teaching is specific, not generic. This is the explicit educational payoff of Phase 10.

## Acceptance Criteria
- [ ] New component `src/components/TeachMeModal.tsx` — a modal with a title, the current value of the element being explained, a streaming explanation area, and a close button
- [ ] New hook `src/hooks/useTeachMe.ts` that calls the Ollama client with a longer system prompt: "You are a trading coach. The user clicked on {element} in their dashboard and wants a full explanation. Cover: what this is (plain English), what the current value means, why it matters for trading decisions, and one concrete example. ~150 words. Never give buy/sell advice."
- [ ] A small `(?)` icon appears on hover next to: Funding rate in header, F&G in header, EMA 20 label, EMA 50 label, RSI label, each filter name shown in a Signal Log veto entry, and each position row in the Trade Journal
- [ ] Clicking `(?)` opens `TeachMeModal` pre-populated with the element identifier and current value
- [ ] Modal streams the explanation token-by-token — same UX as the commentary panel but taller
- [ ] Modal is keyboard-dismissable (`Esc`) and click-outside-to-close
- [ ] Modal is fully accessible: `role="dialog"`, `aria-labelledby`, focus trap, focus restored to the trigger element on close
- [ ] Each teachable element gets a short `TeachTopic` object with `{ id, label, getContext: (state) => string }` — centralised in `src/lib/teachTopics.ts` so adding a new topic is a one-file change
- [ ] The explanation for a given `(topic, currentValue)` pair is cached in memory for the session to avoid refetching when the user reopens the same modal
- [ ] Unit tests cover: modal opens with correct topic, modal streams explanation, cached explanation returned on re-open, Esc closes modal, focus returns to trigger on close
- [ ] `docs/glossary.md` gains an entry for "teach me"
- [ ] Commit: `feat: teach me contextual explanations`

## Notes
This depends on 10.1 for the Ollama client and 10.2 existing (not strictly required but the shared streaming UX pattern should be factored once, not twice — pull out a `<StreamingText />` component in 10.2 that 10.3 also uses).

The prompts are the main design surface. Draft 3-5 example prompts and their expected outputs before writing code so the model's behaviour is predictable. Keep prompts in `src/lib/teachTopics.ts` not scattered in components.

Cache the results per (topic, value) — the same modal opened twice in a row should not refetch. Invalidate cache when the app unmounts.

Accessibility is non-negotiable on modals. Use the existing shadcn Dialog primitive rather than rolling a new one.

---

### 10.4 Runtime model picker in CommentatorPanel

- **Category:** Feature
- **Priority:** Low
- **Size:** S
- **Status:** Backlog

## Overview
Editing `src/lib/ollama.ts` every time you want to try a different local model is friction. Add a small dropdown in the CommentatorPanel header that lists whatever models are installed in the local Ollama instance, persists the selection to `localStorage`, and overrides the `OLLAMA_MODEL` constant at runtime. A one-click model swap so `llama3.2:3b` vs `qwen2.5:7b` vs anything else the user has pulled becomes an A/B comparison, not a code edit.

Depends on 10.1 (client) and 10.2 (panel) already existing.

## Acceptance Criteria
- [ ] New function `listModels()` in `src/lib/ollama.ts` — GETs `http://localhost:11434/api/tags`, parses the response with zod, returns `string[]` of model names. Returns `[]` on any error (Ollama down, parse fail, network)
- [ ] New hook `src/hooks/useOllamaModels.ts` — calls `listModels()` on mount, exposes `{ models, loading, error }`. Refetch exposed as a function so the dropdown can refresh on open
- [ ] New module `src/lib/modelPreference.ts` exports `getPreferredModel(): string` and `setPreferredModel(name: string): void`. Reads/writes `localStorage` key `cantor.ollamaModel`. Falls back to `OLLAMA_MODEL` constant when unset or when running in a non-browser environment (tests)
- [ ] `streamChat` calls in `useCommentator` and (when 10.3 ships) `useTeachMe` read the model from `getPreferredModel()` instead of the constant directly
- [ ] CommentatorPanel header gains a small `<select>` dropdown (or shadcn Select) to the right of the existing `llama3.2:3b` badge — which is now driven by `getPreferredModel()` rather than the constant
- [ ] Dropdown shows all installed models from `useOllamaModels()`. Currently-selected model is highlighted. Selecting a new model calls `setPreferredModel()` and immediately updates the badge
- [ ] When Ollama is unreachable, the dropdown is disabled and shows a tooltip "Ollama unreachable — showing last saved model"
- [ ] Changing the model does NOT retroactively rewrite existing commentary entries. New events use the new model
- [ ] Unit tests cover: `listModels` parses a valid `/api/tags` response, `listModels` returns `[]` on error, `getPreferredModel` returns the stored value when present, `getPreferredModel` falls back to the constant when unset, selecting a new model in the dropdown persists to localStorage and updates the badge, dropdown disabled state when Ollama is unreachable
- [ ] `docs/glossary.md` gains an entry for "model picker"
- [ ] Commit: `feat: runtime model picker for commentator`

## Notes
Keep this strictly additive. `OLLAMA_MODEL` stays as the fallback constant — the picker layers on top of it, it doesn't replace it. That way nothing breaks if localStorage is cleared or the hook fails.

`/api/tags` returns an object like `{ models: [{ name: "llama3.2:3b", ... }, ...] }`. Parse defensively — model metadata has changed shape across Ollama versions.

This pairs naturally with the **Per-event severity** follow-up mentioned at the bottom of this doc: once you can swap models at will, comparing which model writes better commentary on the same event stream becomes the obvious next experiment.

<!-- END BATCH -->

## After this batch

Signals-in-plain-English is the headline feature of Phase 10. Once it lands, a few follow-ups become natural:

- **Session recap** — a button on the Performance tab that feeds the whole day's commentary events plus the trade journal to `qwen2.5:7b` and asks for a paragraph summarising what happened today and what the dashboard "learned". Daily journal automation.
- **Why did this trade happen?** — click any entry in the Trade Journal for an after-the-fact explanation of the filter state, funding, F&G, and RSI at the moment the trade fired. Uses the same pattern as 10.3 but with historical state.
- **Prompt tuning UI** — a hidden settings page where you can edit the system prompts and event detector thresholds without a rebuild. Power-user feature.
- **Per-event severity** — weight events so the commentary panel can visually de-emphasise routine events and highlight dramatic ones (e.g. Fear & Greed crossing 85 should look louder than a normal EMA cross).

None of these are in Phase 10 because they're polish on top of a working base. Ship the base first.
