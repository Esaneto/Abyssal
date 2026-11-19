# Abyssal: repository engineering instructions

## Mandatory cleanup with every update

- When a feature replaces an older implementation, remove the superseded implementation in the same change. Hiding an obsolete UI or disabling a route is not a substitute for removal.
- Trace references before deletion across production HTML, CSS, JavaScript, server, imports, listeners, timers, assets, dependencies, service-worker precache, Android/desktop packaging and tests. Remove unused code, redundant rules and obsolete assets, along with their references.
- Preserve live Solo and cooperative features, shared dependencies, data migrations, server authority and compatibility contracts still in use. Do not delete player data or secrets as part of code cleanup.
- Retire tests for intentionally deleted behavior only; retain regression coverage of active features and add an absence check when appropriate.
- Review the diff, run syntax checks and relevant tests (including mobile/desktop and Solo/Online where affected), and verify that the production build does not include retired components.
- Every completion report must identify what was deleted, what obsolete-looking code was retained and why, and whether tests/build/deployment have actually passed. Do not claim measured performance gains without evidence.

Follow the existing engineering guidance in .agent/rules/GEMINI.md and .agent/workflows/feature-development.md.

- UI cleanup is not complete until the actual rendered UI passes browser visual regression checks: measure its geometry, interaction hit targets, and capture screenshots before assertions so failures are inspectable. A unit-test pass alone is insufficient. Do not remove or rewrite combined CSS selectors without checking the retained selector targets the real DOM.

## Mandatory deep-menu agent framework
- Before starting any task, read AGENT_FRAMEWORK.md and docs/DEEP_MENU_ARCHITECTURE.md. They define the approved one-menu 2.5D cockpit, capsule anatomy and hatch cutscene. The older exterior navigation is retained only as a compatibility bridge, not a second default menu.
- Every coding agent must record design changes, actual tests, screenshots, removals/retentions, unfinished items and rollback in AGENT_HANDOFF.md or in a dated handoff section of its PR.
- Do not merge a visual redesign without real desktop/mobile screenshots and explicit visual acceptance. A procedural implementation must never be represented as finished photorealistic art.
