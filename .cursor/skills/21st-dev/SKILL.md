---
name: 21st-dev
description: Use 21st.dev Magic MCP to generate modern UI components via /ui prompts in Cursor.
---

# When to use
Use this skill when you want to generate or iterate on **frontend UI components** quickly (buttons, navbars, forms, dashboards, landing sections) using 21st.dev Magic inside Cursor.

# Prerequisites (one-time)
- Ensure Cursor MCP is configured with the 21st.dev Magic server in `~/.cursor/mcp.json`.
- Set your 21st.dev Magic API key in that config (`mcpServers["@21st-dev/magic"].env.API_KEY`).

# How to use (in Cursor chat)
1. In the agent chat, type `/ui` followed by what you want.
2. Be specific about:
   - framework (React / Next.js / etc.)
   - styling approach (Tailwind / CSS modules / etc.)
   - responsiveness + a11y requirements
   - where to place the file(s) in the repo

Examples:
- `/ui create a modern responsive navbar with a product dropdown and mobile sheet menu`
- `/ui build a pricing section with 3 tiers, highlighted middle plan, and accessible toggle for monthly/yearly`
- `/ui refactor this form to have better validation states, disabled loading state, and keyboard focus styles`

# Output expectations
- Prefer accessible, keyboard-navigable components with visible focus styles.
- Keep components modular and reuse shared primitives when possible.
- If requirements are ambiguous, ask for missing details (stack, routing, styling, component location).
