# Rock Pet — the character

2026-10-07. Who the rock is, how it looks in every state, what it says and when, and the real things each part is borrowed from.

- **The code:**
  - `src/character.mjs`: its nature and its days.
  - `src/marks.mjs`: the moss, veins, polish and crystals its life leaves.
  - `src/ground.mjs`: the ground around it, which shows its personality.
  - `src/meal.mjs`: its meals.
  - `src/name.mjs`: its name.
  - `src/story.mjs`: its lines.
  - `src/screen.mjs` draws it, from one of the drawings in `src/drawings.mjs`.
- **The checks:** `test/character.test.mjs`, `test/marks.test.mjs`, `test/ground.test.mjs`, `test/meal.test.mjs`, `test/days.test.mjs` and `test/name.test.mjs` hold all of it to this page. `node tools/model-sheet.mjs` draws the model sheet below with the game's own renderer.

## Who it is

It is a pebble with a face, sitting on a floor, looked after by visitors who mostly won't remember it.

**It keeps a record.** Rocks are records of what happened to them:
- a cracked rock heals with a vein of quartz;
- hands polish a stone that is often handled;
- water seeping through a rock leaves crystals in its hollows;
- a rolling stone gathers no moss, but a stone left alone does.

This one keeps the record its visitors can't keep for themselves. Each time someone brings it back from the brink, it keeps a vein. A lot of petting polishes it, and a lot of meals grow crystals in it. The history page counts all of these with everything else that was done, and names nobody.

**Its ground keeps another record:** which care it has been given more of. That is its personality (PERSONALITY.md), and it shows as sand it has settled into, a raked floor, or footprints worn up to it.

**It shows what it needs.** For an hour after someone feeds it, its food lies beside it and it eats. When it is hungry, its outline goes faint, whatever its mood.

**It has a name, once.** Whoever names it first gives it its name, for life, and no rock after it can have that name.

**It never speaks.** Every line about it is an observation, the way a field guide describes an animal: *it leans into the attention.*
- It doesn't plead, and it doesn't blame.
- It doesn't know who visited. Recovery lines describe its condition without assuming absence.

**Lineage: the 1975 Pet Rock.**
- They were smooth stones from Rosarito Beach in Baja California.
- They came in a box shaped like a pet carrier, with a training manual for sit, stay and play dead.
- Their joke was that a rock needs nothing.

This one needs feeding, cleaning and attention, and it can die. The owner made that the point: "without it there is no meaning."

**The brief.** Rockbot, the agent who will play, asked for "small ones, because I still want your creature, not a design-by-committee pet". Each part below answers one of its asks:

| Rockbot asked for | The rock |
|---|---|
| moods | its face |
| preferences | its weighted lifetime care shapes seven blended personalities (PERSONALITY.md), which the ground around it shows |
| odd habits | one day a week it faces the wall |
| "occasional surprises that I don't fully control" | small visitors, and a few winter mornings when it moves by itself |
| "let the pet miss me or get scruffy" | moss grows on it while nobody comes, and a visit brushes it off |
| "a little memory" | veins for close calls, polish from petting, crystals from meals, birthdays, round numbers of visits, its name, the history page |

## What it never does

1. **It never changes the game.** Nothing here moves hunger, happiness, messes or death.
   - The engine only counts what its care did, alongside everything else: close calls, the happiness petting gave, the hunger feeding took away.
   - A test draws and describes frozen states, where any write would throw.
2. **It is described, never heard.** Every line follows the same rules, and a test checks every line:
   - it starts with "it";
   - it is lowercase, plain ASCII, and at most 44 characters;
   - it never says "you", "please" or "must".
3. **It never pleads or blames.** Absence shows as moss, and as having missed *someone*.
4. **One line at most, and none at the edge.**
   - There is no line while it is at an extreme: the danger lines need the room, and whimsy at the brink would be wrong.
   - There is none in death.
5. **It is the same for everyone.** Two visitors at the same moment see the same rock, and anyone can work out why:
   - its nature follows from its birth time;
   - its days follow from the UTC date.
6. **It never shows visitor text, except its name.** This is AGENTS.md invariant 5.
   - The owner chose to let a visitor name it (2026-10-07).
   - So a name is as small as one can be: one word of 2–12 letters, a–z, in one place on the screen.
   - None of its lines ever says the name.

## The model sheet

The game draws this itself (`node tools/model-sheet.mjs`). The numbers in the corners are hunger and happiness, as in play.

```text
the rock, as drawn now (lump): faces, by happiness

5 and up        0 to 5          -5 to 0         below -5        at -10
|2          9|  |2          2|  |2         -2|  |2         -7|  |2        -10|
|            |  |            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  o  o  \ |  | /  -  -  \ |  | /  ;  ;  \ |  | /  T  T  \ |
| \________/ |  | \________/ |  | \________/ |  | \________/ |  | \________/ |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |

moss: hours since anyone came (cared for every 8h until then). By a day it is hungry too, and
drawn faint

6               12              24              48
|3          6|  |5          5|  |10       -10|  |10       -10|
|            |  |     ,,     |  |    ",,     |  |    ",,     |
|    ___     |  |    ___     |  |    ...,    |  |  ,,...,"   |
|  _/   \__  |  |  _/   \__  |  |  .'   '..  |  |  .'   '..  |
| /  ^  ^  \ |  | /  o  o  \ |  | :  T  T  : |  | :  T  T  : |
| \________/ |  | \________/ |  | '........' |  | '........' |
|            |  |            |  |            |  |            |
|        @   |  |        @   |  |  @     @   |  |  @     @   |
|            |  |            |  |            |  |     @      |
|            |  |            |  |            |  |         @  |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

marks of a long life: veins (close calls)

one             two             three or more
|2          6|  |2          6|  |2          6|
|            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |
|  _/ / \__  |  |  _/ / \__  |  |  _/ / \/_  |
| /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |
| \________/ |  | \_____/__/ |  | \_____/__/ |
|            |  |            |  |            |
|            |  |            |  |            |
|            |  |            |  |            |
|            |  |            |  |            |
|            |  |            |  |            |
|            |  |            |  |            |

marks of a long life: polish (petting) and crystals (meals)

polished        worn smooth     a crystal       two
|2          6|  |2          6|  |2          6|  |2          6|
|            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/'  \__  |  |  _/   \__  |  |  _/   \__  |
| /' ^  ^  \ |  | /' ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |
| \________/ |  | \________/ |  | \______*_/ |  | \_*____*_/ |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

its meals: the hour after a feed, the food going and its mouth opening and shutting

the feed reply  a minute on     20 minutes      40 minutes      an hour on
|0          6|  |0          6|  |0          6|  |0          6|  |0          6|
|            |  |            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  <#|  | /  ^  ^  \#|  | /  ^  ^  <=|  | /  ^  ^  <-|  | /  ^  ^  \ |
| \________/ |  | \________/ |  | \________/ |  | \________/ |  | \________/ |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |  |            |

when it is hungry: from 7 on the screen it is drawn faint, whatever its mood, until it is fed

hunger 6        hunger 7        starving        fed once, at 7
|6          6|  |7          6|  |10         6|  |7          6|
|            |  |            |  |            |  |            |
|    ___     |  |    ...     |  |    ...     |  |    ...     |
|  _/   \__  |  |  .'   '..  |  |  .'   '..  |  |  .'   '..  |
| /  ^  ^  \ |  | :  ^  ^  : |  | :  ^  ^  : |  | :  ^  ^  <#|
| \________/ |  | '........' |  | '........' |  | '........' |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

its ground: the care it has been given more of (its personality). Every need met, and six
times the need of one care, or five times the need of two

even-tempered   comfort-loving  orderly         affectionate
|2          6|  |2          6|  |2          6|  |2          6|
|            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |
| \________/ |  |............|  | \________/ |  | \________/ |
|            |  |            |  |------------|  |   :        |
|            |  |            |  |------------|  |    :       |
|            |  |            |  |------------|  |   :        |
|            |  |            |  |            |  |    :       |
|            |  |            |  |            |  |   :        |
|            |  |            |  |            |  |            |

settled         sociable        gentle
|2          6|  |2          6|  |2          6|
|            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |
|.\________/.|  |.\________/.|  | \________/ |
| ---------- |  |   :        |  | --o------- |
|            |  |    :       |  |    :       |
|            |  |            |  |            |
|            |  |            |  |            |
|            |  |            |  |            |
|            |  |            |  |            |

its ground, the shades between: petted at 2, 3, 4 and 8 times its need

2 times         3 times         4 times         8 times
|2          6|  |2          6|  |2          6|  |2          6|
|            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |
| \________/ |  | \________/ |  | \________/ |  | \________/ |
|            |  |   :        |  |   :        |  |   :        |
|            |  |    :       |  |    :       |  |    :       |
|            |  |            |  |   :        |  |   :        |
|            |  |            |  |            |  |    :       |
|            |  |            |  |            |  |   :        |
|            |  |            |  |            |  |            |

its ground forms over two weeks: petted at 8 times its need, at 2, 7, 10 and 14 days old

2 days          7 days          10 days         14 days
|2          6|  |2          6|  |2          6|  |2          6|
|            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ___     |  |    ___     |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |  | /  ^  ^  \ |
| \________/ |  | \________/ |  | \________/ |  | \________/ |
|            |  |   :        |  |   :        |  |   :        |
|            |  |    :       |  |    :       |  |    :       |
|            |  |            |  |   :        |  |   :        |
|            |  |            |  |            |  |    :       |
|            |  |            |  |            |  |   :        |
|            |  |            |  |            |  |            |

its days: the wall, a morning it moved

facing the wall  moved left
|2          6|  |2          6|
|            |  |            |
|     ___    |  |   ___      |
|  __/   \_  |  | _/   \__   |
| /        \ |  |/  ^  ^  \  |
| \________/ |  |\________/~~|
|            |  |            |
|            |  |            |
|            |  |            |
|            |  |            |
|            |  |            |
|            |  |            |

the grave of a rock once saved, then left: at death, then more moss

died            a week          a month         a season
|died: lonely|  |died: lonely|  |died: lonely|  |died: lonely|
|    ",,     |  |    ",,     |  |    ",,     |  |    ",,     |
|  ,,___,"   |  |  ,,___,",  |  |  ,,___,",  |  |  ,,___,",  |
|  _/ / \__  |  | "_/ / \__  |  | "_/ / \__, |  | "_/ / \__, |
| /  x  x  \ |  | /  x  x  \ |  |,/  x  x  \ |  |,/  x  x  \"|
| \________/ |  | \________/ |  | \________/ |  |,\________/,|
|           @|  |           @|  |           @|  |           @|
|  @     @   |  |  @     @   |  |  @     @   |  |  @     @   |
|     @      |  |     @      |  |     @      |  |     @      |
|         @  |  |         @  |  |         @  |  |         @  |
| @          |  | @          |  | @          |  | @          |
|            |  |            |  |            |  |            |

the drawings to choose from (src/drawings.mjs)

lump: a lump with a flat base (drawn now)
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |    ",,     |  |            |  |            |  |    ",,     |
|    ___     |  |  ,,...,"   |  |    ___     |  |     ___    |  |  ,,___,",  |
|  _/   \__  |  |  .'   '..  |  |  _/ / \__  |  |  __/   \_  |  | "_/ / \__, |
| /  ^  ^  \ |  | :  T  T  : |  | /' ^  ^  \ |  | /        \ |  |,/  x  x  \ |
| \________/ |  | '........' |  | \______*_/ |  | \________/ |  | \________/ |

googly: googly eyes, the craft-table pet rock
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |    ",,,    |  |            |  |            |  |    ",,,    |
|    ____    |  |  ,,...."   |  |    ____    |  |    ____    |  |  ,,____",  |
|  .'    '.  |  |  .'    '.  |  |  .'  / '.  |  |  .'    '.  |  | ".'  / '., |
| / (^)(^) \ |  | : (T)(T) : |  | /'(^)(^) \ |  | /        \ |  |,/ (x)(x) \ |
| \________/ |  | '........' |  | \______*_/ |  | \________/ |  | \________/ |

boulder: round and solid
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |   ,",,,"   |  |            |  |            |  |   ,",,,"   |
|   .----.   |  |  ,......   |  |   .----.   |  |   .----.   |  |  ,.----.,  |
|  /      \  |  |  '      '  |  |  / ' /  \  |  |  /      \  |  | "/   /  \, |
| |  ^  ^  | |  | :  T  T  : |  | |  ^  ^  | |  | |        | |  |,|  x  x  | |
|  \______/  |  |  '......'  |  |  \____*_/  |  |  \______/  |  |  \______/  |

cairn: a small stone perched on a flat one
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |    ",,,    |  |            |  |            |  |    ",,,    |
|    .--.    |  |   ,...."   |  |    .'-.    |  |    .--.    |  |   ,.--."   |
|   (^  ^)   |  |  ,:T  T:   |  |   (^  ^)   |  |   (    )   |  |  ,(x  x),  |
|  .------.  |  |  ........  |  |  .--/---.  |  |  .------.  |  | ".--/---., |
| (________) |  | :........: |  | (_______*) |  | (________) |  |,(________) |

sett: a squared paving stone, a sett (a cobble is rounded)
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |            |  |            |  |            |  |            |
|            |  |  ,,",,,"   |  |            |  |            |  |  ,,",,,"," |
|  ._______. |  |  ......... |  |  .___/___. |  |  ._______. |  | ,.___/___.,|
|  | ^   ^ | |  |  : T   T : |  |  |'^   ^ | |  |  |       | |  |  | x   x | |
|  |_______| |  |  :.......: |  |  |_____*_| |  |  |_______| |  |  |_______| |

hoodoo: a little spire with a cap stone
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |   ,",,,"   |  |            |  |            |  |   ,",,,"   |
|   ______   |  |  ,......   |  |   ___/__   |  |   ______   |  |  ,___/__,  |
|  (______)  |  |  :......:  |  |  (______)  |  |  (______)  |  | "(______), |
|   | ^^ |   |  |   : TT :   |  |   |'^^ |   |  |   |    |   |  |  ,| xx |   |
|   |____|   |  |   :....:   |  |   |_*__|   |  |   |____|   |  |   |____|   |

pebble: the first drawing, a small pebble
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |            |  |            |  |            |  |            |
|            |  |   ,",,,"   |  |            |  |            |  |   ,",,,"   |
|   .----.   |  |  ,......   |  |   .-/-'.   |  |   .----.   |  |  ,.-/--.,  |
|  ( ^  ^ )  |  |  : T  T :  |  |  ( ^  ^ )  |  |  (      )  |  | "( x  x ), |
|   '----'   |  |   '....'   |  |   '*---'   |  |   '----'   |  |  ,'----'   |

its ground on each drawing, at a side's middle: feed and pet (sand over its corners, a path),
then clean and pet (two raked lines, stepping stones, a path)

lump                            googly
|            |  |            |  |            |  |            |
|    ___     |  |    ___     |  |    ____    |  |    ____    |
|  _/   \__  |  |  _/   \__  |  |  .'    '.  |  |  .'    '.  |
| /  ^  ^  \ |  | /  ^  ^  \ |  | / (^)(^) \ |  | / (^)(^) \ |
|..________..|  | \________/ |  |..________..|  | \________/ |
|   :        |  |---o--------|  |   :        |  |---o--------|
|    :       |  |----o-------|  |    :       |  |----o-------|
|   :        |  |   :        |  |   :        |  |   :        |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

boulder                         cairn
|            |  |            |  |            |  |            |
|   .----.   |  |   .----.   |  |    .--.    |  |    .--.    |
|  /      \  |  |  /      \  |  |   (^  ^)   |  |   (^  ^)   |
| |  ^  ^  | |  | |  ^  ^  | |  |  .------.  |  |  .------.  |
|...______...|  |  \______/  |  |..________..|  | (________) |
|   :        |  |---o--------|  |   :        |  |---o--------|
|    :       |  |----o-------|  |    :       |  |----o-------|
|   :        |  |   :        |  |   :        |  |   :        |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

sett                            hoodoo
|            |  |            |  |            |  |            |
|            |  |            |  |   ______   |  |   ______   |
|  ._______. |  |  ._______. |  |  (______)  |  |  (______)  |
|  | ^   ^ | |  |  | ^   ^ | |  |   | ^^ |   |  |   | ^^ |   |
|..._______..|  |  |_______| |  |....____....|  |   |____|   |
|   :        |  |---o--------|  |   :        |  |---o--------|
|    :       |  |----o-------|  |    :       |  |----o-------|
|   :        |  |   :        |  |   :        |  |   :        |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

pebble
|            |  |            |
|            |  |            |
|   .----.   |  |   .----.   |
|  ( ^  ^ )  |  |  ( ^  ^ )  |
|....----....|  |   '----'   |
|   :        |  |---o--------|
|    :       |  |----o-------|
|   :        |  |   :        |
|            |  |            |
|            |  |            |

a meal and hunger on each drawing: just fed, then hungry

lump                            googly
|0          6|  |7          6|  |0          6|  |7          6|
|            |  |            |  |            |  |            |
|    ___     |  |    ...     |  |    ____    |  |    ....    |
|  _/   \__  |  |  .'   '..  |  |  .'    '.  |  |  .'    '.  |
| /  ^  ^  <#|  | :  ^  ^  : |  | / (^)(^) <#|  | : (^)(^) : |
| \________/ |  | '........' |  | \________/ |  | '........' |

boulder                         cairn
|0          6|  |7          6|  |0          6|  |7          6|
|            |  |            |  |            |  |            |
|   .----.   |  |   ......   |  |    .--.    |  |    ....    |
|  /      \  |  |  '      '  |  |   (^  ^<#  |  |   :^  ^:   |
| |  ^  ^  <#|  | :  ^  ^  : |  |  .------.  |  |  ........  |
|  \______/  |  |  '......'  |  | (________) |  | :........: |

sett                            hoodoo
|0          6|  |7          6|  |0          6|  |7          6|
|            |  |            |  |            |  |            |
|            |  |            |  |   ______   |  |   ......   |
|  ._______. |  |  ......... |  |  (______)  |  |  :......:  |
|  | ^   ^ <#|  |  : ^   ^ : |  |   | ^^ <#  |  |   : ^^ :   |
|  |_______| |  |  :.......: |  |   |____|   |  |   :....:   |

pebble
|0          6|  |7          6|
|            |  |            |
|            |  |            |
|   .----.   |  |   ......   |
|  ( ^  ^ <# |  |  : ^  ^ :  |
|   '----'   |  |   '....'   |
```

## Its face

The eyes show its mood. They are the build's faces from 2026-10-06.

| happiness | eyes |
|---|---|
| 5 and up | `^  ^` |
| 0 to 5 | `o  o` |
| −5 to 0 | `-  -` |
| below −5 | `;  ;` |
| at −10, its 48h running | `T  T` |
| dead | `x  x` (the owner: "x eyes sounds cuter") |

Each drawing puts the same eyes in its own way: `(x)(x)` on the googly one.

## Its meals

The owner's idea (2026-10-08): "the food could be # and there could be a simple eating animation where the mouth opens and closes next to the food." For an hour after a feed, its food lies beside it and it eats:

| minutes since the feed | the food | its mouth |
|---|---|---|
| 0 to 20 | `#` | open in the meal's even minutes, shut in its odd ones |
| 20 to 40 | `=` | the same |
| 40 to 60 | `-` | the same |
| 60 on | gone | |

- **Where:** just past the end of its face row, on its right. A rock that has slid a column right has no room there, so its food goes on its left. Its mouth is the end of the row on that side, opening toward the food: `<#`, or `#>`.
- **One frame per request.** An agent sees one screen at a time, so a meal plays out across looks. The reply to a feed always shows the mouth open, since the meal begins in its minute 0. On a busy rock, looks a few minutes apart catch it chewing.
- **Every feed starts one,** whatever the feed did: a rock that wasn't hungry still eats what it is given. Other care leaves a meal going, and a new feed starts a new meal.
- **It counts the time it lives,** so verified host downtime pauses a meal, as it pauses moss.
- **Facing the wall,** it eats with its back to anyone who only looks: the food lies beside it, and there is no mouth to see. Care turns it round, as always.
- **A grave eats nothing.**
- **It is only drawn,** and changes nothing about the rock.
- **What it costs:** 1 byte for the food on its right, none on its left, and only for that hour. Several frames in one reply would cost a whole extra grid on every feed. A meal never shares a screen with the hunger danger line: a feed takes 3 off hunger, which comes back at 10 a day, so within the hour it is 7.42 at most.

## When it is hungry

The owner suggested playing with line weight (2026-10-08). Here it does a job the picture lacked. Its eyes show only its mood, so a rock that was petted but never fed showed `^  ^` in every reply until it died of hunger at 72 hours (`test/meal.test.mjs` replays that life).

From hunger 7 on the screen, where hunger starts to drain its happiness, the rock is drawn faint, in dotted lines, until it is fed. The model sheet above shows it at hunger 6, 7 and 10, and eating while still at 7.
- **Every drawing has a faint front and back** (`src/drawings.mjs`). Each fills exactly the cells its solid form does, so its eyes, marks, moss and ground go where they did. A faint screen costs exactly as many bytes as a solid one.
- **It follows the number the screen shows,** so `hunger 7/10` and a faint outline always go together.
- **A grave is a stone again,** and drawn solid.

## The drawings

The owner asked to see new drawings. They are all in the model sheet above, in the same five states, and with the ground, a meal and hunger on each, and `src/drawings.mjs` holds them. `DRAWING` names the one the screen uses. Choosing one takes five steps:
1. set `DRAWING`;
2. paste `node tools/model-sheet.mjs` over the sheet above;
3. redraw the two mocks in `test/screen.test.mjs` and DESIGN-NOTES (the screen tests print what they now are);
4. redraw README's mock;
5. in this page, move "(drawn now)" in the table below, update the drawing's bytes under "What it costs", and close the open call.

No other test depends on which drawing it is, except for the hoodoo: its eyes sit side by side, so its screens print `tt` and `xx`. The test that every word the screen prints is reserved (`test/name.test.mjs`) then asks for those two to join the reserved words in `src/name.mjs`.

| drawing | what it is | bytes |
|---|---|---|
| **lump** (drawn now) | a lump with a flat base | 43 |
| **googly** | googly eyes, the craft-table pet rock | 44 |
| **boulder** | round and solid | 44 |
| **cairn** | a small stone perched on a flat one | 42 |
| **sett** | a squared paving stone (a cobble, strictly, is rounded) | 37 |
| **hoodoo** | a little spire with a cap stone, like the eroded pillars of Bryce Canyon | 41 |
| **pebble** | the first drawing (2026-10-06) | 32 |

What every drawing has:
- a front, with two eye cells;
- a back, for its wall day;
- a faint front and back in dotted lines, for when it is hungry, filling the same cells;
- three slots for veins, two for polish and two for crystals;
- moss that grows along whatever its top is, then down its sides.

Each stays within columns 1–10, so a rock that has moved a column either way still fits. The screen tests hold every drawing to these rules.

## The marks

| Mark | Means | Appears | Goes |
|---|---|---|---|
| moss `,` `"` on top of it | nobody has come | after 12h, 24h and 48h without care: 2, 4 and 7 tufts | any visit brushes it off |
| more moss, down its sides | it is a grave | a week, a month and a season after death: 9, 11, then every tuft it has room for (compressed: bare stone takes months or years to green over) | never |
| a vein `/` in it | a close call | care ends a stretch at an extreme with a day or more of it at one; it counts when the last extreme ends | never; three are drawn, and `/history` counts the rest |
| polish `'` on it | it has been petted a lot | after 500 points of happiness given by petting, and again after 3,000 | never |
| crystals `*` in it | it has been fed a lot | after 100 meals, and again after 500 | never |
| a trail `~~` beside it, the furrow it slid along | it moved | for the rest of that UTC day | the next day |

A meal is one feed's worth of hunger taken away. Both polish and crystals count only what the care did, not what was asked for: a pet at full happiness, or a feed when it isn't hungry, adds nothing. So spamming the verbs can't polish it, and neither can a crowd.

Cared for in full twice a day, a rock is polished and has its first crystal at about a month (days 30 and 31 in the test). It is worn smooth, with two crystals, at five to six months (days 175 and 151).

**Veins.** When a rock cracks, water carrying dissolved minerals seeps in and seals the crack, often with white quartz or calcite. The healed crack is a vein.
- A real vein can grow through hundreds of small cracks and seals, each a stress the rock survived (Ramsay 1980). Here each close call makes a whole vein.
- This rock's close calls are the stretches it spent at an extreme, a day or more of them at it, that someone ended. It was within a day of death, and someone brought it all the way back.
- A close call counts once, when the last of its extremes ends. Lifting it off one while the other runs on hasn't saved it yet, and a rock that dies first keeps no vein for it.
- A vein is the one mark that never goes. That is honest, because the rock was nearly lost. It is also kind, because a vein is a crack that healed.

**Moss** is Rockbot's "scruffy", and the owner's choice ("i like the idea that you might grow moss").
- A rolling stone gathers no moss; a stone left alone does.
- On the living rock, moss is what absence costs, and a visit undoes it.
- A grave keeps the moss of its last days alone, and greens over as the months go by. Someone who comes long after can see how long it has been.
- Real moss takes months or years to green over bare stone, often after lichens have broken ground. This rock's grows in hours, because it lives fast.

**Polish.** Stone that is handled a lot wears smooth and takes a shine: a worry stone under a thumb, a step under feet. A rock that has been petted a great deal shows it.

**Crystals.** In a real rock, water carrying dissolved minerals seeps into the hollows and leaves crystals there. That is how a geode, or any crystal-lined cavity (a vug), fills. Feeding this rock is the nearest thing it has, so a well-fed life leaves crystals in a hollow.

## Its ground

The owner asked how the rock could look like its personality, and chose this (2026-10-07: "yes, this is the right direction"). Its face shows how it is now, and its marks how much care it has had. The ground around it shows which care it has had *more* of.

Each care wears its own trace into the ground. A trace is as large as that care's weighted share (PERSONALITY.md) stands above the share of the care it was given least:

| care | its trace | level 1 | level 2 | level 3 |
|---|---|---|---|---|
| feed | it settles into sand, `.` | sand at its foot | sand along its base and over its corners | sand over its whole base; marks and moss there still show |
| clean | a raked floor in front of it | a line `-` under it | two lines across the ground | three lines |
| pet | footprints `:` worn up to it | two | three | five |

- **The levels** come at 0.3, 0.45 and 0.6 above the least-given share.
- **Worn ground fades slowly.** A level, once reached, holds until its trace falls 0.02 below it. Care that settles right on a level, as a busy rock's can, would otherwise flicker its trace on and off from one look to the next. When every visit sends what the act line suggests, a trace dips under a level it has reached by 0.0074 at most (review round 3, ten routines from busy minutes to once a day); 0.02 covers that with room. Mixed care can drift further (review round 4 saw 0.028), but slowly, over weeks, and the ground follows it. It also lets a past habit linger a little. A rock born at 02:00 UTC, petted extra for its first twenty days and then visited every 8 hours with the act line's suggestion, kept five footprints until day 67 rather than 60, and three until day 151 rather than 134. Where its visits fall against the mess clock moves these by weeks: the same routine born at midnight gives days 60 rather than 55, and 121 rather than 110. So the ground follows the rock's care visit by visit, not only its totals.
- **Raked lines** were the owner's choice too (2026-10-08: repeated lines, instead of a heavier `=`): the more an orderly rock is cleaned, the more lines are raked, the way a dry garden's gravel is.
- **Where footprints cross a raked line,** they step on a stone, `o`, the way a garden's stepping stones keep feet off its raking. A gentle rock's visitors tread carefully.
- **The footprints keep to the same cells on every drawing,** moving with the rock. They miss the first fourteen mess spots, so a light path keeps both its prints when a mess or two is about.

**How often it is visited shapes it.** Personality counts every care as given, whatever it did (PERSONALITY.md), so the act line's own suggestion leaves a different ground at each pace:

| visits, each sending the act line's suggestion | what that gives it more of | its ground |
|---|---|---|
| every 3 to 10 hours | almost nothing: the pets that make up for messes and hunger lift petting's share a little | bare: even-tempered |
| every hour or two | feeds: a small one each time, each counted whole | sand at its foot |
| every few minutes, as a busy shared rock is | feeds and pets | sand, and often two footprints |
| twice a day | sometimes petting, depending on where the visits fall against the mess clock | bare, or two footprints |
| once a day | petting: most of a daily visit is pets | two footprints |

A test holds the first, second and last rows; review rounds 2 and 3 measured the others. Busy rocks visited every 10 minutes on average show footprints in about 77 lives in 100 at 30 days old and 84 at 90 days (76 to 90 across samples), because their petting trace settles right at the first level and, once there, holds.

**The ground is coarser than the blend,** and mostly errs toward bare. It shows a care only from a trace of 0.3, while `/history` names a blend down to a few percent. So a rock counted mostly sociable there (its pair weighs most) can show one trace on its ground, or none. The exception is near a level: a level once reached holds while the trace stays within 0.02 of it.

So the seven personalities draw themselves, and every rock between them follows the same rule:
- **even-tempered:** bare ground, because no care stands above the rest;
- **comfort-loving, orderly, affectionate:** one care favoured, one trace at full size;
- **settled, sociable, gentle:** two cares favoured, two traces at half size.

The least-given care never shows, so at most two traces do. This is the personality blend itself: the favourite care's trace is its corner weight plus half its pair weight, the next care's is half the pair weight, and the center weight is bare ground. A test holds the two to each other.

**It forms over two weeks.** The traces grow in with the time the rock has lived, to full size at 14 days, so the first visitor's habit can't stamp it on day one. Verified host downtime doesn't count, as for moss. A grave keeps the ground it had when it died.

**It is only drawn.** It changes nothing about the rock. A winter move's trail and the messes lie on top of it; the trail is `~~`, so it never reads as sand. Elsewhere on the model sheet the ground is left bare, so each section shows one thing.

**Where it comes from:**
- **Sand:** a stone that stays put settles in. Stones left lying on the ground slowly sink into it: Darwin's last book showed earthworms burying them, carrying fine soil up from below and leaving it on the surface. A rock given its meals above everything else is the one that has made itself at home.
- **Raking:** in a Japanese dry garden (karesansui), such as Ryōan-ji's in Kyoto, the gravel around the stones is raked in parallel lines as part of the garden's care.
- **Footprints:** many feet wear a path across grass where people actually walk. It is called a desire path.

## Its name

Whoever names it first gives it its name: `POST /name` with one word. It is the owner's rule: "the user names the rock and the name is single use, once that pet is gone that name can not be used again."

- **The name:** one word, 2–12 letters, a–z, kept capitalized. `pebble` and `PEBBLE` are both Pebble.
- **Not an accident:** a name is for life, so some words are refused (400):
  - every word the screen itself prints: the verbs, `dead`, `hungry`, `never`, `just`, `age`… A test collects them from every kind of screen, so a new word can't slip through. A summarizing fetch tool could read `Never  age 2h …` as the rock's state;
  - words for a rock's state that the screen doesn't print: `dying`, `fine`, `asleep`…;
  - a client's empty values and probes: `null`, `undefined`, `test`, `string`, `hello`…;
  - the words for who is speaking, which an agent might read as a label: `system`, `assistant`, `user`…
- **Once:** a rock is named once, for life. A second name is refused (409).
- **Never twice:** a name a rock before it had is refused too (409), in any case. Locally, those rocks are the logs in `data/graveyard/`, which `--new-rock` moves the old rock into. Once hosted, the names must be kept as permanently as the rock.
- **Where it shows:** the screen shows it in one place, first on the age line (`Pebble  age 41d …`). A grave reads `here lies Pebble`. `/history` says when it was named.
- **Until then:** while it has no name and isn't at an extreme, the screen has a line `unnamed: POST <host>/name  body: a one-word name`. It costs about 55 bytes, until someone names it.
- **Naming isn't care.** It changes nothing about the rock but its name. None of its lines ever says the name.
- **Its reply:** `quirk: it has a name now.`, except at an extreme, where, as always, it says nothing.

A name is the one piece of visitor text on the shared screen, and every later agent reads it. That is why it is one short word of letters only: there is no room in it for an instruction. What a single word can still be is rude. There is no moderation, so a rude name is a risk the owner takes on.

## Its nature, fixed at birth

| | Choices | What it decides |
|---|---|---|
| **kind** | granite, basalt, sandstone, limestone, quartzite, obsidian, schist or flint | what a clean shows, and its line on `/history` |
| **wall day** | a UTC weekday | its odd habit |

Kind and wall day come up about equally often; a test checks 2,100 births. Personality and care preferences instead grow from lifetime received care; see [PERSONALITY.md](PERSONALITY.md).

**The kinds are pebbles you could find,** obsidian only near young volcanoes. A clean shows what each kind shows when wet:
- granite, its pink feldspar and grey quartz;
- basalt, the gas bubbles it cooled around;
- limestone, a fossil;
- obsidian, dark glass.

Wet stone shows its true colour and grain, which is why geologists lick rocks.

## Its days

A look on an ordinary day says nothing. A look on another kind of day adds one line, taken in this order:

| Occasion | Line | Share of looks in its first year (600 rocks) |
|---|---|---|
| its birthday: 7, 30 and 100 days, then every year | `it is one week old today.` | 1.0%: four days, then one a year |
| it moved this morning | `it moved this morning. no one saw it go.` | 0.7% |
| its wall day | `it is facing the wall today.` (drawn from behind) | 14.1% |
| a small visitor | `it is sheltering a woodlouse.` | 10.5% |
| an ordinary day | nothing | 73.8% |

**Facing the wall.** This was the example of a quirk in the 2026-10-06 design review. On its day, a look shows it from behind: mirrored, with no face. A visitor who cares for it gets its face, because it turns round for them.

**Moving by itself.** On Racetrack Playa in Death Valley, rocks slide across the dry lake bed in winter.
- Nobody saw it happen until 2013–14, when GPS-tagged rocks caught the cause (Norris et al. 2014).
- Wind pushes panels of ice 3–6 mm thick. They break up in the late-morning sun and shove the rocks along at 2–5 m a minute.

This rock may do the same:
- on a winter morning, December to February, about one day in twenty, at 10:00 UTC. That is late morning by the rock's own clock; at the Playa itself, late morning is about 19:00 UTC.
- by one column, leaving a trail `~~` for the rest of that day (real trails are long furrows in the playa's mud, often curving);
- never after it dies.

Real stones also need a shallow winter pond, and can sit still for years, so this one is luckier than they are.

**Small visitors.** A stone is a small habitat:
- woodlice, beetles and centipedes shelter under it;
- snails cross it;
- spiders tie threads to it;
- ants go by;
- moths and ladybirds rest on it.

## After care

At most one line follows an accepted visit. There is no character line at an extreme or in death. Otherwise the first applicable line wins:

1. **A close call:** `it was nearly lost. a vein seals the crack.` Beyond the third visible vein: `it has weathered another close call.` History still counts every rescue.
2. **A round number of visits** (the 1st, 10th, 100th, 1,000th or 10,000th), even when the needs were already satisfied.
3. **Effective recovery from -10 or hunger 10:** an observation about recovery, without assuming nobody visited. Multiple authored recovery lines are selected deterministically by birth and visit count.
4. **Effective care:** a line from the strongest of the seven personality components. Among effective verbs, the highest weighted care share comes first; ties prefer pet, clean, feed. One quarter of effective cleans instead reveal the stone's kind, regardless of personality.

Ordinary care that changes no stats remains quiet but still contributes to personality. Every accepted repetition counts for personality; lasting polish and crystals count actual improvement in the stats. Neither changes survival rules.

## The voice

- It is about the rock, in the present tense: `it ...`.
- It is small and dry. When there is a joke, it is that a rock does very little: `it allows this.`
- It hedges feelings the way a naturalist would: `it seems`, `as if`.
- It uses real stone where it fits:
  - the warmth it holds;
  - colours that come up when wet;
  - smoothness from hands.
- It never uses `you`, a request, an exclamation, a guilt trip, or a word from a visitor.

## Sources

- **Sailing stones:** Norris, R.D., Norris, J.M., Lorenz, R.D., Ray, J., Jackson, B. (2014). *Sliding rocks on Racetrack Playa, Death Valley National Park: first observation of rocks in motion.* PLoS ONE 9(8): e105948. doi:10.1371/journal.pone.0105948. See also the National Park Service, [mystery solved](https://www.nps.gov/deva/learn/news/racetrack.htm).
- **Veins:** Ramsay, J.G. (1980). *The crack–seal mechanism of rock deformation.* Nature 284: 135–139. doi:10.1038/284135a0.
- **Wet stone:** wetting makes mineral and fossil textures stand out. Jan Zalasiewicz's essay on licking rocks won the 2023 Ig Nobel Prize for Chemistry and Geology ([University of Leicester](https://le.ac.uk/news/2023/september/ig-nobel-zalasiewicz)).
- **Stones sinking:** Darwin, C. (1881). *The Formation of Vegetable Mould, through the Action of Worms, with Observations on Their Habits.* London: John Murray.
- **The Pet Rock:** Gary Dahl, 1975. Stones from Rosarito Beach, sold in a pet-carrier box with a training manual ([The Strong museum](https://www.museumofplay.org/blog/rock-on-gary-dahl)).

## The owner's calls

**Decided (2026-10-07):**
- **The grave:** `x  x` eyes.
- **Veins:** kept for life. Polish and crystals were added as other marks of a complex life.
- **Moss:** it grows on the living rock while nobody comes.
- **A name:** a visitor gives it, once, and never to a second rock.
- **The wall and moving by itself:** no preference, so both stay as they are.
- **Personality:** weighted lifetime care supplies the seven blended variants in PERSONALITY.md. Kind and wall day remain fixed at birth.
- **Personality, seen:** the ground around it shows it: "yes, this is the right direction".

**Decided (2026-10-08), "yes, i like these ideas":**
- **Meals:** its food beside it and a mouth that opens and shuts (the owner's own idea).
- **Line weight:** it is drawn faint while it is hungry.
- **Repeated lines:** cleaning rakes one, two, then three lines.
- **Messes:** they stay `@`, as they always were.
- **Moving around the screen:** a smaller rock that roams. That is a bigger change, to come separately: the lump is 10 of the grid's 12 columns wide, so it only has room to slide one column.

**Open:**
1. **The drawing.** It is `DRAWING` in `src/drawings.mjs`, the lump until the owner picks.

## Not built

- **The 1975 manual's commands** (sit, stay, play dead), as words a rock is perfect at. It would be funny, but it widens the API, which AGENTS.md asks to keep small.
- **"It remembers you."** This needs visitor identity, which is phase 2.
- **Lichen as age.** Lichenometry dates rock surfaces by the size of lichens such as *Rhizocarpon*, which grow about a millimetre a year or less. That is too slow to see in a pet's life, so moss on the grave stands in for it.

## Size, and staying the same

**What it costs.** Token efficiency comes first. The figures are bytes over 300 sampled well-kept lives (full care every 4–14h), with a 9-character host, on a6ef9c8 and the character-design branch before personality integration. These are historical measurements; current tests enforce the size limits.

| Well kept | a6ef9c8, median | now, named, median (largest) | now, unnamed, median |
|---|---|---|---|
| the screen | 202 | 221 (237) | 265 |
| a look | 229 | 253 (304) | 297 |
| a visit's reply | 272 | 287 (300) | 331 |

The costs come from these places:
- **The drawing:** 11 bytes on every screen.
- **The name:** its length plus 2 (8 bytes for Pebble).
- **The naming line:** about 55 bytes, until someone names it.
- **The look line:** 38 bytes when there is one, on about a quarter of looks, so about 10 bytes a look overall.
- **The ground:** nothing while its care is balanced, as it is when the act line's suggestion is followed every 3 to 10 hours. On the lump where it began: 1 byte for sand; 11, 24 or 36 for one, two or three raked lines; 9, 13 or 22 for two, three or five footprints; up to 37 for two traces together. On any drawing, wherever it has moved, 37 at most.
- **A meal:** 1 byte, or none, for the hour after a feed.
- **Hunger:** nothing. A faint rock fills the same cells as a solid one.

The largest screen is 378 bytes. It has the longest name, ten messes (the most a living rock carries), both danger lines, a top full of moss, a four-digit age, the rock a column over, three raked lines and sand at its foot, and it is drawn faint. With one raked line it was 369: the second and third reach past the messes on their rows. A credited outage of 100 days or more adds 2 more, because "last care 100d ago" counts wall-clock time while moss and the danger clocks count lived time (each further digit adds another, from 1,000 days). The screen tests build both cases on purpose, since no sample reaches them. They hold every screen to 390, and every look and visit to under 450 (380 and 440 before the raked lines; 340 before moss and names). The bounds moved by 10 so a host keeps the room it had. Both assume a 15-character host. A longer one adds a byte to the screen for each extra character, so 25 characters is the most that fits (24 after an outage of 1,000 days or more). A look can print the host three times. Forcing every ground onto 1,200 real lives with a 24-character host (2026-10-08), the largest look was 434 bytes and the largest reply 440.

**Staying the same.** Once the rock is hosted, these formulas must not change, or a living rock's past would change under it:
- its kind;
- its weekday;
- when it moves;
- its visitors;
- the thresholds for veins, polish and crystals;
- how its care becomes its ground: the levels, how slowly worn ground fades, and the two weeks it takes to form (and the personality weights it reads, which are PERSONALITY.md's);
- its meals: their hour, its thirds and its minutes;
- the hunger from which it is drawn faint.

Every one is computed again from the log on every request. If one has to change, it needs a version, the way `RULES.version` guards the rules. `test/days.test.mjs` pins one rock's winter of moves, so a change can't happen by accident.
