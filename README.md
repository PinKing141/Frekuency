# Freakquency 🃏

A neon **Freak or Drink** party card game for adults (18+). Play **solo / pass-the-phone** on one device, or spin up a **multiplayer room** where every phone stays in sync. Static front-end, no build step — it runs straight from GitHub Pages, with Firebase powering the optional online rooms.

> Adults only. Every card is optional: do it, answer it, or take the drink. You can pass on anything, any time.

## Features

- **Two modes** — solo / pass-the-phone (fully offline) and real-time multiplayer rooms.
- **616-card deck** across five levels: L1 Icebreaker · L2 Spicy · L3 Freaky · L4 OMG · 🃏 Wildcard (chaos & mechanics).
- **After Dark intensity slider** (Plain → Unhinged) that re-weights how often the freaky stuff shows up.
- **Per-card drink penalties** shown on the card, and **timed dares** with an on-card countdown ring.
- **2-player smart weighting** — duos get more intimate 1-on-1 cards; `{target}` resolves to the other player's actual name.
- **Custom cards & categories**, opt-out **Game Settings** (levels, contact/target/never/would, per-player flirt & contact).
- **End-of-game "Most Wanted" awards**, collapsible scoreboard drawer, dead pile + reshuffle, turn timer.
- **PWA** — installable, works offline for solo (network-first service worker).
- One-time **18+ gate**, mute toggle, and a hidden card-inspector for debugging.

## Project structure

```
index.html            App shell + all screens/modals
manifest.json         PWA manifest
sw.js                 Service worker (network-first; bump CACHE on release)
firestore.rules       Firestore security rules for multiplayer rooms
firebase.json         Firebase CLI config (points at firestore.rules)
css/                  Split styles, imported by css/main.css
  main.css variables.css layout.css buttons.css forms.css cards.css modals.css animations.css
js/
  main.js             Entry point: wires the UI, owns app state
  core/               gameState, playerManager, turnManager, cardDrawer,
                      customCards, categories, settings, storage, sound
  data/               cards.js (index) + cards_l1…cards_l4, cards_wild
  ui/                 screens, renderCard, renderPlayers, timer, debug
  firebase/           firebaseConfig.js, roomService.js (lazy-loaded)
  utils/              helpers
assets/               icons + card art
```

Everything is native ES modules — no bundler. `index.html` loads `js/main.js` as `type="module"`; Firebase is imported lazily the first time you use multiplayer, so solo play never touches the network.

## Run locally

Because it uses ES modules, open it through a local server (not `file://`):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Solo / pass-the-phone works with no further setup. Multiplayer needs Firebase configured (below).

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment** → **Deploy from a branch**.
3. Choose your branch and the `/ (root)` folder, then save. GitHub gives you a live link.

No build step is required — the files are served as-is.

## Where the cards live

The deck is split per level under `js/data/` and re-exported from `js/data/cards.js`:

```js
// js/data/cards.js
import { l1 } from './cards_l1.js';
// …l2, l3, l4, wild
export const cards = [...l1, ...l2, ...l3, ...l4, ...wild];
```

### Card shape

```js
{
  id: "fk_l4_03",
  level: 4,                   // 1–4 = Icebreaker/Spicy/Freaky/OMG; 5 = Wildcard
  category: "OMG",
  subcategory: "Heaven Dare", // optional
  type: "Dare",
  icon: "🔥",
  tags: ["omg", "contact", "target"],
  minPlayers: 2,              // 3 hides group/vote cards in a 2-player game
  playersNeeded: "2+",        // source label
  mode: "Works with 2+ players",
  timer: 420,                 // optional — seconds for the on-card countdown ring
  drink: "Drink: 2 shots",    // shown on the card footer
  text: "7 minutes in heaven: pick a player and step away together, or drink."
}
```

Engine-relevant tags: `target` (gated by the "target another player" setting), `contact` (gated by the contact setting **and** the per-player opt-in), `group`/`vote` (3+ players). `{player}` is the current player; `{target}` becomes the other player's name in a duo, otherwise a "player of your choice" phrase.

To add cards, append entries to the matching `cards_<level>.js` file (keep `id`s unique).

## Adding cards in-app

Players can write their own prompts under **Custom Cards** and group them into **categories** that can be toggled in **Game Settings** — no code needed. Custom cards are stored in the browser (and shared room-wide in multiplayer).

## Game settings

All opt-out (everything is on by default): card levels, physical-contact cards, target cards, Never Have I Ever, Would You Rather, per-category toggles, turn timer, and the **After Dark intensity** slider. Choices persist in `localStorage`.

## Multiplayer (Firebase)

Multiplayer uses Firestore + Anonymous Auth, loaded lazily from the CDN.

1. Create a Firebase project and a **Cloud Firestore** database.
2. Enable **Anonymous** sign-in (Authentication → Sign-in method).
3. Put your web config into `js/firebase/firebaseConfig.js`.
4. Deploy the security rules in `firestore.rules`:
   ```bash
   firebase deploy --only firestore:rules
   ```
5. Add a **TTL policy** on the `rooms` collection's `expireAt` field so abandoned rooms are reaped automatically (rooms also self-expire after a few hours and are opportunistically cleaned on room creation).

Rooms are keyed by a short code; the host shares it and everyone joins. See `firestore.rules` for the trust model and its limitations (player identity is a `playerId` field, not the shared anonymous uid).

## One rule

If you don't want to do a card, take the drink/pass and move on — no big deal. Drink responsibly (works just as well with a soft drink).
