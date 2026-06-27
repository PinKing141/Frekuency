# Card art

These are the **card frame** images. Each is only the visual skin — the level
label, type, main text and footer are real HTML elements rendered on top by
`js/ui/renderCard.js`, so wording is never baked into the image and stays easy
to edit.

| File | Used for |
|------|----------|
| `front-l1.svg` | L1 Icebreaker card frame |
| `front-l2.svg` | L2 Spicy card frame |
| `front-l3.svg` | L3 Freaky card frame |
| `front-l4.svg` | L4 OMG card frame |

The shipped frames are lightweight SVG placeholders so the game looks complete
out of the box.

## Using your own (e.g. AI-generated) images

1. Add your files here, for example `front-l1.png`, `front-l2.png`, …
   Aim for a **5:7** portrait ratio. Keep the **centre area darker/clear** so the
   white glowing text stays readable.
2. Point the four background rules in `css/cards.css` at them — change the
   extension on each `background-image`:

   ```css
   .level-1 { background-image: url("../assets/cards/front-l1.png"); }
   .level-2 { background-image: url("../assets/cards/front-l2.png"); }
   .level-3 { background-image: url("../assets/cards/front-l3.png"); }
   .level-4 { background-image: url("../assets/cards/front-l4.png"); }
   ```

That's the whole swap — no HTML or JS changes needed.

## Card backs (optional, future)

`back-main.png` / `back-lN.png` would be used for a card-flip animation. There's
no flip mechanic yet, so they aren't wired up — drop them here when we add one.
