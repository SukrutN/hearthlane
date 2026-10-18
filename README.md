# Hearthline

A browser studio for optimal multi-agent pathfinding. Paint a 4-connected floor, place travelers, and compare two searches on the same room:

- **CBS** — Conflict-Based Search (Sharon, Stern, Felner, Sturtevant). A high-level constraint tree ordered by the sum of arrival times. The low level is space-time A* with unit costs and waits. Vertex conflicts and edge swaps are both branching conflicts. The first conflict-free node is an optimal joint plan.
- **ICBS** — Improved CBS (Boyarski et al.). The same tree, plus conflict classes from each agent's optimal-path diagram: cardinal, semi-cardinal, non-cardinal. Cardinal conflicts are split first. A same-cost replan that reduces the conflict count is adopted as a bypass instead of growing the tree.

This is an original implementation of those published algorithms. It is not a port of any existing repository.

## Run

```bash
npm install
npm test
npm run dev
```

The dev server listens on **port 4731** (`http://localhost:4731`). `strictPort` is on, so it will not silently move.

## Tests

```bash
npm test
```

The suite checks:

- vertex conflicts, edge swaps, same-cell-different-time, following traffic, and a traveler who stays on a goal
- a small joint plan (the Exchange room) whose optimal sum of arrivals is 6
- Crosscurrent, where a cardinal crossing sits beside a non-cardinal weave and ICBS expands fewer high-level nodes than CBS
- every built-in room, where both searches return collision-free plans of equal cost

## Rooms

- **Crosscurrent** — the cardinal-versus-weave comparison
- **Exchange** — two travelers, one row to spare
- **Pocket** — a head-on meeting around shelves
- **Atrium** — three travelers and a broken column
- **Blank floor** — an empty 8×8 to paint

Editing the floor clears the previous plans. Run both searches again after a change.
