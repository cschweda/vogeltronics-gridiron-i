# VogelTronics *Gridiron* (Gridiron 1) — Web Recreation Spec + Build Prompt

*A solo, keyboard-playable, browser homage to the 1977 Mattel Electronics Football, rebuilt as an original product of the VogelTronics universe ("Games That Think!"). Vite + TypeScript, deployable on Netlify. This is a standalone game — **Gridiron 1, running only**. A separate future project, **Gridiron 2**, will reuse this engine and add passing (and whatever Mattel Football II introduced). All mechanics below come from the original 1977 Mattel manual.*

---

## 1. Feasibility verdict

**Yes — squarely doable, and close to an ideal small project.** The original is a 3-lane × 9-yard LED grid driven by a modified calculator chip: no sprite art, no 3D, no networking. It maps almost one-to-one onto a CSS/SVG grid, a fixed-timestep tick loop, keyboard + pointer input, and the Web Audio API for the beeps. The whole thing is a static bundle Vite builds and Netlify serves — no backend. A single build pass ships a faithful v1.

Because Gridiron 2 is a later, separate project, the one design rule that matters up front is **clean seams**: keep the engine (state, loop, rules, defenders, audio, render) framework-free and free of running-only assumptions baked into shared code, so Gridiron 2 can import it and add a passing state without a rewrite. Solo-only simplifies everything else.

---

## 2. Authentic mechanics (from the 1977 manual, adapted to solo)

**Display.** A red-LED field, **3 rows × 9 columns** of blips. The visible field is **9 yards long**; the full field is 100 yards and scrolls. The **running back** is one **bright** blip; there are **five dimmer blips = the defensive tacklers**. (Offer a "dash" vs "round blip" display variant — both shipped on real units; **B** key or a small faceplate toggle.)

**Solo play.** You control the running back on offense; the **computer controls the defense** (its only role). You're always on offense — start each play on the **left** and run right, accumulating score across the game clock. (The original was a 2-player HOME/VISITOR game with alternating possession; solo keeps you on offense throughout, so the 3rd-quarter possession handoff becomes a **halftime reset** — Q3 opens on a fresh 1st & 10 at your own 20, see Clock. The scoreboard's VISITOR window stays `0`, preserving the authentic three-window look.)

**Movement.** The running back moves **1 yard per key press** (discrete, not held). Arrow keys: **▲ / ▼** change lanes; **►** runs toward the goal (the original's forward key wears a two-headed **◄▶** glyph — "toward the opponent's goal," which in solo is always right). No backward running (authentic to this model). The **first direction press starts the play** — the clock starts and the tacklers begin to rush.

**Pre-snap formation.** The runner (bright) lines up in **column 0, middle row** — the manual (p. 6) starts him at his own end of the field, centered before the goal posts. The manual fixes no defensive formation — its two field diagrams show *different* scatters — so the defense lines up **semi-randomly each play** (seeded RNG): 5 defenders in distinct cells across **columns 2–8**, always at least one deep man in **columns 6–8** (the manual's deep safety), never in columns 0–1. One blip per cell — defenders never overlap.

**Tackling.** A tackle occurs whenever the runner and a defender occupy the **same cell — no matter who moved into whom** (front, side, or behind; this is also what keeps forward-mashing honest). On a tackle the **referee's whistle** sounds, the play ends, and **the tackler that made the hit blinks on/off** (~2 Hz, hard-capped below 3 flashes/sec for photosensitivity) until ST/SC is pressed. Under `prefers-reduced-motion` the blink is replaced by a **steady-bright** tackler (all others stay dim) — the information survives without flashing.

**Field scroll.** If the runner clears the 9-yard window in one run, the computer returns him to the start and play continues (the field scrolled 9 yards).

**Downs & scoring.** 4 downs to gain 10 yards for a first down. **Touchdown = 7**, **Field goal = 3**. Every score plays the **VogelTronics scoring fanfare** — an original bugle-style riff with ballpark energy. (The real unit played the stadium "Charge!" melody, which carries a genuine composition claim; we deliberately don't quote it — or any other real tune.)

**Kicking (K key, 4th down only; ignored on downs 1–3).** A kick travels **1–65 yards** (uniform, via the seeded RNG) — and that single roll *is* the punt-vs-FG decision, the simplest mechanism consistent with the manual's three statements (p. 3: kicks travel 1–65 yards; the computer alone chooses punt vs field goal; your FG odds improve the nearer you are): if the kick **reaches the goal line (distance ≥ yards to goal)** it's a **made field goal** — **fanfare**, 3 points; if it falls short it's a **punt** — **two whistles**. There is **no missed-FG state**, and from beyond 65 out a kick is always a punt. On 4th down you may instead run; failing is a **turnover on downs** — **two whistles**. *Two whistles always mean: drive over, no points.*

**Drive endings (solo restart rule).** With no opponent offense, every drive ends the same way: **the next drive starts 1st & 10 at your own 20** —

| Drive ends by | Points | Sound | Next drive |
|---|---|---|---|
| Touchdown | +7 | fanfare | own 20 |
| Made field goal | +3 | fanfare | own 20 |
| Punt | 0 | two whistles | own 20 |
| Turnover on downs | 0 | two whistles | own 20 |

*Design note:* the manual itself restarts the receiving team **at its own 20 after a field goal** (p. 3) — the flat restart just extends that rule to every drive end. Restarting at the dead-ball spot would make 4th-down failure free, and mirroring field position would make going-for-it strictly beat punting by exactly the punt distance. The flat own-20 restart keeps the real 4th-down decision — in FG range, kick for a likely 3 vs go for 7 — and prices a dead drive in the currency that matters here: **clock**.

**Status readout (ST key).** Shows **DOWN — FIELD POSITION — YARDS TO GO** on the LED digits, and readies the field for the next play. The field-position window draws the 50-yard line as a small vertical **tack mark** and puts the number on the ball's side of it *(authentic display — manual p. 2)*: your own 40 reads **`40⊣`**, the opponent's 40 reads **`⊢40`** (so `3 · 42⊣ · 4` = 3rd down, your own 42, 4 to go); at exactly the 50, no marker — our default, the manual doesn't cover it. Rendered as LED segments, not text. **Goal-to-go rule:** under 10 yards from the goal line, the yards-to-go box shows **nothing** (the manual keys this to distance-to-touchdown, not to the first-down marker — p. 2).

**Score readout (SC key).** Shows **YOUR score — TIME REMAINING — 0**, and also readies the field for the next play. *You must press ST or SC after each play to set up the next one.*

**Clock.** Four 15-minute quarters, but fast: a quarter lasts **~2½ real minutes** (~10-minute game) — the clock drops 0.1 game-minute per real second and **only ticks during a play**. It counts in **decimals** (7½ reads `7.5`) and shows `0.0` at quarter's end (the manual's `0:0`, rendered decimal for display consistency), then resets to 15 on the next play. If the clock hits zero mid-play, the play runs to completion — the quarter (or in Q4, the game) ends when the play resolves. Quarter transitions (manual p. 4): into Q2 and Q4, **field position, down, and yards to go carry over** the break; at halftime, **Q3 opens on a fresh 1st & 10 at your own 20** — the solo stand-in for the manual's second-half possession change. You start the game 1st & 10 on your own 20; press ST to roll into each new quarter. Game ends when the clock expires in the 4th.

**Skill switch — OFF / PRO 1 / PRO 2.** PRO 1 = normal defense speed; **PRO 2 = defense reacts 50% faster**. Switching between PRO 1 and PRO 2 mid-game **ends the game**. New game = switch **OFF, then back**. The on-screen slide switch is always live, like the physical flip. **Keyboard 0 (OFF) works at any time** — it's the deliberate keyboard abort: press 0, then 1 or 2, for a fresh game without touching the pointer (0 sits isolated at the far right of the number row; accident risk is negligible). **Keyboard 1/2 work only between games** — on QWERTY they sit directly above W, and a stray reach for W must never flip PRO levels mid-drive.

**Defensive AI.** Five tacklers home in on the runner but move unpredictably — the manual's whole pitch (p. 6) is that you can never be sure when or where the next tackler will shift. Classic play: draw the defense to one sideline, then cut back — and watch the deep safety.

---

## 3. VogelTronics identity (original industrial design)

Keep the *interaction grammar* of a 1977 LED football handheld; give it a **wholly original VogelTronics body**. This is period practice, not evasion: Coleco, Entex, and the rest all shipped their own LED football units — different cases, colors, and button layouts, same game. Do **not** replicate any real unit's silhouette, speaker grille, faceplate layout, or graphics — trade-dress distance is part of the design brief. Era-authentic materials, original shape.

- **Model:** GRIDIRON badge on the faceplate, plus a small "NO. 2100 · 1977" plate (catalog number per the VogelTronics history canon — it's on the box art).
- **Maker mark:** VogelTronics vector logo (reuse the repo's SVG), "Games That Think!" tagline, "Elk Grove Village, ILL." molded line.
- **Palette:** period ABS — charcoal or faux-woodgrain bezel, deep-maroon LED window, red LEDs (`#ff2a1a` bright / `#5a0d08` dim), cream/orange keycaps. **All colors as CSS custom properties** so skins swap (and so Gridiron 2 can adopt its own).
- **Type:** no external fonts (matches the repo rule) — system monospace + inline SVG logo. Subtle LED bloom via `box-shadow`/`filter`.
- **Copy voice:** affectionate-parody enthusiasm ("The pocket gridiron that thinks two plays ahead!"). Invent no real trademarks.

---

## 4. Controls (keyboard + pressable on-screen keys → one command enum)

**Keyboard-first rule.** Every action in the game is fully playable from the physical keyboard — the pointer is **never required**. The on-screen keys mirror the keyboard (pressable, and they light up when the matching key is hit), not the other way around.

| Action | Keyboard | On-screen |
|---|---|---|
| Run toward goal | **D** / **→** | ◄▶ *(the original's two-headed forward key)* |
| Lane up / down | **W** / **S** (**↑ / ↓**) | ▲ ▼ |
| Status (down / pos / to-go) | **T** | **ST** |
| Score (your score / time) | **C** | **SC** |
| Kick (4th down only) | **K** or **Space** | **K** |
| Skill OFF / PRO 1 / PRO 2 | **0** = OFF *(works anytime — the abort / new-game path)*; **1 / 2** *(between games only)* | 3-way slide switch |
| Mute | **M** | speaker toggle |
| Blip style (dash / round) | **B** | small faceplate toggle |

On-screen keys must be **truly pressable**: commands fire on `pointerdown` (not `click`), with depress states, `:active` animation, and highlight-sync when the matching physical key is pressed. Every button **blurs after `pointerup`** — so Space can never re-trigger the last-clicked key — and controls get `touch-action: manipulation` (no double-tap zoom). **Tab is deliberately unbound**; it stays reserved for keyboard focus navigation. On mobile the on-screen keys are the primary input (thumb-sized), laid out like the on-screen cabinet. Remember: **one yard per discrete press**, and the **first direction press of a play starts the clock and the rush**. Ignore OS key auto-repeat (`event.repeat`) — one yard requires one physical press; holding a key must never auto-run. **A** is intentionally unbound: the 1977 game has no backward running (Gridiron 2 will claim it).

---

## 5. Technical architecture

**Stack:** Vite + TypeScript, vanilla TS (tiny bundle, no framework). Web Audio API for sound. Static build on Netlify.

**Modules**

- `main.ts` — bootstrap; wire input, audio, render to the loop.
- `engine/state.ts` — one `GameState` + explicit **state machine**: `POWER_OFF → PRESNAP → PLAY → TACKLED → SCORE_TD → KICK → STATUS → SCOREBOARD → QUARTER_BREAK → GAME_OVER`.
- `engine/loop.ts` — fixed-timestep tick; defenders advance on a skill-scaled interval (PRO 2 = 1.5× rate). Clock accrues only while state == `PLAY`.
- `engine/rules.ts` — downs, yardage, first downs, 100-yard field position, goal-to-go, scoring (7 / 3), kick resolution (single 1–65 yd roll: reaches the goal = FG, short = punt), turnover-on-downs, the flat own-20 drive restarts, quarter carryover + halftime reset, quarter/clock logic (decimal, fast, reset).
- `engine/defenders.ts` — 5 tacklers; per-play randomized pre-snap scatter (columns 2–8, ≥1 deep man in 6–8); semi-stochastic lane-seeking pursuit; PRO 1 vs PRO 2 cadence; mark the tackler that made the hit so the renderer can blink it; all randomness drawn from the injected RNG.
- `engine/rng.ts` — seedable PRNG (mulberry32 or similar). **Every random draw in the game** — defender moves, kick distance, punt-vs-FG choice — flows through one injected instance: replayable games, deterministic tests.
- `render/led.ts` — pure fn `Blip[] → 3×9 lit grid` (`off | dim | bright | blink`). The engine emits a display-agnostic blip list (`{row, col, intensity, blink}`); the renderer never knows which blip is the runner — Gridiron 2's ball and receivers will render here unchanged.
- `render/status.ts` — the numeric ST readout (`DOWN | POS◄▶ | TO-GO`, goal-to-go blank) and SC readout (`SCORE | TIME | 0`) as LED digits.
- `render/cabinet.ts` — SVG faceplate: bezel, LED window, GRIDIRON/VogelTronics badges, ST/SC/K keys, arrow keys, OFF/PRO1/PRO2 slide switch.
- `audio/sound.ts` — `AudioContext` wrapper: `step()`, `whistle()` (tackle, single), `doubleWhistle()` (punt / turnover on downs), `fanfare()` (any score / made FG — an **original** bugle-style riff, *never* the stadium "Charge!" melody), `kick()`. Oscillators + gain envelopes only, **no audio files**. Lazily unlock on first gesture; honor mute.
- `input/keyboard.ts` + `input/buttons.ts` — normalize into the command enum; buttons fire on `pointerdown` and blur on `pointerup`.
- `styles.css` — skin custom properties; honor `prefers-reduced-motion` (blink substitute — see Tackling); `touch-action: manipulation` on controls.

**Rendering:** SVG cabinet (crisp, scalable, matches the repo's vector aesthetic); LED grid as SVG rects toggling `data-lit`; CSS glow. Keep the render layer a **pure function of state** — deterministic and testable. Engine modules contain **no DOM / `window` / `document` references** — they must import cleanly in Node (Vitest) and, later, in Gridiron 2.

**Verification:** Vitest unit tests on `rules.ts` (down/yardage/first-down, goal-to-go blanking, 7/3 scoring, kick boundary — distance ≥ yards-to-goal = FG, short = punt, beyond 65 always a punt — turnover-on-downs, own-20 restarts, quarter carryover + halftime reset, decimal-clock reset) and `defenders.ts` (PRO 2 cadence faster than PRO 1; pre-snap scatter respects columns 2–8 with a deep man). One smoke test that a **seeded** drive reaches a touchdown. **All tests use fixed RNG seeds** — deterministic, no flakes. Typechecks clean, no console errors.

**Deploy:** `netlify.toml` — `command = "npm run build"`, `publish = "dist"`, Node pinned. No redirects (single page, no routing — a catch-all would only mask asset 404s). No env vars.

---

## 6. Repo layout

```
gridiron/
├─ .gitignore         # Node/Vite ignores (node_modules, dist, .env, logs, .DS_Store)
├─ .nvmrc             # Node version, matching the netlify.toml pin
├─ LICENSE            # MIT, © 2026 Chris Schweda
├─ README.md          # what it is, run steps, controls, Netlify deploy
├─ CHANGELOG.md       # Keep a Changelog format, starting at 0.1.0
├─ index.html
├─ netlify.toml
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
├─ public/            # favicon, og image, vogeltronics-logo.svg
└─ src/
   ├─ main.ts
   ├─ styles.css
   ├─ types.ts
   ├─ engine/  (state.ts loop.ts rules.ts defenders.ts rng.ts)
   ├─ render/  (led.ts status.ts cabinet.ts)
   ├─ audio/   (sound.ts)
   └─ input/   (keyboard.ts buttons.ts)
```

---

## 7. Scope

**v1 = the whole game:** power switch (OFF/PRO1/PRO2), solo running plays on the 3×9 grid with 5 tacklers, tackler-blink, one-yard discrete movement, downs/yards/first downs, TD + 4th-down kick (single 1–65 roll: FG if it reaches the goal, else punt) + turnover-on-downs with the flat own-20 restart, ST/SC readouts with the goal-to-go rule and authentic ⊣/⊢ tack marker, fast decimal clock over 4 quarters with carryover + halftime reset, authentic whistles + an original scoring fanfare, pressable keys + WASD, dash-vs-round-blip display toggle, seeded RNG, VogelTronics skin, Netlify deploy.

**Nice-to-haves:** CRT/LED bloom toggle, in-session high score, box-art splash, mute/reduced-motion state encoded in the URL (no localStorage).

**Out of scope (belongs to Gridiron 2, a separate project):** forward passing, receivers, and anything Mattel Football II added. Gridiron 2 will import this engine — so keep shared code passing-agnostic but not passing-hostile.

---

## 8. Build prompt (hand this to Claude)

> Paste the block below as a fresh task. It's self-contained.

```text
You are an expert TypeScript game developer. Build a complete, deployable
browser game: GRIDIRON — a faithful SOLO recreation of the GAMEPLAY of the
1977 Mattel Electronics Football handheld (running game only), delivered as an
original product of the fictional company VogelTronics (tagline "Games That
Think!", Elk Grove Village, Illinois, 1977). Affectionate parody only — invent
no real trademarks, quote no real product's text or music, and copy no real
product's appearance. This is a
standalone game; a future SEPARATE project ("Gridiron 2") will reuse this
engine and add passing, so keep engine code framework-free and free of
running-only assumptions that would block a later passing state — but do NOT
build any passing now.

STACK & DELIVERY
- Vite + TypeScript, vanilla TS (no React/Vue). Web Audio API for sound.
- Static build deployable on Netlify: include netlify.toml (command
  "npm run build", publish "dist", Node pinned; NO redirects — single page,
  and a catch-all redirect would only mask asset 404s).
- Ship a runnable repo (package.json, vite.config.ts, tsconfig.json, index.html,
  src/). `npm i && npm run dev` must work, `npm run build` must typecheck clean
  with no console errors.
- Include standard repo files: .gitignore (Node/Vite: node_modules, dist, .env*,
  logs, .DS_Store), .nvmrc matching the Node version pinned in netlify.toml,
  LICENSE (MIT, "Copyright (c) 2026 Chris Schweda"), README.md (what it is, quick
  start, controls table, Netlify deploy steps), and CHANGELOG.md in Keep a
  Changelog format with an initial 0.1.0 entry describing the v1 feature set.
- The README must end with a DISCLAIMER: Gridiron is an original, independent
  homage, not affiliated with or endorsed by Mattel; no trademarks, logos, art,
  assets, or code from the original product are used; all VogelTronics/Gridiron
  names and art are fictional and original; the manual was consulted only to
  recreate gameplay rules and feel (game rules are not copyrightable).

DISPLAY (match the original exactly)
- A red-LED field, 3 rows x 9 columns of blips. Visible field is 9 yards; the
  full field is 100 yards and scrolls. If the runner clears the 9-yard window in
  one run, return him to the start and continue (field scrolled 9 yards).
- The running back is ONE BRIGHT blip. There are FIVE DIMMER blips = the
  defensive tacklers. Provide a display toggle for "dash" vs "round blip"
  (B key + a small faceplate toggle).

SOLO PLAY
- Single player controls the running back on offense; the COMPUTER controls the
  defense (its only role). The player is always on offense: each play starts on
  the LEFT and runs right, accumulating score across the game clock. No second
  player; the original's 3rd-quarter possession handoff becomes a halftime
  reset (see CLOCK). The scoreboard's VISITOR window stays 0.

MOVEMENT & PLAY FLOW
- Pre-snap: the runner (bright) lines up in column 0, middle row, at his own
  end of the field. The defense lines up SEMI-RANDOMLY each play (seeded
  RNG): 5 defenders in distinct cells across columns 2-8, always at least one
  deep man in columns 6-8 (the "safety"), never in columns 0-1. One blip per
  cell — defenders never overlap.
- The running back moves exactly 1 YARD PER DISCRETE KEY PRESS (not held). Up/
  down change lanes; right runs toward the goal. No backward running.
- The FIRST direction press of a play starts the clock AND starts the tacklers
  rushing. A tackle occurs whenever the runner and a defender occupy the SAME
  CELL — no matter who moved into whom (front, side, or behind). On a tackle:
  play a single referee WHISTLE, end the play, and BLINK the tackler that made
  the hit (~2 Hz, hard cap below 3 flashes/sec) until ST or SC is pressed.
- After every play the user MUST press ST or SC to set up the next play.

RULES & SCORING
- 4 downs to gain 10 yards for a first down. Touchdown = 7, Field goal = 3.
  Every score plays the SCORING FANFARE (see SOUND).
- KICK (K key, 4th down ONLY; pressing K on downs 1-3 does nothing): the kick
  travels 1-65 yards (uniform, seeded RNG), and that single roll IS the
  punt-vs-FG decision: if the kick reaches the goal line (distance >= yards
  to goal) it is a MADE FIELD GOAL — fanfare, 3 points; if it falls
  short it is a PUNT — two whistles. There is NO separate missed-FG state;
  "closer = likelier FG" emerges naturally, and from beyond 65 yards out a
  kick is always a punt. Running on 4th and failing = TURNOVER ON DOWNS:
  double whistle. Double whistle always means "drive over, no points."
- SOLO RESTART RULE (important): EVERY drive ends back at 1st & 10 on YOUR OWN
  20 — after a touchdown, made FG, punt, or turnover on downs alike (the 1977
  manual itself restarts the receiving team at its own 20 after a field
  goal). Do NOT restart at the dead-ball spot (that makes 4th-down failure
  free) and do NOT mirror field position (that makes going for it strictly
  dominate punting). The flat own-20 restart preserves the real 4th-down
  decision — in FG range, kick for a likely 3 vs go for 7 — and a dead drive
  costs what it should: clock.

READOUTS (rendered as LED digits)
- ST (Status): show DOWN | FIELD POSITION | YARDS TO GO, and ready the field for
  the next play. The field-position window draws the 50-yard line as a small
  vertical tack mark and puts the number on the ball's side of it (authentic
  1977 display): your own 40 reads 40⊣, the opponent's 40 reads ⊢40; at
  exactly the 50, no marker. Render the tack as LED segments, not text.
  GOAL-TO-GO RULE: inside 10 yards of the goal, the yards-to-go box shows
  nothing.
- SC (Score): show YOUR SCORE | TIME REMAINING | 0 (visitor window stays 0), and
  ready the field for the next play.

CLOCK
- Four 15-minute quarters, but fast: a quarter lasts ~2.5 real minutes (~10-min
  game) — the clock drops 0.1 game-minute per real second and ONLY ticks during
  a play. It counts in DECIMALS (7.5 = 7 1/2 min), shows 0.0 at quarter end,
  then resets to 15 on the next play. If the clock hits zero mid-play, the play
  runs to completion; the quarter (or in Q4, the game) ends when the play
  resolves. Into Q2 and Q4, field position, down, and yards to go carry over
  the break; at halftime, Q3 opens on a fresh 1st & 10 on your own 20. Start
  the game 1st & 10 on your own 20; press ST to roll into each new quarter;
  game ends when the 4th-quarter clock expires.

SKILL SWITCH
- A 3-way slide switch: OFF / PRO 1 / PRO 2. PRO 1 = normal defense speed; PRO 2
  = defense reacts 50% FASTER. Switching between PRO 1 and PRO 2 mid-game ENDS
  the game. New game = switch OFF, then back to PRO 1 or PRO 2.
- The on-screen slide switch is always live (a deliberate pointer action, like
  the physical flip). Keyboard 0 (OFF) also works at any time — the deliberate
  keyboard abort for a restart. Keyboard 1/2 work only between games, so a
  stray reach near W can never flip PRO levels mid-drive.

CONTROLS (keyboard AND pressable on-screen keys -> one command enum)
- KEYBOARD-FIRST: the game must be 100% playable from the physical keyboard —
  the mouse/touch buttons are a mirror, never a requirement (on mobile the
  on-screen keys take over as primary).
- D/Right = run toward goal; W/S or Up/Down = lane change. A is intentionally
  unbound (no backward running in 1977; Gridiron 2 will claim it). The
  on-screen forward key wears the original's two-headed ◄▶ glyph ("toward the
  opponent's goal" — in solo, always right).
- T = ST; C = SC; K or Space = Kick; M = mute; B = blip-style toggle. Key 0 =
  OFF and works AT ANY TIME — the keyboard abort: 0, then 1 or 2, starts a
  fresh game. Keys 1/2 = PRO 1/PRO 2 and work only between games (on QWERTY
  they sit directly above W; a stray reach must never flip difficulty
  mid-drive). NEVER bind Tab — it stays reserved for keyboard focus
  navigation.
- Ignore OS key auto-repeat (event.repeat): one yard requires one distinct
  physical press; holding a key must never auto-run.
- On-screen keys must be truly pressable: commands fire on pointerdown (not
  click), with depress states, :active animation, and highlight-sync when the
  matching key is pressed. Every button BLURS after pointerup — Space must
  never re-trigger the last-clicked button — and controls use touch-action:
  manipulation (no double-tap zoom). On mobile the on-screen keys are primary
  input (thumb-sized), laid out like the cabinet: arrow keys on the right,
  ST/SC/K keys, and the slide switch.

SOUND (Web Audio, oscillators only, NO audio files)
- step (per move), single whistle (tackle), double whistle (punt / turnover
  on downs), scoring fanfare (any score or made FG), kick. The fanfare must be
  an ORIGINAL 5-7 note bugle-style riff — ballpark energy WITHOUT quoting the
  stadium "Charge!" melody (it carries a real composition claim) or any other
  real tune. Lazily unlock the AudioContext on first user gesture; honor a
  mute toggle.

LOOK (VogelTronics original design, period-authentic 1977)
- Design an ORIGINAL cabinet: evoke the 1977 LED-handheld era the way Coleco
  and Entex did with their own football units — same game, own body. Do NOT
  replicate any real unit's casing, silhouette, speaker grille, or faceplate
  layout.
- Render the handheld cabinet as SVG: charcoal/woodgrain bezel, deep-maroon LED
  window, red LEDs (#ff2a1a bright / #5a0d08 dim / blink), cream/orange keycaps.
- Badges: "GRIDIRON", "NO. 2100 - 1977", a VogelTronics vector logo, "Games
  That Think!", "Elk Grove Village, ILL." Use CSS custom properties for ALL skin
  colors so skins swap. No external fonts (system monospace + inline SVG). Add
  subtle LED glow via box-shadow/filter. Under prefers-reduced-motion, replace
  the tackler blink with a steady-bright tackler (all others stay dim) and drop
  nonessential animation — the tackle information must survive without
  flashing.

ARCHITECTURE
- engine/: state.ts (single GameState + explicit state machine: POWER_OFF,
  PRESNAP, PLAY, TACKLED, SCORE_TD, KICK, STATUS, SCOREBOARD, QUARTER_BREAK,
  GAME_OVER), loop.ts (fixed-timestep tick; clock accrues only in PLAY;
  defenders on a skill-scaled interval), rules.ts (downs/yards/goal-to-go/
  scoring/single-roll kick/turnover/own-20 restarts/quarter carryover +
  halftime reset/clock), defenders.ts (5 tacklers, per-play random pre-snap
  scatter, semi-stochastic lane-seeking pursuit, PRO1 vs PRO2 cadence, mark
  the tackler that hit), rng.ts (seedable PRNG, e.g. mulberry32).
- ALL randomness — defender moves, kick distance, punt-vs-FG choice — flows
  through ONE injected RNG instance, so games are replayable and tests are
  deterministic.
- The engine emits a display-agnostic blip list ({row, col, intensity:
  dim|bright, blink: boolean}); the render layer never knows which blip is the
  runner, so Gridiron 2 entities (ball in flight, receivers) will render with
  zero render-layer changes.
- render/: led.ts (pure fn: blip list -> 3x9 lit grid with off/dim/bright/
  blink), status.ts (ST and SC numeric readouts as LED digits, goal-to-go
  blanking), cabinet.ts (SVG faceplate + keys + slide switch).
- audio/sound.ts, input/keyboard.ts, input/buttons.ts, types.ts, styles.css.
- Keep the render layer a PURE FUNCTION of state (deterministic, testable).
  Engine modules are framework-free and contain NO DOM/window/document
  references — they must import cleanly in Node (Vitest) and in the later
  Gridiron 2.

QUALITY
- Vitest unit tests for rules.ts (down/yardage/first-down, goal-to-go blanking,
  7/3 scoring, kick boundary: distance >= yards-to-goal = FG, short = punt,
  beyond-65 always punts, turnover-on-downs, the flat own-20 restart, quarter
  carryover + halftime reset, decimal-clock reset) and defenders.ts (PRO 2
  cadence faster than PRO 1; pre-snap scatter respects columns 2-8 with a
  deep man). One smoke test that a seeded drive reaches a touchdown.
- Every test runs with a FIXED RNG seed — fully deterministic, zero flaky
  tests.

Build the complete repo in place in the current working directory. When done,
run the tests and the production build yourself and report the results, then
finish with run instructions, the controls table, and Netlify deploy steps.
Ask at most 2 clarifying questions ONLY if a decision would change the
architecture; otherwise proceed with sensible defaults and note the
assumptions.
```

---

*Fidelity sourced from the original 1977 Mattel Electronics Football instruction manual (`docs/Mattel-Football.pdf` — kept local and gitignored, not redistributed), cross-checked against the Handheld Games Museum. Adapted to solo play at the designer's direction; passing deferred to the separate Gridiron 2 project. The solo restart rule (own-20, extending the manual's post-FG rule), the single-roll kick model (the simplest mechanism consistent with the manual's kick description), the per-play defensive scatter (the manual fixes no formation), the halftime reset, the original cabinet design and scoring fanfare (era-evoking; nothing copied from any real unit's trade dress, and no quotation of the "Charge!" melody), and web-platform adaptations (T instead of Tab, between-games skill keys, pointerdown/blur behavior, reduced-motion blink substitute, seeded RNG) are deliberate design decisions, documented in §2, §4, and §5.*

---

## Disclaimer

Gridiron is an original, independent work created as an **affectionate homage** to the 1977 Mattel Electronics Football handheld — a product the author loved very much. It is **not affiliated with, endorsed by, sponsored by, or connected to Mattel, Inc.** in any way.

No trademarks, logos, brand names, product names, artwork, or other marks from Mattel or the original game are used. "VogelTronics," "Gridiron," and all associated names, logos, casing, and copy are **wholly fictional and original**. The instruction manual referenced during design was used **only to understand and recreate the gameplay rules and feel**; game rules and mechanics themselves are not protected by copyright.

**No code, ROM, chip firmware, assets, or other material from the original product is used or reproduced.** The entire implementation is written from scratch. "Mattel" and "Mattel Electronics Football" are referenced solely for descriptive and historical purposes and remain the property of their respective owner.
