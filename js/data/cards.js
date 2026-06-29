// Card schema: { id, level, category, subcategory?, type, icon, tags,
//   minPlayers, playersNeeded, mode?, timer?, drink, text }
// Levels 1-4 = Icebreaker/Spicy/Freaky/OMG; level 5 = Wildcard (chaos).
// minPlayers (default 2): 3 hides group/vote cards in a 2-player game.
// timer (seconds) runs the on-card countdown ring; drink = footer penalty.
// The deck is split per level into cards_l1..cards_wild for maintainability.

import { l1 } from './cards_l1.js';
import { l2 } from './cards_l2.js';
import { l3 } from './cards_l3.js';
import { l4 } from './cards_l4.js';
import { wild } from './cards_wild.js';

export const cards = [...l1, ...l2, ...l3, ...l4, ...wild];
