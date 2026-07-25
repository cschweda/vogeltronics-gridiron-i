# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/cschweda/vogeltronics-gridiron-i/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cschweda/vogeltronics-gridiron-i/releases/tag/v0.1.0
