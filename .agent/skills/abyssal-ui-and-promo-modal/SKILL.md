---
name: abyssal-ui-and-promo-modal
description: Build accessible responsive overlays, shop dialogs, keyboard flows and promotional-code UI for Abyssal.
---

# UI Modal & Redemption Skill

## Dialog behavior
- Use an in-app overlay, not `prompt()`, browser tabs, or a new page for short user input.
- Keep focus visible; move focus to the primary input when opening and return focus to the launcher when closing.
- Support Enter to submit, Escape to close, backdrop click only when safe, and touch-sized controls.
- Use `role="dialog"`, `aria-modal="true"`, labelled inputs and `aria-live` status messages.
- Do not hide an input below an unrelated scroll region if the task requires immediate entry.

## Economy security
- Client-side `localStorage` redemption is one-time only per browser profile and is not fraud-proof. For cross-device/competitive rewards, validate and persist the code server-side.
- Do not grant rewards on malformed input or silently overwrite a prior result.
- Ensure shop wallet display updates after a successful redemption.
