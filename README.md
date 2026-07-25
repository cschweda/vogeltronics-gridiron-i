<p align="center">
  <img src="docs/images/vogeltronics-logo.svg" alt="VogelTronics — Games That Think!" width="640">
</p>

<h1 align="center">GRIDIRON — Electronic Football (1977)</h1>

<p align="center"><strong>A solo, keyboard-first web recreation · Gridiron 1, running only · No. 2100</strong></p>

<p align="center">
  <img src="docs/images/gridiron-boxart.svg" alt="Gridiron box art — VogelTronics, 1977. A red-LED football field over the words GRIDIRON, Electronic Football, and the Games That Think! sticker." width="380">
</p>

**Gridiron** is a browser recreation of VogelTronics' 1977 red-LED handheld football game: one bright blip against five dimmer tacklers on a 3×9 field, four downs to move the chains, a kick on fourth down, and a defense that reacts 50% faster on PRO 2. It is part of the fictional **[VogelTronics](https://vogeltronics.com)** universe ("Games That Think!") — Elk Grove Village's most heartbreaking toy company.

The 1977 original was a two-player game (that's what the box says, and boxes never lie); this recreation adapts it for **solo play** — you run the offense, the computer rushes the defense.

> **Status: v1 built and playable.** The manual-verified spec and the build prompt live in [`docs/gridiron-spec-and-prompt.md`](docs/gridiron-spec-and-prompt.md). A separate future project, **Gridiron II**, will reuse this engine and add THE FORWARD PASS — it says so right on the box.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest, all seeded — no flakes
npm run build    # typecheck + production bundle into dist/
```

Append `?seed=1977` to the URL to replay an identical game — every random draw
in Gridiron (defender scatter, pursuit, kick distance) comes from one seeded
generator.

## Controls (keyboard-first)

The game is **100% playable from the keyboard** — the on-screen keys mirror the keyboard, never replace it. Tab is deliberately unbound, so it stays free for focus navigation.

| Action | Keys |
|---|---|
| Run toward goal | **D** or **→** |
| Lane up / down | **W** / **S** (or **↑** / **↓**) |
| Status readout (ST) | **T** |
| Score readout (SC) | **C** |
| Kick (4th down only) | **K** or **Space** |
| Power / skill | **0** = OFF · **1** = PRO 1 · **2** = PRO 2 |
| Sound on / off (**starts off**) | **M** |
| Blip style (dash / round) | **B** |
| Zoom the display (1× / 2× / 3×) | **Z**, or the **mouse wheel** over the cabinet |

## Stack

Vite + TypeScript (vanilla, no framework) · SVG LED display + CSS cabinet · Web Audio oscillators (no audio files) · seeded RNG · Vitest · Netlify static deploy · a downloadable period [**Owner's Manual**](public/gridiron-manual.pdf) (PDF), played completely straight.

The engine (`src/engine/`) is framework-free and contains no DOM references — it imports cleanly in Node, which is what keeps the rules testable and what will let **Gridiron II** import it wholesale.

## A note on the clock

A quarter is 15 game-minutes and burns at 0.1 per real second, but **the clock only runs while the ball is live**. That is ~2½ real minutes of live ball per quarter, ~10 minutes per game — a session takes considerably longer in wall-clock terms, since the clock stops between plays while you press ST or SC.

## Deploying to Netlify

`netlify.toml` is committed and needs no configuration: build `npm run build`, publish `dist`, Node pinned to 22. There are deliberately **no redirects** — this is a single page with no client-side routing, and a catch-all would only mask genuine asset 404s.

```bash
netlify deploy --prod    # or connect the repo in the Netlify UI
```

## Repo assets

- `docs/images/gridiron-boxart.{png,svg}` — the 1977 box art, extracted from the [vogeltronics-history](https://github.com/cschweda/vogeltronics-history) page
- `docs/images/vogeltronics-logo.svg` — the VogelTronics wordmark
- `docs/images/og-image.png` — the social card (mirrored to `public/`)

### Regenerating the social card

The generator is **shared brand tooling and lives in [vogeltronics-history](https://github.com/cschweda/vogeltronics-history)**, alongside `gen_badge.py` and `gen_gridiron_boxart.py` (which produces this game's box art). One copy, one look across the whole catalog. From a sibling checkout:

```bash
python3 ../vogeltronics-history/tools/make-og-image.py \
  --boxart docs/images/gridiron-boxart.png \
  --logo docs/images/vogeltronics-logo.svg \
  --title GRIDIRON \
  --subtitle "ELECTRONIC FOOTBALL · 1977" \
  --out docs/images/og-image.png
cp docs/images/og-image.png public/og-image.png
```

`--url` defaults to `vogeltronics.com` — the brand root, since each game sits on its own subdomain.

## The VogelTronics universe

- **[The whole story](https://history.vogeltronics.com)** — the corporate history, 1961–1983 ([repo](https://github.com/cschweda/vogeltronics-history))
- **[vogel-vox](https://github.com/cschweda/vogeltronics-vogel-vox)** — the voice synthesis behind Rovacon
- **[vogeltronics.com](https://vogeltronics.com)** — where the playable catalog lives
- **[MetaIncognita](https://metaincognita.com)** — the wider workshop

## Disclaimer

Gridiron is an original, independent work created as an **affectionate homage** to the 1977 Mattel Electronics Football handheld. It is **not affiliated with, endorsed by, sponsored by, or connected to Mattel, Inc.** in any way. No trademarks, logos, brand names, product names, artwork, code, ROMs, or other material from Mattel or the original product are used or reproduced. "VogelTronics," "Gridiron," and all associated names, logos, casing, and copy are wholly fictional and original. The original instruction manual was consulted **only to understand and recreate gameplay rules and feel**; game rules and mechanics themselves are not protected by copyright. "Mattel" and "Mattel Electronics Football" are referenced solely for descriptive and historical purposes and remain the property of their respective owner.

## License

MIT © 2026 Chris Schweda
