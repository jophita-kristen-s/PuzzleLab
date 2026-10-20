# PuzzleLab — Think in patterns.

PuzzleLab is a responsive, browser-based logic playground built to demonstrate interactive UI development, constraint checking, and a backtracking Sudoku solver.

## Features

- Interactive 9×9 Sudoku board with locked clues, number pad, keyboard input, and conflict highlighting.
- Easy, medium, and hard example puzzles.
- Step-through solver replay showing candidate attempts, accepted placements, rejected candidates, and backtracking.
- Instant solve and board validation.
- Solver metrics: candidate attempts, backtracks, and replay steps.
- Algorithm Lab with pseudocode and a local benchmark.
- Daily Challenge view with a deterministic date-based puzzle selection.
- Dark/light theme toggle and responsive layout.
- No build step, framework, account, backend, or external assets required.

## Run locally

1. Download and extract the ZIP.
2. Open `index.html` in a modern browser.

For a local development server, run one of these commands from the extracted folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

If `python` is not available on Windows, try:

```powershell
py -m http.server 8000
```

## Deploy with GitHub Pages

1. Create a repository named `puzzlelab`.
2. Upload `index.html`, `styles.css`, `app.js`, and this README to the repository root.
3. In **Settings → Pages**, select **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.
5. Wait for GitHub Pages to publish the site.

## How the solver works

The solver finds the next empty cell, tries candidate numbers 1–9, and checks each candidate against the cell's row, column, and 3×3 box. If a candidate is valid, it places it and recurses. If that path eventually fails, it removes the candidate and tries the next value.

This is a depth-first search with backtracking. In the UI, a precomputed sequence of board snapshots is replayed so the learner can inspect decisions one at a time.

## Important prototype notes

- The three included puzzles are fixed example boards; the daily challenge chooses among them deterministically based on the date. It is not a globally unique daily puzzle service.
- The benchmark reports measurements from the current browser/device; runtime is not directly comparable across devices.
- This is a frontend-only learning project. There is no account system, online leaderboard, server, or persistent progress storage.
- Before presenting the project as production-ready, add automated tests for puzzle validity and solver correctness, improve accessibility testing, and consider a proper puzzle generator with uniqueness checks.
- This project is an educational demonstration and does not require external API keys.

## Suggested next improvements

1. Add unit tests for row, column, box, and solver behavior.
2. Generate puzzles with guaranteed unique solutions.
3. Add hint mode and candidate notes.
4. Add logic-grid puzzle types.
5. Add a progress history using local storage.
6. Add CI with GitHub Actions.

## Tech stack

- HTML5
- CSS3 (responsive layout, theme variables, grid)
- Vanilla JavaScript (DOM events, Sudoku constraints, recursive backtracking)

## License

Choose and add a license before accepting contributions or distributing the project publicly.
