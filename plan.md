# Claude Bridge — Development Plan

Based on the initial project plan, here is the phased approach for developing the Claude Desktop Bridge. We will update this file as we progress through the phases.

## Phase 1: Project Setup & Basic Server
- [x] Initialize Node.js project (`package.json`)
- [x] Install dependencies (`express`, `node-fetch`)
- [x] Create basic `server.js` with Express
- [x] Setup static file serving for the `public/` directory
- [x] Create a placeholder `public/index.html`
- [x] Test that the server runs and serves the HTML page on `http://localhost:3456`

## Phase 2: AppleScript Automation
- [x] Create `scripts/type_message.applescript` to activate Claude Desktop and type a message
- [x] Create `scripts/is_claude_done.applescript` to detect if Claude is generating a response (by checking for the Stop/Cancel button)
- [x] Test AppleScripts manually from the terminal to ensure they correctly interact with the Claude Desktop app

## Phase 3: Web UI
- [x] Update `public/index.html` with a full-page textarea and a "Send" button
- [x] Add basic CSS for a clean, mobile-friendly layout
- [x] Add JavaScript to handle form submission via `fetch` POST to `/send`
- [x] Implement UI status updates ("Sending...", "Sent! Waiting for Claude...", "Done")
- [x] Connect to `ntfy.sh` via EventSource (SSE) to receive done notifications

## Phase 4: Integration & Notification
- [x] Update `server.js` to handle POST `/send` with the message payload
- [x] Integrate `child_process.exec` in `server.js` to call `type_message.applescript`
- [x] Implement polling in `server.js` using `is_claude_done.applescript` to wait for completion
- [x] Add POST request to `ntfy.sh` in `server.js` to send push notifications when Claude is done
- [x] Handle concurrent requests (reject new messages if one is currently processing)

## Phase 5: Testing & Refinement
- [x] End-to-end testing (Phone -> Mac -> Claude -> Phone notification)
- [x] Ensure Mac accessibility permissions are properly documented and handled gracefully
- [x] Refine AppleScripts if UI elements in Claude Desktop change or differ
- [x] Finalize README.md with setup instructions
