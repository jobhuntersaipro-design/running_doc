@AGENTS.md

# Working style

Use the ponytail skill (`.claude/skills/ponytail/SKILL.md`) at full intensity for every coding task in this repo, from the first response of every session: understand the code first, then reuse what is already here, prefer the platform and installed dependencies, and ship the shortest diff that works, with one runnable check for non-trivial logic. It stays on unless someone says "stop ponytail" or "normal mode" in the session.

# UI: always Arc

Build every piece of UI from Arc (uiarc.dev) components and use them fully. For any UI change, follow the arc skill (`.claude/skills/arc/SKILL.md`): check `components.md` for the Arc item that fits each element (badge for statuses, avatar for people, toast for confirmations, hold-to-confirm or confirm-morph for risky actions, combobox or select for choices, expandable-card, comment-thread, sortable-data-table, timeline and so on), read its markdown, and use only documented props. Install missing items with `node scripts/arc-add.mjs <id>` (same as `npx shadcn@latest add @uiarc/<id>`). Never hand-build something Arc already has, and when existing UI is touched, replace hand-built parts with their Arc equivalent.
