# Frontend design notes

## Product frame

Active Engineering Memory Layer is an engineering change investigation tool. It shows what an agent did, what context it queried, and why a guardrail permitted or stopped a code change. The interface opens directly into the working surface.

## Visual direction

The workspace is styled like an engineering dossier with light mineral paper, dark graphite text, thin dividers, and compact technical labels. It avoids gradients, glow effects, card nesting, and a dark "AI dashboard" look. System fonts handle readability at small sizes, while monospace fonts are kept for IDs, labels, and code execution details.

The color palette uses paper (`#f1f1eb`) for the graph surface, graphite (`#202522`) for primary copy, cobalt (`#2456c5`) for graph controls and navigation, and orange (`#c75222`) for blocked states and guardrail alerts. Node labels use muted tones so categories stay readable without turning every node into a bright badge.

## Screen hierarchy

1. The masthead identifies the product, active tenant graph, and database connection.
2. The trace strip provides entry points for the three deterministic demo runs.
3. The activity ledger lists agent and MCP events in chronological order.
4. The relationship map provides the main work area, with node filtering, counts, pan/zoom, and node inspection.
5. The decision drawer, query playground, session history, and architecture guide sit in secondary menus and drawers.

On narrow viewports, the ledger and graph stack vertically, trace titles can truncate while preserving control labels, and secondary tools tuck into the action menu. Graph pan/zoom and node inspection remain accessible.

## Interaction and accessibility

- Scenario runs keep the `1`, `2`, and `3` shortcuts. Graph reset uses `R`, `Escape` closes modals, and `?` opens the shortcut guide.
- Controls include visible focus rings and accessible labels.
- Connection, streaming, and error states display plain text status indicators.
- Respects `prefers-reduced-motion` by disabling non-essential transitions.
- Guardrail paths highlight directly in the graph canvas and link to the decision breakdown drawer.
