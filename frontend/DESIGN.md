# Frontend design notes

## Product frame

Active Engineering Memory Layer is an engineering change investigation tool. Its main job is to show what an agent did, what knowledge it relied on, and why a guardrail allowed or blocked a change. The first screen is therefore a working surface, not a marketing page.

## Visual direction

The workspace is styled as a change dossier: light mineral paper, graphite text, fine dividers, and compact technical labels. It avoids decorative gradients, nested cards, ambient glow, and a generic dark “AI dashboard” treatment. Typography stays system-native for quick scanning; monospace is reserved for IDs, labels, and execution details.

- **Paper (`#f1f1eb`)** separates the graph work surface from the white ledger.
- **Graphite (`#202522`)** carries primary copy and structure.
- **Cobalt (`#2456c5`)** marks graph context, navigation, and active controls.
- **Safety orange (`#c75222`)** is reserved for guardrail and blocked states.
- Node labels use muted, related colors so category distinctions remain legible without turning every node into a bright badge.

## Screen hierarchy

1. The masthead identifies the product, active graph, and database connection.
2. The trace strip gives the three deterministic demo runs a clear, consistent entry point.
3. The activity ledger presents agent and MCP events in time order.
4. The relationship map occupies the larger work area, with node filters, counts, pan/zoom, and node inspection.
5. Decision explanation, query playground, session history, and the architecture guide remain reachable as tools.

On narrow screens, the ledger and graph stack vertically, trace names can truncate without hiding their control labels, and secondary tools move into the action menu. Graph pan/zoom and the node inspector remain available.

## Interaction and accessibility

- Scenario controls retain the `1`, `2`, and `3` shortcuts; graph reset retains `R`; `Escape` closes overlays; `?` opens the guide.
- Controls have visible keyboard focus and descriptive accessible names.
- Connection, streaming, and unavailable states use clear text and a status region.
- Reduced-motion preferences disable decorative movement.
- Guardrail traversal remains highlighted in the graph and links to the existing decision explanation.
