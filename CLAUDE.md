# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Apps

No build step, no server, no dependencies. Open any HTML file directly in a browser:

```
start fitness.html
start tictactoe.html
```

## Repository Structure

This is a vanilla HTML/CSS/JS repository — no framework, no bundler, no package manager. Each app is self-contained:

- **`fitness.html` + `fitness.css` + `fitness.js`** — FitTrack personal fitness tracker (the main app)
- **`tictactoe.html`** — standalone Tic Tac Toe game (single file)

## FitTrack Architecture (`fitness.*`)

All data persists in `localStorage` under four keys: `ft_workouts`, `ft_goals`, `ft_weight`, `ft_habits`.

**`fitness.js` is organized into sections (in order):**
1. **Constants & Data Layer** — `KEYS` object, `loadData`/`saveData`, and 8 typed getter/setter wrappers (`getWorkouts`, `saveWorkouts`, etc.)
2. **State** — single `state` object holds UI state only (active tab, calendar month/year, in-progress log entries, form toggle state). Data is always read fresh from localStorage on each render.
3. **Utilities** — `calcStreak`, `calcGoalCompletion`, `countWeekHabits`, `getWeekDates`, `showToast`, `formatDateDisplay`, `generateId`
4. **Render functions** — one per tab (`renderDashboard`, `renderLogTab`, `renderCalendar`, `renderGoals`, `renderWeightTab`) plus sub-renderers. Tab switching calls `renderTab()` which dispatches to the correct renderer.
5. **Event binding** — all `addEventListener` calls are centralized in `bindAllEvents()`, called once at init.
6. **Init** — `init()` sets default dates, calls `bindAllEvents()`, then `switchTab('dashboard')`.

**Key data shapes:**
```js
// ft_workouts: array
{ id, date: 'YYYY-MM-DD', exercises: [{ name, type: 'reps'|'time', sets, reps, duration }] }
// ft_goals: array
{ id, exerciseName, type: 'reps'|'time', sets, reps, duration }  // duration = seconds per set
// ft_weight: array
{ date: 'YYYY-MM-DD', weight: number, unit: 'kg'|'lbs' }
// ft_habits: object keyed by date
{ 'YYYY-MM-DD': { skippedWorkout, badDiet, alcohol, poorSleep } }  // booleans
```

**Canvas weight chart** (`renderWeightChart`) draws directly on a 600×300 canvas: grid lines, Y-axis labels, X-axis date labels, cyan data line, dots, and a dashed red trend line via least-squares linear regression (x = array index, y = weight). CSS scales it visually with `max-width: 100%`.

**Calendar** uses `(firstDay.getDay() + 6) % 7` to convert JS Sunday-first weekday to Monday-first offset.

**Goal completion** is capped at 100% via `Math.min(100, ...)` and uses case-insensitive exercise name matching.

## Style Conventions

- Dark theme driven entirely by CSS custom properties in `:root` — change colors there only.
- Primary accent: `--accent-red: #e94560` (active states, CTAs). Secondary: `--accent-cyan: #a8dadc` (data, highlights).
- Exercise entries in the log are built with `createElement` (not `innerHTML`) so event listeners can be bound directly on creation.
- `TODAY` is computed once at load time (`new Date().toISOString().slice(0, 10)`) and reused everywhere.
