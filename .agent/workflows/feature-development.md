---
name: feature-development
description: Safe end-to-end workflow for implementing an Abyssal gameplay or UI feature.
---

# Feature Development Workflow

1. Inspect the affected code and tests on the current feature branch.
2. Route design/balance questions to Game Designer; implementation to Gameplay Developer; rendering to Asset Pipeline Specialist.
3. State the expected behavior and edge cases in a concise checklist.
4. Implement the smallest coherent change; preserve solo/online parity and server authority.
5. Add regression tests for the behavior and any discovered failure.
6. Run `npm test` on Node 20; inspect failures and changed-file diff.
7. If CI passes, open a pull request and check deployment status after merge.
8. Report limitations honestly; never claim an unverified deploy or FPS gain.
