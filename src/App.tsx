import { useEffect, useMemo, useRef, useState } from "react";
import { makespanOf, pathCost, positionAt } from "./lib/conflicts";
import { cloneScenario, scenarios, type Scenario } from "./lib/scenarios";
import { solve, validateProblem, type SolveMode, type SolveResult } from "./lib/search";
import type { Agent, Coord, Grid } from "./lib/types";

const PALETTE = ["#e23b22", "#1d4ed8", "#0f766e", "#a16207", "#7c3aed", "#be185d"];
const NAMES = ["Ada", "Bo", "Cal", "Dee", "Esme", "Finn"];

const exchange = scenarios.find((scenario) => scenario.id === "exchange");
const miniature = exchange
  ? solve({ grid: exchange.grid, agents: exchange.agents }, "icbs")
  : null;

export function App() {
  const opening = scenarios[0];
  const seeded = cloneScenario(opening);
  const [scenarioId, setScenarioId] = useState(opening.id);
  const [grid, setGrid] = useState<Grid>(seeded.grid);
  const [agents, setAgents] = useState<Agent[]>(seeded.agents);
  const [tool, setTool] = useState<"wall" | "erase" | "start" | "goal">("wall");
  const [selected, setSelected] = useState(0);
  const [cbs, setCbs] = useState<SolveResult | null>(null);
  const [icbs, setIcbs] = useState<SolveResult | null>(null);
  const [active, setActive] = useState<SolveMode>("icbs");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("The floor is set. Both searches are waiting.");
  const [busy, setBusy] = useState(false);
  const paint = useRef<{ on: boolean; place: boolean }>({ on: false, place: true });
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(680);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? opening;
  const shown = active === "cbs" ? cbs : icbs;
  const makespan = shown?.ok ? shown.makespan : 0;

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setBoardWidth(node.clientWidth));
    observer.observe(node);
    setBoardWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [grid.width, grid.height, scenarioId]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setFrame((current) => {
        if (current >= makespan) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 520);
    return () => window.clearInterval(id);
  }, [playing, makespan]);

  useEffect(() => {
    const stop = () => {
      paint.current.on = false;
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const gap = 8;
  const cell = Math.max(30, Math.min(78, Math.floor((boardWidth - gap * (grid.width - 1)) / grid.width)));
  const traveler = Math.round(cell * 0.62);

  const ghosts = useMemo(() => {
    if (!shown?.ok) return new Set<string>();
    const marks = new Set<string>();
    for (const item of shown.resolved) {
      const conflict = item.conflict;
      const at = conflict.kind === "vertex" ? conflict.time : conflict.time;
      if (at !== frame && at + (conflict.kind === "edge" ? 1 : 0) !== frame) continue;
      if (conflict.kind === "vertex") marks.add(`${conflict.x},${conflict.y}`);
      else {
        marks.add(`${conflict.aFrom.x},${conflict.aFrom.y}`);
        marks.add(`${conflict.aTo.x},${conflict.aTo.y}`);
        marks.add(`${conflict.bFrom.x},${conflict.bFrom.y}`);
        marks.add(`${conflict.bTo.x},${conflict.bTo.y}`);
      }
    }
    return marks;
  }, [shown, frame]);

  function clearRun(note?: string) {
    setCbs(null);
    setIcbs(null);
    setFrame(0);
    setPlaying(false);
    if (note) setMessage(note);
  }

  function loadScenario(next: Scenario) {
    const copy = cloneScenario(next);
    setScenarioId(next.id);
    setGrid(copy.grid);
    setAgents(copy.agents);
    setSelected(0);
    setTool("wall");
    clearRun(next.blurb);
  }

  function occupied(x: number, y: number): boolean {
    return agents.some(
      (agent) =>
        (agent.start.x === x && agent.start.y === y) || (agent.goal.x === x && agent.goal.y === y),
    );
  }

  function paintCell(x: number, y: number, placeWall: boolean) {
    if (occupied(x, y)) {
      setMessage("A traveler is using that square.");
      return;
    }
    const index = y * grid.width + x;
    if (grid.blocked[index] === placeWall) return;
    const blocked = grid.blocked.slice();
    blocked[index] = placeWall;
    setGrid({ ...grid, blocked });
    clearRun("The room changed. Run the searches again.");
  }

  function placeRole(x: number, y: number) {
    if (grid.blocked[y * grid.width + x]) {
      setMessage("That square is a wall.");
      return;
    }
    const next = agents.map((agent) => ({ ...agent, start: { ...agent.start }, goal: { ...agent.goal } }));
    const agent = next[selected];
    if (!agent) return;
    const target = tool === "start" ? "start" : "goal";
    const clash = next.some((other, index) => {
      if (index === selected) return false;
      return (
        (other.start.x === x && other.start.y === y) || (other.goal.x === x && other.goal.y === y)
      );
    });
    if (clash) {
      setMessage("Travelers need their own starts and their own goals.");
      return;
    }
    agent[target] = { x, y };
    setAgents(next);
    clearRun(`${agent.name}'s ${target} moved.`);
  }

  function onCellDown(x: number, y: number) {
    if (tool === "wall" || tool === "erase") {
      paint.current = { on: true, place: tool === "wall" };
      paintCell(x, y, tool === "wall");
      return;
    }
    placeRole(x, y);
  }

  function onCellEnter(x: number, y: number) {
    if (!paint.current.on) return;
    if (tool !== "wall" && tool !== "erase") return;
    paintCell(x, y, paint.current.place);
  }

  function addAgent() {
    if (agents.length >= NAMES.length) {
      setMessage("Six travelers is the room's limit.");
      return;
    }
    const free: Coord[] = [];
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        if (grid.blocked[y * grid.width + x]) continue;
        if (occupied(x, y)) continue;
        free.push({ x, y });
      }
    }
    if (free.length < 2) {
      setMessage("Not enough open squares for another traveler.");
      return;
    }
    const start = free[0];
    const goal = free[free.length - 1];
    const name = NAMES[agents.length] ?? `Traveler ${agents.length + 1}`;
    setAgents([...agents, { name, start, goal }]);
    setSelected(agents.length);
    clearRun(`${name} joined the floor.`);
  }

  function removeAgent() {
    if (agents.length <= 1) {
      setMessage("Keep at least one traveler.");
      return;
    }
    const removed = agents[selected]?.name ?? "A traveler";
    const next = agents.filter((_, index) => index !== selected);
    setAgents(next);
    setSelected(Math.max(0, selected - 1));
    clearRun(`${removed} left the floor.`);
  }

  async function run(mode: SolveMode | "both") {
    const problem = { grid, agents };
    const issue = validateProblem(problem);
    if (issue) {
      setMessage(issue);
      return;
    }
    setBusy(true);
    setPlaying(false);
    setMessage(mode === "both" ? "CBS and ICBS are searching." : mode === "cbs" ? "CBS is searching." : "ICBS is searching.");
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    const nextCbs = mode === "icbs" ? cbs : solve(problem, "cbs");
    const nextIcbs = mode === "cbs" ? icbs : solve(problem, "icbs");
    if (mode !== "icbs") setCbs(nextCbs);
    if (mode !== "cbs") setIcbs(nextIcbs);
    const focus: SolveMode = mode === "cbs" ? "cbs" : "icbs";
    setActive(focus);
    setFrame(0);
    const focused = focus === "cbs" ? nextCbs : nextIcbs;
    const other = focus === "cbs" ? nextIcbs : nextCbs;
    if (focused && focused.ok) setPlaying(true);
    if (focused?.ok && other?.ok && mode === "both") {
      const same = focused.cost === other.cost;
      setMessage(
        same
          ? `Both plans are collision-free. Sum of arrivals is ${focused.cost}.`
          : "The searches returned different costs — that should not happen on these maps.",
      );
    } else if (focused?.ok) {
      setMessage(`${focus === "cbs" ? "CBS" : "ICBS"} found a collision-free plan. Cost ${focused.cost}.`);
    } else {
      setMessage(focused?.reason ?? "No plan.");
    }
    setBusy(false);
  }

  function togglePlay() {
    if (!shown?.ok) return;
    if (frame >= makespan) {
      setFrame(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  }

  const liveConflict = shown?.resolved.find((item) => {
    const time = item.conflict.time;
    return time === frame || (item.conflict.kind === "edge" && time + 1 === frame);
  });

  return (
    <>
      <header className="mast">
        <a className="wordmark" href="#top">
          Hearthline
        </a>
        <nav>
          <a href="#purpose">Purpose</a>
          <a href="#floor">The floor</a>
          <a href="#compare">Compare</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="blob blob-a" aria-hidden="true" />
          <div className="blob blob-b" aria-hidden="true" />
          <div className="blob blob-c" aria-hidden="true" />
          <p className="eyebrow">01 — A floor, a clock, a shared plan</p>
          <h1>
            Many travelers.
            <br />
            One shared minute.
          </h1>
          <p className="lede">
            A private shortcut is not a plan. Hearthline searches for routes that arrive together
            without two bodies on one square, or two bodies trading places through the same edge.
          </p>
          <div className="hero-row">
            <Miniature />
            <p className="hero-note">
              Exchange, looping. One traveler takes the long way over the top so the other can keep
              the straight line. The sum of their arrivals is optimal.
            </p>
            <a className="down" href="#floor">
              Step onto the floor
            </a>
          </div>
          <div className="ticker" aria-hidden="true">
            <div className="ticker-track">
              <span>vertex conflict · edge swap · a legal wait · cardinal · semi-cardinal · non-cardinal · bypass · sum of arrivals · </span>
              <span>vertex conflict · edge swap · a legal wait · cardinal · semi-cardinal · non-cardinal · bypass · sum of arrivals · </span>
            </div>
          </div>
        </section>

        <section className="purpose" id="purpose">
          <p className="index">02</p>
          <div className="purpose-copy">
            <h2>The minute is the thing they share.</h2>
            <p>
              Each traveler has a start, a goal, and the same clock. Movement is four-way. Waiting
              costs a minute, the same as a step. After arrival, a traveler stays — the goal is
              occupied from that minute on, so nobody else may treat it as a hallway.
            </p>
            <p>
              Two failures end a plan. A vertex conflict is two travelers on one cell at one minute.
              An edge conflict is a swap: they pass through each other between one minute and the
              next. Following someone down a corridor is allowed. Cutting a corner is not.
            </p>
            <blockquote>
              Optimal here means the smallest sum of arrival times, not the smallest number of
              clicks, and not a pretty animation that still collides.
            </blockquote>
            <p>
              Conflict-Based Search keeps a tree of promises. At the root, everyone plans alone with
              space-time A*. If those routes collide, the search picks a conflict and branches. One
              child forbids the first traveler from using that cell or edge at that minute. The other
              child forbids the second. Only the affected traveler replans. The first conflict-free
              node, taken in order of cost, is an optimal joint plan.
            </p>
            <p>
              Improved CBS asks which conflict is worth a branch. A conflict is cardinal when every
              optimal route for both travelers uses it, semi-cardinal when only one of them is
              trapped, and non-cardinal when both could slip past at the same cost. Cardinal
              conflicts are split first. When a same-cost detour actually reduces the number of
              clashes, ICBS adopts that bypass and does not grow the tree.
            </p>
          </div>
        </section>

        <section className="floor" id="floor">
          <div className="floor-head">
            <p className="index light">03 — The floor</p>
            <h2>Paint the room, then let both searches take it.</h2>
          </div>

          <div className="scenario-row" role="list">
            {scenarios.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={item.id === scenarioId ? "scenario is-on" : "scenario"}
                data-testid={`scenario-${item.id}`}
                onClick={() => loadScenario(item)}
              >
                <span>0{index + 1}</span>
                <strong>{item.name}</strong>
                <em>{item.kicker}</em>
              </button>
            ))}
          </div>

          <div className="tool-row">
            <div className="tools" role="radiogroup" aria-label="Edit the floor">
              {(
                [
                  ["wall", "Raise a wall"],
                  ["erase", "Lower a wall"],
                  ["start", "Move a start"],
                  ["goal", "Move a goal"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={tool === id}
                  className={tool === id ? "tool is-on" : "tool"}
                  data-testid={`tool-${id}`}
                  onClick={() => setTool(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="roster">
              {agents.map((agent, index) => (
                <button
                  key={`${agent.name}-${index}`}
                  type="button"
                  className={index === selected ? "chip is-on" : "chip"}
                  style={{ ["--swatch" as string]: PALETTE[index % PALETTE.length] }}
                  onClick={() => setSelected(index)}
                >
                  {agent.name}
                </button>
              ))}
              <button type="button" className="chip ghost-chip" onClick={addAgent}>
                Add
              </button>
              <button type="button" className="chip ghost-chip" onClick={removeAgent}>
                Remove
              </button>
            </div>
          </div>

          <div className="stage-wrap">
            <aside className="slip">
              <p>{scenario.kicker}</p>
              <h3>{scenario.name}</h3>
              <p>{scenario.blurb}</p>
            </aside>
            <div
              className="board"
              ref={boardRef}
              data-minute={frame}
              style={{ ["--cell" as string]: `${cell}px`, ["--gap" as string]: `${gap}px` }}
            >
              <div
                className="cells"
                style={{
                  gridTemplateColumns: `repeat(${grid.width}, ${cell}px)`,
                  width: grid.width * cell + (grid.width - 1) * gap,
                }}
              >
                {grid.blocked.map((wall, index) => {
                  const x = index % grid.width;
                  const y = Math.floor(index / grid.width);
                  const ghost = ghosts.has(`${x},${y}`);
                  return (
                    <button
                      key={index}
                      type="button"
                      className={wall ? "cell wall" : ghost ? "cell ghost" : "cell"}
                      data-testid={`cell-${x}-${y}`}
                      aria-pressed={wall}
                      aria-label={wall ? `Wall at ${x}, ${y}` : `Open square ${x}, ${y}`}
                      onPointerDown={() => onCellDown(x, y)}
                      onPointerEnter={() => onCellEnter(x, y)}
                    />
                  );
                })}
              </div>
              {shown?.ok &&
                shown.paths.map((path, index) =>
                  path.map((spot, time) => (
                    <span
                      key={`trail-${index}-${time}`}
                      className="trail"
                      style={{
                        width: 8,
                        height: 8,
                        transform: `translate(${spot.x * (cell + gap) + cell / 2 - 4}px, ${spot.y * (cell + gap) + cell / 2 - 4}px)`,
                        background: PALETTE[index % PALETTE.length],
                      }}
                    />
                  )),
                )}
              {agents.map((agent, index) => {
                const goalLeft = agent.goal.x * (cell + gap) + (cell - traveler) / 2;
                const goalTop = agent.goal.y * (cell + gap) + (cell - traveler) / 2;
                return (
                  <span
                    key={`goal-${index}`}
                    className="goal"
                    style={{
                      width: traveler,
                      height: traveler,
                      transform: `translate(${goalLeft}px, ${goalTop}px)`,
                      borderColor: PALETTE[index % PALETTE.length],
                    }}
                  />
                );
              })}
              {agents.map((agent, index) => {
                const spot =
                  shown?.ok && shown.paths[index] ? positionAt(shown.paths[index], frame) : agent.start;
                const left = spot.x * (cell + gap) + (cell - traveler) / 2;
                const top = spot.y * (cell + gap) + (cell - traveler) / 2;
                return (
                  <span
                    key={`body-${agent.name}-${index}`}
                    className={index === selected ? "body is-selected" : "body"}
                    style={{
                      width: traveler,
                      height: traveler,
                      transform: `translate(${left}px, ${top}px)`,
                      background: PALETTE[index % PALETTE.length],
                    }}
                  >
                    {agent.name.slice(0, 1)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="transport">
            <div className="runs">
              <button type="button" data-testid="run-cbs" disabled={busy} onClick={() => void run("cbs")}>
                Run CBS
              </button>
              <button type="button" data-testid="run-icbs" disabled={busy} onClick={() => void run("icbs")}>
                Run ICBS
              </button>
              <button type="button" className="primary" data-testid="run-both" disabled={busy} onClick={() => void run("both")}>
                {busy ? "Searching" : "Run both"}
              </button>
            </div>
            <div className="clock">
              <button type="button" data-testid="step-prev" onClick={() => { setPlaying(false); setFrame((value) => Math.max(0, value - 1)); }}>
                Back
              </button>
              <button type="button" data-testid="play-toggle" onClick={togglePlay}>
                {playing ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                data-testid="step-next"
                onClick={() => {
                  setPlaying(false);
                  setFrame((value) => Math.min(makespan, value + 1));
                }}
              >
                Step
              </button>
              <p data-testid="minute-label">
                Minute {frame}
                {shown?.ok ? ` of ${makespan}` : ""}
              </p>
            </div>
            <div className="watch">
              <button type="button" className={active === "cbs" ? "is-on" : ""} onClick={() => { setActive("cbs"); setFrame(0); setPlaying(false); }}>
                Watch CBS
              </button>
              <button type="button" className={active === "icbs" ? "is-on" : ""} onClick={() => { setActive("icbs"); setFrame(0); setPlaying(false); }}>
                Watch ICBS
              </button>
            </div>
          </div>
          <p className="status" data-testid="plan-note" role="status">
            {message}
          </p>
          {liveConflict && (
            <p className="callout" data-testid="conflict-callout">
              {liveConflict.bypassed ? "Bypassed" : "Split"}
              {liveConflict.kind ? ` · ${liveConflict.kind}` : ""} — {describeConflict(liveConflict.conflict, agents.map((agent) => agent.name))}
            </p>
          )}
          {shown?.ok && (
            <p className="arrivals">
              {agents.map((agent, index) => (
                <span key={`${agent.name}-${index}`}>
                  {agent.name} {shown.paths[index] ? pathCost(shown.paths[index]) : "–"}
                </span>
              ))}
              <span>sum {shown.cost}</span>
            </p>
          )}
        </section>

        <section className="compare" id="compare">
          <p className="index">04</p>
          <h2>The same optimum, a different amount of looking.</h2>
          <p className="compare-lead">
            Both searches are optimal when they finish. The difference is how much of the constraint
            tree they open, and how many space-time nodes the low level expands along the way.
          </p>
          <div className="metrics">
            <Metric label="High-level nodes" hint="Constraint-tree nodes expanded" cbs={cbs?.highLevelExpanded} icbs={icbs?.highLevelExpanded} />
            <Metric label="Low-level expansions" hint="Space-time A* nodes popped" cbs={cbs?.lowLevelExpansions} icbs={icbs?.lowLevelExpansions} />
            <Metric label="Solution cost" hint="Sum of arrival times" cbs={cbs?.ok ? cbs.cost : undefined} icbs={icbs?.ok ? icbs.cost : undefined} />
            <Metric label="Runtime" hint="This browser, this room" cbs={cbs ? formatMs(cbs.runtimeMs) : undefined} icbs={icbs ? formatMs(icbs.runtimeMs) : undefined} />
          </div>
          {cbs?.ok && icbs?.ok && (
            <p className="verdict" data-testid="verdict">
              {icbs.highLevelExpanded < cbs.highLevelExpanded
                ? `ICBS expanded ${cbs.highLevelExpanded - icbs.highLevelExpanded} fewer high-level nodes. Cardinal conflicts went first${icbs.bypasses ? `, and ${icbs.bypasses} bypass${icbs.bypasses === 1 ? "" : "es"} avoided a branch` : ""}.`
                : icbs.highLevelExpanded === cbs.highLevelExpanded
                  ? "On this room the two trees were the same size. The costs still match."
                  : "CBS expanded fewer high-level nodes on this particular room. The costs still match."}
            </p>
          )}
        </section>

        <section className="untangled" id="untangled">
          <p className="index">05</p>
          <h2>What the search had to untie.</h2>
          <div className="traces">
            <Trace title="CBS" result={cbs} names={agents.map((agent) => agent.name)} />
            <Trace title="ICBS" result={icbs} names={agents.map((agent) => agent.name)} />
          </div>
        </section>
      </main>

      <footer className="colophon">
        <p>
          Hearthline implements Conflict-Based Search after Sharon, Stern, Felner, and Sturtevant, and
          Improved CBS after Boyarski et al.: cardinal, semi-cardinal, and non-cardinal conflicts,
          cardinal splits first, and the bypass. Four-connected grids, unit costs, waits allowed.
        </p>
        <p>An original studio. No maps, names, or pictures were borrowed.</p>
      </footer>
    </>
  );
}

function Metric({
  label,
  hint,
  cbs,
  icbs,
}: {
  label: string;
  hint: string;
  cbs: number | string | undefined;
  icbs: number | string | undefined;
}) {
  const slug = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <article className="metric">
      <h3>{label}</h3>
      <p>{hint}</p>
      <div className="metric-nums">
        <p>
          <span>CBS</span>
          <strong data-testid={`cbs-${slug}`}>{cbs ?? "–"}</strong>
        </p>
        <p>
          <span>ICBS</span>
          <strong data-testid={`icbs-${slug}`}>{icbs ?? "–"}</strong>
        </p>
      </div>
    </article>
  );
}

function Trace({
  title,
  result,
  names,
}: {
  title: string;
  result: SolveResult | null;
  names: string[];
}) {
  return (
    <div>
      <h3>{title}</h3>
      {!result && <p className="quiet">Not run yet.</p>}
      {result && !result.ok && <p className="quiet">{result.reason}</p>}
      {result?.ok && result.resolved.length === 0 && <p className="quiet">No conflicts. The independent routes already agreed.</p>}
      {result?.ok && result.resolved.length > 0 && (
        <ol>
          {result.resolved.map((item, index) => (
            <li key={`${title}-${index}`}>
              <em>{item.bypassed ? "Bypass" : "Split"}</em>
              {item.kind && <em>{item.kind}</em>}
              <span>{describeConflict(item.conflict, names)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function describeConflict(conflict: SolveResult["resolved"][number]["conflict"], names: string[]): string {
  const left = names[conflict.a] ?? "A";
  const right = names[conflict.b] ?? "B";
  if (conflict.kind === "vertex") {
    return `${left} and ${right} both wanted (${conflict.x}, ${conflict.y}) at minute ${conflict.time}.`;
  }
  return `${left} and ${right} swapped edges at minute ${conflict.time}.`;
}

function Miniature() {
  const [frame, setFrame] = useState(0);
  const span = miniature?.ok ? makespanOf(miniature.paths) : 0;
  useEffect(() => {
    if (!miniature?.ok) return;
    const id = window.setInterval(() => {
      setFrame((current) => (current >= span ? 0 : current + 1));
    }, 700);
    return () => window.clearInterval(id);
  }, [span]);
  if (!miniature?.ok || !exchange) return null;
  const cell = 28;
  const gap = 6;
  return (
    <div className="mini" aria-hidden="true">
      {Array.from({ length: exchange.grid.width * exchange.grid.height }, (_, index) => {
        const x = index % exchange.grid.width;
        const y = Math.floor(index / exchange.grid.width);
        return (
          <span
            key={index}
            className="mini-cell"
            style={{ width: cell, height: cell, transform: `translate(${x * (cell + gap)}px, ${y * (cell + gap)}px)` }}
          />
        );
      })}
      {miniature.paths.map((path, index) => {
        const spot = positionAt(path, frame);
        return (
          <span
            key={index}
            className="mini-body"
            style={{
              background: PALETTE[index],
              transform: `translate(${spot.x * (cell + gap) + 4}px, ${spot.y * (cell + gap) + 4}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}
