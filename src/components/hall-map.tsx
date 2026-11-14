import { CASTING_HALL, paintFloor, type FloorDocument, type FloorTask } from "@/lib/fixture"

const UNIT = 40

/** The painted hall: warm bands for corridors, deeper paper for aisles, rack hatched. */
export function HallMap({
  document = CASTING_HALL,
  tasks = CASTING_HALL.tasks,
}: {
  document?: FloorDocument
  tasks?: FloorTask[]
}) {
  const grid = paintFloor(document)
  const width = document.floor.width * UNIT
  const height = document.floor.height * UNIT

  const cells: React.ReactNode[] = []
  for (let row = 0; row < document.floor.height; row++) {
    for (let col = 0; col < document.floor.width; col++) {
      const region = grid[row][col]
      const x = col * UNIT
      const y = row * UNIT
      if (region === null) {
        cells.push(
          <rect
            key={`rack-${row}-${col}`}
            x={x + 3}
            y={y + 3}
            width={UNIT - 6}
            height={UNIT - 6}
            fill="none"
            stroke="#cfc8b4"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />,
        )
      } else {
        const isCorridor = region.includes("Run") || region === "Dispatch Apron"
        cells.push(
          <rect
            key={`open-${row}-${col}`}
            x={x + 2}
            y={y + 2}
            width={UNIT - 4}
            height={UNIT - 4}
            fill={isCorridor ? "#e4ddca" : "#d6cfba"}
          />,
        )
      }
    }
  }

  const taskById = new Map(document.tasks.map((task) => [task.id, task]))
  const markers: React.ReactNode[] = tasks.map((task) => {
    const [startRow, startCol] = task.start
    const [goalRow, goalCol] = task.goal
    const label = taskById.get(task.id)?.amr ?? task.amr
    return (
      <g key={task.id}>
        <circle
          cx={startCol * UNIT + UNIT / 2}
          cy={startRow * UNIT + UNIT / 2}
          r={9}
          fill="#22262c"
        />
        <rect
          x={goalCol * UNIT + UNIT / 2 - 8}
          y={goalRow * UNIT + UNIT / 2 - 8}
          width={16}
          height={16}
          fill="#c2620e"
        />
        <text
          x={startCol * UNIT + UNIT / 2}
          y={startRow * UNIT - 6}
          textAnchor="middle"
          className="fill-[#22262c]"
          fontSize="13"
          fontFamily="var(--font-mono-plex), monospace"
        >
          {label}
        </text>
      </g>
    )
  })

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`The painted ${document.floor.name}: corridors, aisles, and six tasks`}
      >
        {cells}
        {markers}
      </svg>
      <figcaption className="mt-3 flex flex-wrap justify-between gap-3 font-mono text-[10px] tracking-[0.14em] text-silver uppercase">
        <span>
          <span className="mr-1 inline-block size-2 rounded-full bg-[#22262c] align-middle" />
          Start
        </span>
        <span>Three runs · four aisles · one apron</span>
        <span>
          <span className="mr-1 inline-block size-2 bg-signal align-middle" />
          Goal
        </span>
      </figcaption>
    </figure>
  )
}
