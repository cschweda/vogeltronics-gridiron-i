# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] — 2026-07-25

### Changed

- The social card now reads `gridiron.vogeltronics.com` rather than the bare
  `vogeltronics.com`, which resolves to the corporate history and not to this
  game. The shared generator requires `--url` now, so no card can inherit a
  default that is wrong for it.
- README: the universe links no longer describe the apex as the catalog. The
  apex is the history; the catalog is indexed at MetaIncognita; each game sits
  on its own subdomain.

## [0.2.0] — 2026-07-25

Playability. The first version was faithful and nearly unplayable; this one is
still faithful.

### Changed

- **The defense is slower — 560ms between moves, up from 360ms.** What decides
  the game is defender moves per player key-press, and the old value was tuned
  against a simulation that pressed every 200ms and always found the open lane.
  A person is slower than that and less perfect, so real play sat at the
  shut-out end of the curve. Measured over 600 seeded drives per cell, PRO 1
  now scores on ~100% of drives at a brisk 250ms press and ~39% at an unhurried
  300ms; PRO 2 stays a real step up at 39% / 25%.
- **The pre-snap scatter no longer seats a tackler on the runner's first
  stride.** Columns 2–8 is legal by the manual, but a tackler at column 2 in
  the middle lane is two presses from a runner starting at column 0 — the play
  was over before the defense had moved once. That one cell is now held open.
- **Any play key continues after the whistle**, not only ST/SC. The 1977 unit
  needed that press because the readout was the only way to learn the
  situation; here it is already on screen. ST and SC keep their extra meaning
  of choosing which numbers show. Settings toggles deliberately do not continue
  the game.
- **Sound starts off.** The original had no volume control and beeped from the
  moment you switched it on. A web page that does that is rude, so the player
  opts in with M or the speaker control; the choice survives power cycles.
- **The window legend moved above the display and now follows the readout** —
  `DOWN · POSITION · TO GO` against ST, `YOUR SCORE · TIME LEFT · VISITOR`
  against SC, and `GOAL TO GO` when that window goes dark. Below the display,
  the whole nine-yard blip field came between a label and the number it named.

### Added

- **Display zoom**, stepping 1× / 2× / 3× — on **Z**, an on-screen control, and
  the **mouse wheel** over the cabinet. The wheel never traps the page: at the
  largest and smallest sizes it is left alone entirely, so it scrolls as usual
  once the zoom has nowhere to go. Ctrl/Cmd + wheel stays the browser's own
  zoom. Wheel deltas accumulate, so a trackpad works and a stray nudge does not.
- **"The Years Ahead"** in the Owner's Manual — a 1977 VogelTronics prediction
  of the home computer, written the year after the Altair, confidently
  forecasting a machine in every den "sold in the same department as the
  refrigerators" and describing, among other things, a small wheel beneath the
  hand for sizing the field. Played entirely straight, as the house voice
  requires.

### Fixed

- **The 50-yard tack mark was unreadable.** Its arms were drawn over the last
  digit — `armX` at 376 against a digit spanning 356–390 — so number and
  bracket fused into one wide shape and read as an unexplained bar. The tacks
  are anchored to the digits' real extents now, with longer arms, and the
  window label names the half so the convention is taught rather than assumed.
- **The cabinet had never reached its intended size.** It sized itself with
  `min(…, 100%)` inside a shrink-to-fit parent, so the percentage resolved
  against a box that was itself sized by the cabinet. It had been pinned at
  ~364px instead of 30rem, and zoom appeared to do nothing until the mount
  point was given a definite width.
- The first sound of a session could play while muted: events were sounded
  before the mute flag was synced.
- Powering off left the numeric windows lit.
- After a tackle the spoken description named the drive that had just ended
  rather than the one about to start.

## [0.1.0] — 2026-07-25

First playable release: the whole of Gridiron 1, running game only.

### Added

- **Solo running game** on a 3×9 red-LED field — one bright blip against five
  dimmer tacklers, one yard per discrete key press, no backward running.
- **Downs and scoring** — four downs to gain ten, touchdown 7, field goal 3,
  goal-to-go blanking inside the 10, turnover on downs.
- **Single-roll kick model** (4th down only): one uniform 1–65 yard roll decides
  punt vs field goal — reach the goal line and it is good, fall short and it was
  a punt. No missed-field-goal state; beyond 65 yards out every kick punts.
- **Flat own-20 restart** after every drive ending, so a dead drive costs clock
  rather than field position and the real 4th-down decision survives.
- **Fast decimal clock** over four quarters, running only while the ball is
  live, with field position carried across the Q1→Q2 and Q3→Q4 breaks and a
  halftime reset standing in for the original's possession change.
- **Defensive AI** — per-play randomised pre-snap scatter (columns 2–8, always a
  deep man in 6–8) and semi-stochastic lane-seeking pursuit that hesitates, so
  the cutback works and the rush is never solvable.
- **PRO 1 / PRO 2 skill switch** — PRO 2 reacts 50% faster. Changing PRO level
  mid-game ends the game; OFF works at any time as the keyboard abort.
- **Keyboard-first controls** with pressable on-screen keys that mirror them:
  commands fire on `pointerdown`, keys blur on `pointerup`, OS auto-repeat is
  ignored, and Tab stays reserved for focus navigation.
- **Authentic ST/SC readouts** as true seven-segment LEDs, including the
  50-yard-line tack mark drawn as segments (`42⊣` / `⊢42`).
- **Web Audio sound** — step, referee whistle, double whistle, kick, and an
  original bugle-style scoring fanfare. Oscillators only, no audio files.
- **Dash / round blip display toggle**, matching the two variants that shipped.
- **Seeded RNG** through one injected instance — `?seed=` replays a game exactly,
  and every test is deterministic.
- **Owner's Manual** (`public/gridiron-manual.pdf`) — a period-authentic
  instruction booklet for the fictional 1977 two-player product, played
  completely straight, rendered from `tools/manual/` via headless Chrome and
  committed so the Netlify build never needs Chrome.
- **Netlify deploy** via `netlify.toml`, Node pinned to 22, no redirects.

### Accessibility

- Tackler blink is capped at ~2 Hz, below the 3-flashes-per-second threshold.
- Under `prefers-reduced-motion` the blink is replaced by a steady-bright
  tackler, so the information survives without anything flashing.
- On-screen keys are real focusable buttons with labels; a polite live region
  narrates the game state, which bare LEDs cannot.

[Unreleased]: https://github.com/cschweda/vogeltronics-gridiron-i/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/cschweda/vogeltronics-gridiron-i/releases/tag/v0.2.0
[0.1.0]: https://github.com/cschweda/vogeltronics-gridiron-i/releases/tag/v0.1.0
