# PartyVerse design system

## What was wrong

The old interface was assembled from the defaults every AI site builder reaches for, and it read that way.

- **Colour had no hierarchy.** A purple-to-pink gradient sat behind the page, on the primary button, on the logo, on the timer and on the score. Every game card added its own two-tone neon glow on top. With ten accents competing, nothing was important.
- **Surfaces were glassmorphism by reflex.** Translucent cards, backdrop blur, glow blobs and drop shadows on resting content. None of it carried information.
- **Emoji were the icon system.** Navigation, buttons, filters, chips, variants, hearts, streaks and the logo were all emoji. They render differently on every platform and turn chrome into noise.
- **Typography was loud and undifferentiated.** Lexend Black for every heading, a giant gradient hero, uppercase tracked labels everywhere, and no numeric treatment for a product that is mostly scores and timers.
- **The library was a wall of 30 identical cards**, each with the same badges ("Party" on 28 of 30), the same blob and the same layout. Browsing meant reading every card.
- **Game screens fought the game.** A rainbow timer bar, pill chips, emoji ticks and crosses, a 7xl gradient score, and a pop-and-bounce on everything.
- **Mobile was the desktop, shrunk.** No thumb-reachable navigation, a nav bar that scrolled sideways, and controls sized for a mouse.

## The direction

**Quiet surfaces, loud play.** The chrome steps back so the question, the options and the score are the brightest things on screen.

- **Neutrals:** a warm graphite ramp (`canvas`, `surface-1…4`, `line`, `fg…fg-4`). Warm so it feels like a lit room, not a terminal.
- **One accent:** signal yellow (`accent`). It marks the single primary action on a screen, focus, the current selection, "you" in lists and first place. Nothing else is yellow.
- **Semantics:** `good` (green), `bad` (red), `warn` (amber), used only for outcomes and urgency.
- **Game families:** seven quiet tones (trivia, visual, words, sports, party, cards, medicine) at matched lightness. Each game gets a hand-drawn line glyph on a tile tinted with its family tone, so the library has identity without colour noise.

### Type
- **Instrument Sans** for interface and play. Tight tracking at display sizes, tabular figures (`num`) for every score, timer, count and rank.
- **Instrument Serif** for editorial moments only: page titles, game names on their own page, the answer reveal, winners. Never for anything you have to read quickly mid-round.
- **JetBrains Mono** for codes, ranks and the one uppercase style (`overline`).

### Shape and space
- Radii: 6, 8, 12, 16, 22. Buttons are 8, tiles 12, cards 16. No pills except avatars and switches.
- A 4px grid. Pages use 20px gutters on phones and 32px on desktop, max widths of 1152 / 1024 / 896 depending on reading density.
- Resting surfaces have a hairline edge and no shadow. Only floating layers (menus, popovers, dialogs) cast one.

### Motion
- Two curves: `ease-out` (0.2, 0.8, 0.2, 1) for things arriving, `ease-in-out` for things moving between states.
- Three durations: 120ms (press, hover), 200ms (state), 320ms (arrival). Content rises 6–10px and fades; nothing bounces or springs.
- Scores roll to their new value (`CountUp`). Leaderboard rows slide into new positions. Wrong answers get one short shake.
- `prefers-reduced-motion` turns all of it off.

## Components

Utilities live in `src/app/globals.css`; components in `src/components/ui`.

| Need | Use |
| --- | --- |
| Primary / secondary / tertiary action | `btn-primary`, `btn-ghost`, `btn-quiet` (+ `btn-sm`, `btn-lg`, `btn-icon`, `btn-danger`) |
| Text field | `input` |
| Selectable tile (modes, variants, games, settings) | `option` with `aria-pressed` or `aria-checked` |
| Resting container / inset well / floating layer | `card`, `well`, `popover` |
| Small label / section marker | `label`, `overline` |
| Numbers | `num` (tabular figures), `CountUp` for live values |
| Range slider | `range` |
| Icons | `<Icon name>` — 24px grid, 1.75 stroke |
| Game mark | `<GameGlyph slug group>` |
| Segmented control | `<Segmented>` |
| Modal | `<Dialog>` (focus trap, Escape, returns focus, sheet on phones) |
| Strip emoji from engine labels | `plainLabel()` |

## Rules for new screens (Poker, medicine games, Risk & Reward)

1. Start from `card` / `well`; never invent a new surface colour.
2. One `btn-primary` per view. Everything else is `btn-ghost` or `btn-quiet`.
3. Put chip balances, pots, wagers and payouts in `num`, and animate them with `CountUp`. Gains are `good-400`, losses `bad-400`, the stake itself is `fg`.
4. Give the game a family in `gameFamily()` (poker → cards, medical → medicine) and a glyph in `GameGlyph`.
5. Emoji may appear as content (a clue, a reaction, an achievement badge), never as a button icon.
6. Check 390px and 1440px before calling it done.
