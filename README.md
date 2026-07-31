# Signal Arcade

A single-codebase Expo (React Native + TypeScript) app collecting small, self-contained logic puzzle games. Runs on iOS, Android, and web from one codebase.

## Games

- **Relay** — Signal-routing puzzle. Place relays on a grid to route power to every receiver within budget, respecting range-limited hops, line-of-sight, and color interference/jamming.
- **Kings** — Region logic puzzle. Place exactly one king per row, column, and region so that no two kings touch, even diagonally.
- **Matching Numbers** — Sum-to-10 line match. Clear the board by connecting pairs of equal or sum-to-10 numbers with a straight or single-bend line through empty cells.
- **Block Fill** — Drag-a-path fill puzzle. Drag through every fillable cell on the board to color it all in; rewind your path anytime by touching an earlier point on the trail.
- **Cross Sums** — Keep/exclude puzzle. Toggle cells between kept and excluded on a pre-filled numeric grid until every row and column sums to its target.
- **Color Sort** — Pour & sort puzzle. Pour colors between tubes, matching color onto matching color (or into an empty tube), until every color lands in one tube of its own.
- **Tents & Trees** — Placement puzzle. Pitch exactly one tent per tree, orthogonally adjacent and never touching another tent, so each row/column hits its target tent count.
- **Shikaku** — Rectangle-division puzzle. Divide the grid into rectangles, each containing exactly one numbered clue equal to its area.

Every game ships in English and French (`src/i18n`, per-game `locales/en.json` + `locales/fr.json`); language is detected from the device locale and can be overridden from Settings.

The Library screen's Settings tab also lets players switch language, see the app version, and reset a specific game's saved progress.

## Running it

```
npm install
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, `w` for web, or scan the QR code with Expo Go on your phone.

- `npm run typecheck` — `tsc --noEmit` over `src/`.
- `npm run typecheck:tools` — `tsc --noEmit` over `tools/`.
- `npm run i18n:check` — verifies every namespace has matching keys across `en`/`fr`.
- `npm run levels -- <kings|relay> <new|generate|validate|render|add|sync>` — the level-authoring CLI (see `tools/level-creator/`); other games generate levels procedurally at runtime instead of from an authored file.

## Structure

Each game is fully self-contained under `src/games/<id>/` (pure `engine.ts` game logic, its own screens, navigation, and progress state), and registered in `src/games/registry.ts`. The Library screen, Settings, navigation shell, and shared theme are game-agnostic.

```
src/
  theme/            shared design tokens (colors, fonts, spacing)
  components/       app-shell UI shared by all games
  navigation/        RootNavigator merges "Library" + Settings + every game's screens
  i18n/              i18next setup, language detection/persistence, locales/common
  screens/
    LibraryScreen.tsx        the game-picker home screen
    SettingsScreen.tsx       language, app version, entry to Game Progress
    GameProgressScreen.tsx   per-game "levels completed" + reset progress
  games/
    types.ts          the GameModule contract every game exports (incl. optional useProgress for Settings)
    registry.ts        <-- add new games here
    <game-id>/         engine.ts, screens/, state/, locales/, tutorialContent.tsx, index.tsx

tools/
  level-creator/     CLI for authoring/validating Kings and Relay levels by hand
  i18n-check/        the script behind `npm run i18n:check`

workflows/           agent workflow scripts (e.g. relay-level-generator.js)
output/              generated output from workflow runs
```
