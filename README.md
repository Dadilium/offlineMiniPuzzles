# Signal Arcade

A single-codebase Expo (React Native + TypeScript) app collecting small, self-contained logic puzzle games. Runs on iOS, Android, and web from one codebase.

## Games

- **Relay** — Signal-routing puzzle. Place relays on a grid to route power to every receiver within budget, respecting range-limited hops, line-of-sight, and color interference/jamming.
- **Kings** — Region logic puzzle. Place exactly one king per row, column, and region so that no two kings touch, even diagonally.
- **Matching Numbers** — Sum-to-10 line match. Clear the board by connecting pairs of equal or sum-to-10 numbers with a straight or single-bend line through empty cells.
- **Block Fill** — Drag-a-path fill puzzle. Drag through every fillable cell on the board to color it all in; rewind your path anytime by touching an earlier point on the trail.
- **Cross Sums** — Keep/exclude puzzle. Toggle cells between kept and excluded on a pre-filled numeric grid until every row and column sums to its target.

## Running it

```
npm install
npx expo start
```

Then press `i` for iOS simulator, `a` for Android emulator, `w` for web, or scan the QR code with Expo Go on your phone.

`npm run typecheck` runs `tsc --noEmit`.

## Structure

Each game is fully self-contained under `src/games/<id>/` (pure `engine.ts` game logic, its own screens, navigation, and progress state), and registered in `src/games/registry.ts`. The Library screen, navigation shell, and shared theme are game-agnostic.

```
src/
  theme/            shared design tokens (colors, fonts, spacing)
  components/       app-shell UI shared by all games
  navigation/        RootNavigator merges "Library" + every game's screens
  screens/
    LibraryScreen.tsx   the game-picker home screen
  games/
    types.ts          the GameModule contract every game exports
    registry.ts        <-- add new games here
    <game-id>/         engine.ts, levels.ts, screens/, state/, tutorialContent.tsx, index.tsx
```
