# Bug fixes, new games and scoring overhaul — report

Branch: `overhaul/fixes-poker-medicine` · Date: 2026-10-10 · Theme: the original PartyVerse theme (unchanged).

## Bugs identified (root causes)

| # | Problem | Root cause |
|---|---|---|
| 1 | Profile pictures didn't work | There was no upload at all: an "avatar" was only an emoji chosen from a fixed list. |
| 2 | Risk & Reward had no real balance | Each round paid a fixed `2 × bet` or `−bet` into the normal score, with a 10–(50 + 30×difficulty) bet cap. There was no balance, no elimination and no odds. A win paid double the stake as profit, not stake back plus even-money profit. |
| 3 | "Marcus Rojo" rejected | Marcos Rojo wasn't in the dataset. The football category only knew ~650 hand-typed names, so any less famous real player was rejected, typo or not. |
| 4 | Rare Words rarity inconsistent | Any answer outside the curated tiers fell back to a flat `1/N` prior. Smoothing was tuned for small lists. Reveals used a different first-letter rule (`toUpperCase().startsWith`) from the one used for validation, so accented names disagreed. |
| 5 | Closest-answer scoring | Numeric rounds added a speed bonus and a streak multiplier on top of closeness, so a faster or on-streak player could out-score a closer guess. Multiplayer never compared guesses, so nobody "won" the round, and players never saw each other's distances. |
| 6 | Free-text matching across games | Typo tolerance accepted any single near match. For medical terms a one-letter typo can be a different disease (hepatitis A/B, hypo-/hyperthyroidism). |

## Fixes

- **Profile pictures:** upload JPG/PNG/WebP up to 5 MB, drag to reposition, zoom, live circular preview, then save.
  - The server checks the format from the file's bytes, caps the pixel count, rejects animations, applies EXIF rotation, crops and re-encodes to a 256×256 WebP with no metadata.
  - Pictures are stored in Postgres (`AvatarImage`) and served at `/api/avatar/<id>?v=<version>` with immutable caching. Every upload bumps the version, which busts all caches.
  - The upload endpoint only ever acts on the signed-in caller, so there's no way to name another player.
  - Pictures show in the nav, profiles, lobbies, scoreboards, chat, round answers, results, leaderboards, friends lists and poker seats, and update live in open rooms. If an image fails to load, the emoji shows instead.
- **Risk & Reward:** virtual chips only.
  - 1,000 starting chips, configurable by the host (500–10,000 in the lobby, 100–1,000,000 allowed).
  - Whole-chip stakes from 1 up to the live balance. A stake locks once placed and settles exactly once.
  - Odds rise with difficulty: Evens up to ★★, then 3/2, 2/1 and 5/2. A win pays the stake back plus profit; a loss costs the stake.
  - Zero chips means elimination and spectating. The last player with chips wins. Simultaneous busts are ranked by the balance held before that round.
  - All balances live on the server and sync to every client. The UI shows balance, the "if right" and "if wrong" amounts, odds, All-in, and a review-then-confirm step.
- **Answer recognition** (football and every category):
  - New `NameIndex`. It matches exact names and aliases, reordered names ("Rojo, Marcos"), and a surname alone when one player clearly owns it.
  - It handles plurals for things, and corrects typos only when a single answer is clearly meant (Marcus Rojo → Marcos Rojo).
  - Otherwise it asks "Did you mean…?". Different people are never merged; the curated list and Wikidata are merged by exact name only.
  - 149,133 football players from Wikidata (CC0) are bundled. Retired and historic players are included.
  - The letter rule is the first letter of the name as usually written, shown in the round and explained when an answer misses it.
  - Rejections explain why, and players can report a rejection for admin review. Reviewed answers go in `src/content/datasets/answer-additions.ts`.
- **Rarity:**
  - The prior blends the curated tiers with fame (Wikipedia sitelinks^2.5).
  - Long lists get a wider points scale and stronger smoothing, so one early vote can't swing a score. The same answer always scores the same under the same data.
  - Before any answer data: Messi 11 points, Cristiano Ronaldo 15, Mohamed Salah 22, Rashford 35, Harry Maguire 56, Marcos Rojo 60, players with 6 or fewer Wikipedia articles 100. These move as real answers come in.
- **Closest wins:**
  - `distance = |guess − answer|`, compared at 6 decimal places. Equal distances tie.
  - Numeric rounds use closeness only (no speed or streak), and the closest player(s) get +50 and the round win, computed once on the server.
  - The reveal shows each player's guess and distance and highlights the closest. Typed guesses accept commas, decimals and negatives, and invalid input is rejected with a clear range message.

## New games

- **Texas Hold'em Poker** (`/poker`), 2–8 players.
  - Rules: dealer button, blinds and rotation (with the heads-up blind rule), pre-flop, flop, turn, river and showdown. Check, call, bet, raise, fold and all-in, with no-limit minimum raises, and short all-ins don't reopen the betting.
  - Pots: side pots, split pots, and odd chips to the left of the button.
  - Hands: all ten ranks, with kicker tie-breaks.
  - The game: turn timers with automatic check/fold, blinds that double every N hands, a crypto-shuffled server deck, and per-player views. Opponents' hole cards are never in any payload before showdown, and spectators see none.
  - Modes: private tables with invite codes, and solo against Monte-Carlo computer opponents. Results go to profiles and leaderboards. Virtual chips only.
- **Diagnose the Patient:** beginner and intermediate (multiple choice) and advanced (free text, with synonyms and safe typo handling). Timed rounds, an optional hint (−30%), and an explanation with a named reference after each case.
- **Medical Mystery:** start from the complaint and unlock symptoms, history, vitals, examination, labs, imaging or other tests (each costs 10–20 points). A wrong diagnosis costs 20 points, and three wrong guesses close the case. Two clues or fewer in under half the time earns a +25 bonus. Modes by specialty group.
- **Case library:** 85 fictional teaching cases across 15 specialties. Each case has a validated diagnosis, synonyms, distractors, a hint, an explanation and a reference (NICE CKS, MSD Manual, Oxford Handbook and others). Every screen states the cases are fictional and not medical advice.

## Tests executed

| Suite | Result |
|---|---|
| Unit (`npm test`, Vitest) | **545 passed, 0 failed** across 7 files |
| End-to-end (`npm run test:e2e`, Playwright + Chrome, production build, local Postgres) | **14 passed** on the final run |
| Production build (`next build`) | Passed |
| TypeScript (`tsc --noEmit`) | Clean |

What the new tests cover:

- **Profile pictures:** upload, crop, save, refresh, visible in the room lobby to another player, versioned cache URL, re-encoded 256×256 WebP, fake-PNG and wrong-type refusal, another player can't change yours.
- **Risk & Reward:** stake over balance blocked, payout and loss shown, confirm step, settlement, plus unit tests for payouts, losses, all-in, zero-balance elimination, insufficient funds and simultaneous-bust ranking.
- **Poker:** every hand rank, tie-breaks (kickers, wheel, flush, full house, board ties), side pots (one, three levels, uncalled return), split pots and odd chips, button and blind rotation, heads-up order, big-blind option, minimum raise, short all-in not reopening, all-in blind run-out, bust ranking, hidden cards in views, bots always acting legally, and the end-to-end websocket payload check.
- **Rare Words and football:** Marcos Rojo in all forms, the Marcus Rojo correction, Salah, Neuer, Rashford, Maguire, accents (Mbappé, Modrić, Pelé, Puskás), retired players, surname ambiguity (asks instead of guessing), invented names rejected with a reason, letter-rule explanation, rarity ordering and consistency, smoothing, no farming.
- **Closest wins:** exact matches, equal-distance ties, guesses above and below, negative and decimal values, float noise, multiplayer reveal with distances.
- **Medicine:** every case checked for giveaways and for each distractor and synonym; hint penalty, scoring formula, wrong-guess handling, difficulty modes, and the one-letter disease confusions.

## Running it locally

```bash
npm install
npm run db:local                          # private Postgres on 127.0.0.1:54400 (keep it running)
# .env: DATABASE_URL="postgresql://postgres:partyverse@127.0.0.1:54400/partyverse"
npx prisma db push && npx tsx --env-file=.env prisma/seed.ts
PORT=3000 npx tsx --env-file=.env server.ts   # http://localhost:3000
```

## Remaining limitations

- **Football dataset:** players are included if Wikidata lists them as footballers with articles on 4+ Wikimedia sites. That bar keeps the list to notable players, but very obscure lower-league players may still be missing; the report button and `answer-additions.ts` cover those. A few people whose main fame is elsewhere also count, because Wikidata lists them as footballers (Albert Camus played as a youth goalkeeper).
- **Other categories:** cities, films and animals still use the curated lists, now with better matching (plurals, aliases, safe typos). They were not expanded from Wikidata in this pass.
- **Medical content:** written from standard teaching references, not reviewed by a practising clinician. Each case cites its reference so it can be checked.
- **Scaling:** poker tables, rooms and timers live in one Node process, as before.
- **Flaky test:** the Diagnose e2e test failed once in a full run (an element wasn't found in time). It then passed 10 times in a row on repeat.
