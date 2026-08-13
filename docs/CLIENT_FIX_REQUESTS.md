# Client fix requests (Notion)

**This is the source of truth for client-requested product fixes and changes.**

Client: **Ammar**  
Owner: **Mikhail** (and coding agents working on Backfire)

## Board

- Hub page: https://app.notion.com/p/Backfire-3ba15c9fd00080a5a64ce60984557a4d
- Kanban (use this): https://app.notion.com/p/3ba15c9fd0008138b525d6beeebb72e7
- Workspace: Mikhail Speaks’s Space
- Notion connection (agent API): `Backfire Agent`
- Local agent secrets/IDs (not in git): `~/.config/backfire/notion.env` and `~/.config/backfire/notion_token`

## How it works

Kanban columns:

1. **Requested** — Ammar (or anyone) adds a card
2. **In Progress** — Mikhail/agent is working it
3. **Deployed** — shipped

Each card is **only the full change description** (paste Ammar’s message as-is). No extra fields required.

### Ammar

1. Open the kanban board
2. Click **+ New** under **Requested**
3. Paste the full description of the change
4. Save

### Mikhail / agent

1. Read cards in **Requested**
2. Drag to **In Progress** while implementing
3. Drag to **Deployed** when live

## Agent notes

- Prefer this board over chat archaeology when deciding what client fixes are outstanding.
- Do not commit Notion tokens. Use `~/.config/backfire/notion_token`.
- IDs also live in `~/.config/backfire/notion.env` (`NOTION_PAGE_ID`, `NOTION_DATABASE_ID`, `NOTION_BOARD_URL`).
