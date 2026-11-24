# Security notes: hearthlane

What the traffic planner enforces, what it leaves out, and how to place it.
Read alongside the
[OpenAPI specification](engine/api/src/main/resources/openapi.yaml).

## What this is

A multi-agent route planner with an HTTP face, a workbench page, and a VDA
5050 adapter. It plans fictional floors; it stores nothing, keeps no
accounts, and collects no personal data. The threat model is an operator's
machine or a closed lab network. The public internet is out of scope.

## What is enforced

- **A bearer-token gate** (`HEARTH_TOKEN`). When set, every route except
  `/health`, `/ready`, `/metrics`, and the workbench page answers 401
  without `Authorization: Bearer …`. The comparison is constant-time. The
  workbench asks for the token on the first refusal and keeps it in
  `sessionStorage` for the tab's life only.
- **A per-client rate limit** (`HEARTH_RATE_LIMIT`, default 600 requests per
  minute), refusals carrying `Retry-After` and counted as
  `hearth_refusals_total` on the metrics page.
- **A request body cap** (`HEARTH_MAX_BODY`, default 1 MiB), refused before
  the body is read and enforced again at the socket.
- **Strict request shapes.** Unknown JSON fields are refused by name. Plan
  documents, window asks, drift observations, and VDA 5050 order frames all
  carry field whitelists; observations standing on rack are refused in
  words.
- **Escaped output everywhere.** Every engine-derived string in the
  workbench passes through an HTML escaper; a hostile floor document cannot
  inject markup.
- **Read-only fixtures.** Floors load from the classpath; no route writes.

## What it leaves out

- **No per-user identity.** One shared token; the planner cannot tell two
  holders apart.
- **No audit trail.** Structured request logs carry method, route, status,
  and latency, never who.
- **No TLS termination.** Front the jar with a real gateway if it leaves
  the loopback.
- **No fleet connection.** The planner answers window asks; it never dials
  a robot, and the VDA 5050 adapter translates the ask rather than opening
  a channel to vehicles.

## Deployment guidance

Default bind is loopback with the gate off. For anything wider: set
`HEARTH_TOKEN`, terminate TLS at a gateway, scrape `/metrics` from inside.
The Docker image and `compose.yaml` carry the same knobs.

## Fixture provenance

The published floors carry a checksum manifest (`engine/fixtures/MANIFEST`,
`sha256sum -c` format), verified by CI on every push. Regenerate over the
committed bytes, not the checked-out files, because line-ending conversion
differs by platform: `git cat-file -p HEAD:<fixture> | sha256sum` is the
portable way, and the diff review is the checkpoint.

## Reporting

Open an issue in this repository. This is a portfolio project. These notes
describe the posture; they certify nothing.
