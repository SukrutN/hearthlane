export type Coord = { x: number; y: number };

export type Agent = {
  name: string;
  start: Coord;
  goal: Coord;
};

export type Grid = {
  width: number;
  height: number;
  blocked: boolean[];
};

export type VertexConstraint = {
  kind: "vertex";
  agent: number;
  x: number;
  y: number;
  time: number;
};

export type EdgeConstraint = {
  kind: "edge";
  agent: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  time: number;
};

export type Constraint = VertexConstraint | EdgeConstraint;

export type VertexConflict = {
  kind: "vertex";
  a: number;
  b: number;
  x: number;
  y: number;
  time: number;
};

export type EdgeConflict = {
  kind: "edge";
  a: number;
  b: number;
  time: number;
  aFrom: Coord;
  aTo: Coord;
  bFrom: Coord;
  bTo: Coord;
};

export type Conflict = VertexConflict | EdgeConflict;

/** Boyarski et al.: how unavoidable a conflict is inside both agents' optimal-path sets. */
export type ConflictKind = "cardinal" | "semi-cardinal" | "non-cardinal";

export type Problem = {
  grid: Grid;
  agents: Agent[];
};
