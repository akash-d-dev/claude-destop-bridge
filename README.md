# Claude Desktop Bridge

A local bridge that lets you send prompts from your phone browser to Claude Desktop on your Mac, receive done notifications, and optionally watch a live view of your Mac screen/Claude window.

## Features implemented

- Send prompts from web UI to Claude Desktop using AppleScript.
- Push done notifications to `ntfy.sh` (`notification-only` mode; no inbound ntfy listener).
- Centralized command system with UI command picker.
- Built-in commands:
  - `#new` -> opens a new Claude chat (`Cmd + Shift + O`).
  - `#stop` -> sends `Esc` to stop the current Claude response.
  - `#clear` -> clears the active Claude input box (`Cmd + A`, then `Delete`).
- Live View streaming in UI:
  - Start/stop live stream.
  - Fullscreen stream view.
  - Select a specific window to stream.
  - Select a specific display/monitor to stream.
  - Automatic fallback chain if capture target fails.
- Passcode-protected access:
  - Login overlay in UI.
  - Secure `HttpOnly` session cookie.
  - Session bound to `User-Agent`.
  - Configurable access TTL (default 24 hours).
- Session persistence across server restarts via `.data/sessions.json`.
- Single in-flight message processing guard to avoid concurrent prompt collisions.

## Capture fallback behavior

Live frame capture attempts targets in this order:

1. Selected window (if chosen)
2. Claude window auto-detection
3. Selected display (if chosen)
4. Full-screen fallback

## Requirements

- macOS with Claude Desktop installed.
- Node.js `18+` (native `fetch` is required).
- Terminal app (or Node runtime host) with **Accessibility** permission.
- Terminal app (or Node runtime host) with **Screen Recording** permission for streaming.
- `swift` available (used for robust window/display listing scripts).

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create local env file:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` values, especially:
   - `PASSCODE`
   - `NTFY_TOPIC`

4. Start server:
   ```bash
   node server.js
   ```

5. Open UI:
   - Local: `http://localhost:3456`
   - Remote phone access (example): `http://<mac-tailscale-ip>:3456`

6. Unlock with passcode in UI, then send prompts/commands.

## Environment variables

- `PORT`: HTTP server port.
- `NTFY_TOPIC`: Topic used for done notifications.
- `DONE_DELAY_MS`: Fixed delay before marking prompt as done and notifying.
- `STREAM_INTERVAL_MS`: Frame refresh interval for live stream capture.
- `PASSCODE`: Required passcode for device access.
- `ACCESS_TTL_HOURS`: Session validity duration.
- `SESSION_STORE_DIR`: Directory for persisted sessions.
- `SESSION_STORE_FILE`: Session store filename.
- `POLL_INTERVAL_MS`: Legacy value kept for compatibility.
- `MAX_WAIT_MS`: Legacy value kept for compatibility.

## UI usage

- **Send prompt:** Type text and click `Send to Mac`.
- **Send command quickly:** Pick command from dropdown and click `Send Command`.
  - Optional typed text is appended after the command.
- **Live view:** Start/stop stream, optionally select window/display, and use fullscreen.

## API surface (high-level)

- Auth:
  - `GET /auth/status`
  - `POST /auth/login`
  - `POST /auth/logout`
- Messaging:
  - `POST /send`
  - `GET /config`
- Stream:
  - `GET /stream/status`
  - `POST /stream/start`
  - `POST /stream/stop`
  - `GET /stream/frame`
  - `GET /stream/windows`
  - `POST /stream/select-window`
  - `GET /stream/displays`
  - `POST /stream/select-display`

## Project structure

- `server.js`: Main server, command handling, message flow, ntfy notifications.
- `public/index.html`: Full frontend UI (auth, message send, command picker, live view).
- `auth/`: Passcode auth, middleware, cookie/session handling, disk persistence.
- `stream/`: Frame capture service and stream API routes.
- `scripts/`: AppleScript/Swift automation helpers for Claude, windows, displays.

## Notes and limitations

- Claude Desktop must already be running.
- Message completion uses a fixed delay (`DONE_DELAY_MS`) instead of dynamic UI detection.
- Only one message/command is processed at a time.
- If no windows are detected, grant Screen Recording permission and refresh window list.
