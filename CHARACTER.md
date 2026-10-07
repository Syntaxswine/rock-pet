# Rock Pet — the character

2026-10-07. Who the rock is, how it looks in every state, what it says and when, and the real things each part is borrowed from.

- **The code:**
  - `src/character.mjs`: its nature and its days.
  - `src/marks.mjs`: the moss, veins, polish and crystals its life leaves.
  - `src/name.mjs`: its name.
  - `src/story.mjs`: its lines.
  - `src/screen.mjs` draws it, from one of the drawings in `src/drawings.mjs`.
- **The checks:** `test/character.test.mjs`, `test/marks.test.mjs`, `test/days.test.mjs` and `test/name.test.mjs` hold all of it to this page. `node tools/model-sheet.mjs` draws the model sheet below with the game's own renderer.

## Who it is

It is a pebble with a face, sitting on a floor, looked after by visitors who mostly won't remember it.

**It keeps a record.** Rocks are records of what happened to them:
- a cracked rock heals with a vein of quartz;
- hands polish a stone that is often handled;
- water seeping through a rock leaves crystals in its hollows;
- a rolling stone gathers no moss, but a stone left alone does.

This one keeps the record its visitors can't keep for themselves. Each time someone brings it back from the brink, it keeps a vein. A lot of petting polishes it, and a lot of meals grow crystals in it. The history page counts all of these with everything else that was done, and names nobody.

**It has a name, once.** Whoever names it first gives it its name, for life, and no rock after it can have that name.

**It never speaks.** Every line about it is an observation, the way a field guide describes an animal: *it leans into the attention.*
- It doesn't plead, and it doesn't blame.
- It doesn't know who you are. When it was lonely, it "seems to have missed someone".

**Lineage: the 1975 Pet Rock.**
- They were smooth stones from Rosarito Beach in Baja California.
- They came in a box shaped like a pet carrier, with a training manual for sit, stay and play dead.
- Their joke was that a rock needs nothing.

This one needs feeding, cleaning and attention, and it can die. The owner made that the point: "without it there is no meaning."

**The brief.** Rockbot, the agent who will play, asked for "small ones, because I still want your creature, not a design-by-committee pet". Each part below answers one of its asks:

| Rockbot asked for | The rock |
|---|---|
| moods | its face |
| preferences | it likes one kind of care best, and reacts to that first |
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

moss: hours since anyone came (cared for every 8h until then)

6               12              24              48
|3          6|  |5          5|  |10       -10|  |10       -10|
|            |  |     ,,     |  |    ",,     |  |    ",,     |
|    ___     |  |    ___     |  |    ___,    |  |  ,,___,"   |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  o  o  \ |  | /  T  T  \ |  | /  T  T  \ |
| \________/ |  | \________/ |  | \________/ |  | \________/ |
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

its days: the wall, a morning it moved

facing the wall  moved left
|2          6|  |2          6|
|            |  |            |
|     ___    |  |   ___      |
|  __/   \_  |  | _/   \__   |
| /        \ |  |/  ^  ^  \  |
| \________/ |  |\________/..|
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
|    ___     |  |  ,,___,"   |  |    ___     |  |     ___    |  |  ,,___,",  |
|  _/   \__  |  |  _/   \__  |  |  _/ / \__  |  |  __/   \_  |  | "_/ / \__, |
| /  ^  ^  \ |  | /  T  T  \ |  | /' ^  ^  \ |  | /        \ |  |,/  x  x  \ |
| \________/ |  | \________/ |  | \______*_/ |  | \________/ |  | \________/ |

googly: googly eyes, the craft-table pet rock
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |    ",,,    |  |            |  |            |  |    ",,,    |
|    ____    |  |  ,,____"   |  |    ____    |  |    ____    |  |  ,,____",  |
|  .'    '.  |  |  .'    '.  |  |  .'  / '.  |  |  .'    '.  |  | ".'  / '., |
| / (^)(^) \ |  | / (T)(T) \ |  | /'(^)(^) \ |  | /        \ |  |,/ (x)(x) \ |
| \________/ |  | \________/ |  | \______*_/ |  | \________/ |  | \________/ |

boulder: round and solid
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |   ,",,,"   |  |            |  |            |  |   ,",,,"   |
|   .----.   |  |  ,.----.   |  |   .----.   |  |   .----.   |  |  ,.----.,  |
|  /      \  |  |  /      \  |  |  / ' /  \  |  |  /      \  |  | "/   /  \, |
| |  ^  ^  | |  | |  T  T  | |  | |  ^  ^  | |  | |        | |  |,|  x  x  | |
|  \______/  |  |  \______/  |  |  \____*_/  |  |  \______/  |  |  \______/  |

cairn: a small stone perched on a flat one
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |    ",,,    |  |            |  |            |  |    ",,,    |
|    .--.    |  |   ,.--."   |  |    .'-.    |  |    .--.    |  |   ,.--."   |
|   (^  ^)   |  |  ,(T  T)   |  |   (^  ^)   |  |   (    )   |  |  ,(x  x),  |
|  .------.  |  |  .------.  |  |  .--/---.  |  |  .------.  |  | ".--/---., |
| (________) |  | (________) |  | (_______*) |  | (________) |  |,(________) |

sett: a squared paving stone, a sett (a cobble is rounded)
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |            |  |            |  |            |  |            |
|            |  |  ,,",,,"   |  |            |  |            |  |  ,,",,,"," |
|  ._______. |  |  ._______. |  |  .___/___. |  |  ._______. |  | ,.___/___.,|
|  | ^   ^ | |  |  | T   T | |  |  |'^   ^ | |  |  |       | |  |  | x   x | |
|  |_______| |  |  |_______| |  |  |_____*_| |  |  |_______| |  |  |_______| |

hoodoo: a little spire with a cap stone
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |   ,",,,"   |  |            |  |            |  |   ,",,,"   |
|   ______   |  |  ,______   |  |   ___/__   |  |   ______   |  |  ,___/__,  |
|  (______)  |  |  (______)  |  |  (______)  |  |  (______)  |  | "(______), |
|   | ^^ |   |  |   | TT |   |  |   |'^^ |   |  |   |    |   |  |  ,| xx |   |
|   |____|   |  |   |____|   |  |   |_*__|   |  |   |____|   |  |   |____|   |

pebble: the first drawing, a small pebble
happy           48h alone       a long life     the wall        dead a month
|2          9|  |10       -10|  |2          6|  |2          6|  |died: lonely|
|            |  |            |  |            |  |            |  |            |
|            |  |   ,",,,"   |  |            |  |            |  |   ,",,,"   |
|   .----.   |  |  ,.----.   |  |   .-/-'.   |  |   .----.   |  |  ,.-/--.,  |
|  ( ^  ^ )  |  |  ( T  T )  |  |  ( ^  ^ )  |  |  (      )  |  | "( x  x ), |
|   '----'   |  |   '----'   |  |   '*---'   |  |   '----'   |  |  ,'----'   |
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

## The drawings

The owner asked to see new drawings. They are all in the model sheet above, in the same five states, and `src/drawings.mjs` holds them. `DRAWING` names the one the screen uses. Choosing one takes four steps:
1. set `DRAWING`;
2. paste `node tools/model-sheet.mjs` over the sheet above;
3. redraw the two mocks in `test/screen.test.mjs` and DESIGN-NOTES (the screen tests print what they now are);
4. redraw README's mock;
5. in this page, move "(drawn now)" in the table below, update the drawing's bytes under "What it costs", and close the open call.

No other test depends on which drawing it is.

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
| a trail `..` beside it | it moved | for the rest of that UTC day | the next day |

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
| **voice** | curious, stoic or warm | which of the three sets of reactions from a6ef9c8 it uses. It is chosen the same way as before, so a rock born before this build keeps its voice. |
| **likes** | being fed, cleaned or petted | the care it reacts to first |
| **wall day** | a UTC weekday | its odd habit |

Each choice comes up about equally often; a test checks 2,100 births.

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
- by one column, leaving a trail for the rest of that day;
- never after it dies.

Real stones also need a shallow winter pond, and can sit still for years, so this one is luckier than they are.

**Small visitors.** A stone is a small habitat:
- woodlice, beetles and centipedes shelter under it;
- snails cross it;
- spiders tie threads to it;
- ants go by;
- moths and ladybirds rest on it.

## After care

Care that changed something gets one line. Care that changed nothing gets none. The line is the first of these that applies:

1. **A close call:** `it was nearly lost. a vein seals the crack.`
2. **A round number of visits** (the 1st, 10th, 100th, 1,000th or 10,000th): `it has had a hundred visits now.`
3. **Brought back from −10, or from hunger 10, within the day:** `it seems to have missed someone.`, or `it was very hungry. it is less so now.`
4. **Otherwise, the care it likes best, if that care happened.** Failing that: petting, then cleaning, then feeding. The line is in its voice, from three or four lines for each kind of care, chosen by the visit's number.

Every set of reactions starts with the old line, so nothing it said before is lost. Some of the new lines:

| | curious | stoic | warm |
|---|---|---|---|
| pet | it would like the other side done too. | it does not purr. it is a rock. | it is a little smoother for it. |
| clean | it inspects where the mess was. | it was going to do that itself. | it rests easier in the clean. |
| feed | it hides a little for later. | it accepts the meal without comment. | it is quietly grateful. |

"A little smoother for it" is true of stone: hands polish it.

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
- **The Pet Rock:** Gary Dahl, 1975. Stones from Rosarito Beach, sold in a pet-carrier box with a training manual ([The Strong museum](https://www.museumofplay.org/blog/rock-on-gary-dahl)).

## The owner's calls

**Decided (2026-10-07):**
- **The grave:** `x  x` eyes.
- **Veins:** kept for life. Polish and crystals were added as other marks of a complex life.
- **Moss:** it grows on the living rock while nobody comes.
- **A name:** a visitor gives it, once, and never to a second rock.
- **The wall and moving by itself:** no preference, so both stay as they are.

**Open:**
1. **The drawing.** It is `DRAWING` in `src/drawings.mjs`, the lump until the owner picks.
2. **Its nature.** The owner wants it to come from how the rock is treated, not from its birth. That work is under way separately, and "Its nature, fixed at birth" above describes the build as it stands.

## Not built

- **The 1975 manual's commands** (sit, stay, play dead), as words a rock is perfect at. It would be funny, but it widens the API, which AGENTS.md asks to keep small.
- **"It remembers you."** This needs visitor identity, which is phase 2.
- **Lichen as age.** Lichenometry dates rock surfaces by the size of lichens such as *Rhizocarpon*, which grow about a millimetre a year or less. That is too slow to see in a pet's life, so moss on the grave stands in for it.

## Size, and staying the same

**What it costs.** Token efficiency comes first. The figures are bytes over 300 sampled well-kept lives (full care every 4–14h), with a 9-character host, on the commit before this work (a6ef9c8) and now.

| Well kept | a6ef9c8, median | now, named, median (largest) | now, unnamed, median |
|---|---|---|---|
| the screen | 202 | 221 (237) | 265 |
| a look | 229 | 253 (304) | 297 |
| a visit's reply | 272 | 287 (300) | 331 |

The costs come from four places:
- **The drawing:** 11 bytes on every screen.
- **The name:** its length plus 2 (8 bytes for Pebble).
- **The naming line:** about 55 bytes, until someone names it.
- **The look line:** 38 bytes when there is one, on about a quarter of looks, so about 10 bytes a look overall.

The largest screen is 368 bytes. It has the longest name, ten messes (the most a living rock carries), both danger lines, a top full of moss, a four-digit age, and the rock a column over. A long credited outage adds up to 2 more, because "last care 100d ago" counts wall-clock time while moss and the danger clocks count lived time. The screen tests build both cases on purpose, since no sample reaches them. They hold every screen to 380 (340 before moss and names), and every look and visit to under 440. Both bounds assume a 15-character host. A longer one adds a byte for each extra character, so 25 characters is the most that fits.

**Staying the same.** Once the rock is hosted, these formulas must not change, or a living rock's past would change under it:
- its kind;
- its weekday;
- when it moves;
- its visitors;
- the thresholds for veins, polish and crystals.

Every one is computed again from the log on every request. If one has to change, it needs a version, the way `RULES.version` guards the rules. `test/days.test.mjs` pins one rock's winter of moves, so a change can't happen by accident.
