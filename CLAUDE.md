# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Apps

No build step, no server, no dependencies. Open any HTML file directly in a browser:

```
start fitness.html
start tictactoe.html
```

## Repository Structure

Vanilla HTML/CSS/JS — no framework, no bundler, no package manager. Each app is self-contained:

- **`fitness.html` + `fitness.css` + `fitness.js`** — Workout Tracking app (the main app)
- **`tictactoe.html`** — standalone Tic Tac Toe game (single file)

## Workflow Rules

- **Every approved change must be committed and pushed** to `origin/master` immediately after implementation.
- Commit messages must be detailed enough to support rollback: describe *what* changed, *why*, and any notable trade-offs or data-compatibility notes.
- Use `feat:` / `fix:` / `refactor:` / `docs:` prefixes on commit subjects.
- Never commit `.claude/` — it contains Claude Code internal state.

## Workout Tracking App Architecture (`fitness.*`)

### Design

Spotify-inspired dark theme:

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#121212` | Page background |
| `--bg-elevated` | `#282828` | Modal, card surfaces |
| `--bg-highlight` | `#3e3e3e` | Input backgrounds, exercise cards |
| `--accent` | `#1db954` | Primary buttons, focus rings |
| `--accent-hover` | `#1ed760` | Button hover state |
| `--text-primary` | `#ffffff` | Body text |
| `--text-secondary` | `#b3b3b3` | Labels, metadata |
| `--text-subdued` | `#535353` | Placeholders, separators |
| `--danger` / `--danger-light` | `#e22134` / `#f15e6c` | Validation errors |

Primary buttons are pill-shaped (`border-radius: 500px`), green on black text. No decorative borders on cards — background color difference creates hierarchy.

### Data

Only one `localStorage` key is active:

```js
// ft_workouts: array
{
  id:        string,           // generateId() — base-36 timestamp + random
  date:      'YYYY-MM-DD',     // selected date (may differ from logged date)
  timestamp: ISO string,       // when the session was actually saved — used for ordering
  exercises: [
    {
      name:     string,
      type:     'reps' | 'time',
      sets:     number,        // reps type only (always 1 for time)
      reps:     number,        // reps type only
      minutes:  number,        // time type only (new entries)
      duration: number,        // seconds — kept for backward compat with legacy entries
    }
  ]
}
```

Legacy entries (saved before `timestamp` was introduced) have no `timestamp` field. The sort falls back to `date + 'T00:00:00.000Z'` so they sort correctly by date.

### `fitness.js` — section order

1. **Constants & Data Layer** — `KEYS`, `loadData`/`saveData`, `getWorkouts`/`saveWorkouts`
2. **State** — single `state` object: `{ modalDate, modalExercises[] }`
3. **Utilities** — `generateId`, `formatDateDisplay`, `toDisplayDate`, `parseDDMMYYYY`, `showToast`, `isPositiveInt`
4. **Workout History** — `renderWorkoutHistory()`: sorts by `timestamp` desc, groups by `date`, renders date headers + exercise rows
5. **Modal** — `openModal`, `closeModal`, `renderModalExercises`, `buildRepsFields`, `buildTimeFields`, `clearExError`, `setExError`
6. **Validation & Save** — `validateAndSave()`: re-parses date from text field, checks all exercise fields, writes to localStorage
7. **Event Binding** — `bindAllEvents()`: wires all static listeners once at init; dynamic listeners are attached inside render functions
8. **Init** — `init()`: sets header date, calls `bindAllEvents()`, then `renderWorkoutHistory()`

### Key behaviours

**Date input (modal)**
- Text field accepts `DD-MM-YYYY`; validated on `blur` and re-validated on save.
- Calendar icon calls `datePicker.showPicker()` (falls back to `.click()`).
- Picker and text field stay in sync bidirectionally.

**Exercise entry**
- Type toggle: **Reps** shows Sets × Reps inputs; **Time** shows a single Minutes input.
- All numeric inputs (sets, reps, minutes) must be positive integers — validated via `isPositiveInt(val)` which checks `Number.isInteger(Number(val)) && Number(val) >= 1`.
- Inline error message displayed inside each exercise card on failure.

**Workout history**
- Sorted by `timestamp` descending (newest first).
- Grouped by `date` — date header shown once per day.
- Exercise row: `name` (left) · `sets × N reps` or `N min` (right).

### Style conventions

- All colours via CSS custom properties in `:root` — never hardcode hex values in rules.
- Dynamic DOM is built with `createElement` (not `innerHTML`) so event listeners can be attached directly.
- `TODAY` computed once at load: `new Date().toISOString().slice(0, 10)`.
- `.hidden` class uses `display: none !important` — toggled to show/hide modal and type-specific fields.
