# Basic Exercise Variants + Smart Search — Design

## Goal

1. Add ~50 common basic exercise variants to the exercise library (`src/lib/exercises.json`) so users can find plain versions (e.g. "T-Bar Row") instead of only machine/lever variants (e.g. "Lever Reverse T-Bar Row").
2. Improve exercise search in `LibraryScreen.jsx` from exact-substring matching to scoring-based best-match ranking, so typing "dumbbell row" surfaces "Dumbbell Incline Row".

## Exercise Data

- Add entries with the existing shape: `{ "name", "muscle", "equipment" }`.
- Use existing `muscle` values: Chest, Back, Shoulders, Arms, Legs, Core.
- Use existing `equipment` values: body weight, barbell, dumbbell, cable, leverage machine, wheel roller, etc.
- Verified missing (added): T-Bar Row, Seated Row, Deadlift, Sumo Deadlift, Front Squat, Hack Squat, Incline Bench Press, Decline Bench Press, Chest Press, Shoulder Press, Arnold Press, Front Raise, Cable Crossover, Pec Deck, Chest Fly, Dip, Preacher Curl, Concentration Curl, Triceps Extension, Skullcrusher, Triceps Pushdown, French Press, Overhead Triceps Extension, Kickback, Barbell Curl, Hammer Curl, Lateral Raise, Rear Delt Fly, Face Pull, Hip Thrust, Glute Bridge, Lunge, Walking Lunge, Step-Up, Split Squat, Good Morning, Leg Extension, Leg Curl, Standing Calf Raise, Seated Calf Raise, Crunch, Side Plank, Ab Wheel, Cable Crunch, Leg Raise, Back Extension (+ a few more to reach ~50 total, all verified absent by exact-name scan).

## Search Matching (`LibraryScreen.jsx`)

Replace the substring filter with a scoring function:

1. Tokenize the query into lowercase words.
2. Score each exercise (name only, since the muscle chip filter already handles categories):
   - Exact name match → highest.
   - Name starts with query → high.
   - Name contains query substring → high.
   - Otherwise: every query word must match at least one word in the name (equal / prefix / substring); require ALL words to match; bonus when words appear in the same order as the query.
   - Any missing word → no match.
3. Filter `LIBRARY` to scores >= 0, sort by score descending, tie-break alphabetically.
4. Empty state still shows when no exercise scores.

## Out of Scope

- No server/database changes; library is static JSON.
- No changes to category chips.
