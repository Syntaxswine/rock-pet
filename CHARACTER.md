# Rock Pet — the character

2026-10-07. Who the rock is, how it looks in every state, what it says and when, and the real things each part is borrowed from.

- **The code:**
  - `src/character.mjs`: its nature and its days.
  - `src/story.mjs`: its lines.
  - `src/screen.mjs`: the drawing.
- **The checks:** `test/character.test.mjs` holds all of it to this page. `node tools/model-sheet.mjs` draws the model sheet below with the game's own renderer.

## Who it is

It is a pebble with a face, sitting on a floor, looked after by visitors who mostly won't remember it.

**It keeps a record.** Rocks are records of what happened to them:
- a cracked rock heals with a vein of quartz;
- a stone left alone gathers grit, then moss.

This one keeps the record its visitors can't keep for themselves. Each time someone brings it back from the brink, it keeps a vein. The history page counts the veins with everything else that was done, and names nobody.

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
| "let the pet miss me or get scruffy" | grit settles while nobody comes, and a visit brushes it off |
| "a little memory" | veins for close calls, birthdays, round numbers of visits, the history page |

## What it never does

1. **It never changes the game.** Nothing here moves hunger, happiness, messes or death.
   - The engine only counts close calls, alongside everything else.
   - A test draws and describes frozen states, where any write would throw.
2. **It is described, never heard.** Every line follows the same rules, and a test checks every line:
   - it starts with "it";
   - it is lowercase, plain ASCII, and at most 44 characters;
   - it never says "you", "please" or "must".
3. **It never pleads or blames.** Absence shows as grit, and as having missed *someone*.
4. **One line at most, and none at the edge.**
   - There is no line while it is at an extreme: the danger lines need the room, and whimsy at the brink would be wrong.
   - There is none in death.
5. **It is the same for everyone.** Two visitors at the same moment see the same rock, and anyone can work out why:
   - its nature follows from its birth time;
   - its days follow from the UTC date.
6. **It never shows visitor text.** This is AGENTS.md invariant 5.

## The model sheet

The game draws this itself (`node tools/model-sheet.mjs`). The numbers in the corners are hunger and happiness, as in play.

```text
faces, by happiness

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

grit: hours since anyone came

under 12        12              24              48
|2          6|  |2          1|  |2         -6|  |2        -10|
|            |  |            |  |            |  |     ,      |
|    ___     |  |    ___ .   |  |  ' ___ .   |  |  ' ___ .   |
|  _/   \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /  ^  ^  \ |  | /  o  o  \ |  | /  ;  ;  \ |  | /  T  T  \ |
| \________/ |  | \________/ |  | \________/ |  | \________/ |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |

veins: close calls

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

its days: the wall, a morning it moved

facing the wall  moved left
|2          6|  |2          6|
|            |  |            |
|     ___    |  |   ___      |
|  __/ \ \_  |  | _/   \__   |
| /        \ |  |/  ^  ^  \  |
| \________/ |  |\________/..|
|            |  |            |
|            |  |            |
|            |  |            |
|            |  |            |
|            |  |            |
|            |  |            |

the grave: at death, then moss

died            a week          a month         a season
|died: lonely|  |died: lonely|  |died: lonely|  |died: lonely|
|            |  |    , ,     |  |    ,,,     |  |    ,,,     |
|    ___     |  |  , ___ ,   |  |  ,,___ ,,  |  |  ,,___,,,  |
|  _/ / \__  |  |  _/   \__  |  |  _/   \__  |  |  _/   \__  |
| /        \ |  | /        \ |  | /        \ |  | ,        , |
| \________/ |  | \________/ |  | \________/ |  | \________/ |
|            |  |            |  |            |  |            |
|  @     @   |  |  @     @   |  |  @     @   |  |  @     @   |
|     @      |  |     @      |  |     @      |  |     @      |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
|            |  |            |  |            |  |            |
```

## Its face

The eyes show its mood. They are the build's faces from 2026-10-06, except in death.

| happiness | eyes |
|---|---|
| 5 and up | `^  ^` |
| 0 to 5 | `o  o` |
| −5 to 0 | `-  -` |
| below −5 | `;  ;` |
| at −10, its 48h running | `T  T` |
| dead | none: the face goes, and it is a stone again |

**The drawing is a lump with a flat base.** It reads as a stone sitting on the ground, not a pill floating in the air. It takes four rows instead of three, at a cost of 11 bytes a screen.

## The marks

| Mark | Means | Appears | Goes |
|---|---|---|---|
| grit `.` `'` `,` above it | nobody has come | after 12h, 24h and 48h without care | any visit brushes it off |
| a vein `/` in it | a close call | a visit brings hunger or happiness back after a day or more at its extreme | never; three are drawn, and `/history` counts the rest |
| moss `,` over it | it is a grave | a week, a month and a season after death | never |
| a trail `..` beside it | it moved | for the rest of that UTC day | the next day |

**Veins.** When a rock cracks, water carrying dissolved minerals seeps in and seals the crack, often with white quartz or calcite. The healed crack is a vein.
- Crack-seal veins can record hundreds of cracks and seals, each a stress the rock survived (Ramsay 1980).
- This rock's veins are its close calls: the times someone came when it had less than a day left.
- A vein is the one mark that never goes. That is honest, because the rock was nearly lost. It is also kind, because a vein is a crack that healed.

**Grit and moss** are Rockbot's "scruffy".
- Grit is what absence costs, and a visit undoes it.
- Moss is what a grave gets: an undisturbed stone greens over. Someone who comes months later finds the grave mossed over, and can tell how long it has been.

## Its nature, fixed at birth

| | Choices | What it decides |
|---|---|---|
| **kind** | granite, basalt, sandstone, limestone, quartzite, obsidian, schist or flint | what a clean shows, and its line on `/history` |
| **voice** | curious, stoic or warm | which of the three sets of reactions from a6ef9c8 it uses. It is chosen the same way as before, so a rock born before this build keeps its voice. |
| **likes** | being fed, cleaned or petted | the care it reacts to first |
| **wall day** | a UTC weekday | its odd habit |

Each choice comes up about equally often; a test checks 2,100 births.

**The kinds are common pebbles,** and a clean shows what each kind shows when wet:
- granite, its pink feldspar and grey quartz;
- basalt, the gas bubbles it cooled around;
- limestone, a fossil;
- obsidian, dark glass.

Wet stone shows its true colour and grain, which is why geologists lick rocks.

## Its days

A look on an ordinary day says nothing. A look on another kind of day adds one line, taken in this order:

| Occasion | Line | Share of looks (400 rock-years) |
|---|---|---|
| its birthday: 7, 30 and 100 days, then every year | `it is one week old today.` | 1.1% |
| it moved this morning | `it moved this morning. no one saw it go.` | 0.7% |
| its wall day | `it is facing the wall today.` (drawn from behind) | 14.0% |
| a small visitor | `it is sheltering a woodlouse.` | 10.4% |
| an ordinary day | nothing | 73.7% |

**Facing the wall.** This was the example of a quirk in the 2026-10-06 design review. On its day, a look shows it from behind: mirrored, with no face. A visitor who cares for it gets its face, because it turns round for them.

**Moving by itself.** On Racetrack Playa in Death Valley, rocks slide across the dry lake bed in winter.
- Nobody saw it happen until 2013–14, when GPS-tagged rocks caught the cause (Norris et al. 2014).
- Wind pushes panels of ice 3–6 mm thick. They break up in the late-morning sun and shove the rocks along at 2–5 m a minute.

This rock may do the same:
- on a winter morning, December to February, about one day in twenty, at 10:00 UTC;
- by one column, leaving a trail for the rest of that day;
- never after it dies.

Real stones also need a shallow winter pond, and can sit still for years, so this one is luckier than they are.

**Small visitors.** A stone is a small habitat:
- woodlice and beetles shelter under it;
- snails cross it;
- spiders tie threads to it;
- moths rest on it.

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
- **The Pet Rock:** Gary Dahl, 1975. Stones from Rosarito Beach, sold with *The Care and Training of Your Pet Rock* ([The Strong museum](https://www.museumofplay.org/blog/rock-on-gary-dahl)).

## The owner's calls

These choices are mine, and each is a small edit to change. The default is in brackets.

1. **The drawing** [the lump]. The old pebble is three lines in `sprite()`.
2. **The grave** [faceless]. `x  x` is one line in `eyes()`.
3. **Veins** [kept for life].
4. **The wall** [weekly]. It could be rarer, or never.
5. **Moving by itself** [yes].
6. **Its kind** [chosen at birth, from eight]. You could choose it instead.
7. **A name** [none, only "it"]. A name is the plainest way to make it yours, and only you can give it.

## Not built

- **The 1975 manual's commands** (sit, stay, play dead), as words a rock is perfect at. It would be funny, but it widens the API, which AGENTS.md asks to keep small.
- **"It remembers you."** This needs visitor identity, which is phase 2.
- **Lichen as age.** Lichenometry dates rock surfaces by the size of lichens such as *Rhizocarpon*, which grow about a millimetre a year or less. That is too slow to see in a pet's life, so moss on the grave stands in for it.

## Size

Token efficiency comes first, so here is what the character costs. The figures are bytes over 300 sampled lives, on the commit before this work (a6ef9c8) and after it.

| Well kept (full care every 4–14h) | before, median | after, median | after, largest |
|---|---|---|---|
| the screen | 202 | 213 | 224 |
| a look | 229 | 245 | 290 |
| a visit's reply | 272 | 279 | 292 |

The costs come from two places:
- **The drawing:** 11 bytes on every screen.
- **The look line:** about 50 bytes, on a quarter of looks.

A visit's reply already carried a reaction line, and its lines are a few characters longer now. Under random care, with many rocks dead or at an extreme, the largest look is 347 bytes and the largest screen 326. The screen test holds every screen to 340 bytes, and the character test holds every look and visit to under 440.
