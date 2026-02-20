# Claude Desktop Bridge

A lightweight local server and web UI that bridges a phone browser to Claude Desktop running on a Mac. This allows you to use your Mac's MCP tools from your phone.

## How it works

1. You type a message in a simple web UI on your phone.
2. The web UI sends the message to a local Node.js server running on your Mac.
3. The server uses AppleScript to activate Claude Desktop and simulate typing your message.
4. The server polls until Claude finishes generating the response.
5. You receive a push notification on your phone via ntfy.sh.
6. You can open the Claude mobile app to read the synced response.

## Prerequisites

- **Tailscale**: Installed on both your Mac and phone, connected to the same Tailscale network.
- **Node.js**: Installed on your Mac.
- **Claude Desktop**: Installed and running on your Mac.

## Setup Instructions

1. Clone this repository and run `npm install`:
   ```bash
   git clone <repo-url>
   cd claude-desktop-bridge
   npm install
   ```

2. Copy `.env.example` to `.env` and fill out your unique topics:
   ```bash
   cp .env.example .env
   ```

3. On your Mac, grant accessibility permissions to Terminal/Node:
   - Go to System Settings → Privacy & Security → Accessibility.
   - Add/enable Terminal (or whatever terminal app you are using to run the server). This is required for AppleScript to simulate keystrokes.

4. Start the server:
   ```bash
   node server.js
   ```

5. On your phone browser, subscribe to your `NTFY_TOPIC` or enable notifications via the web UI at `https://ntfy.sh/<NTFY_TOPIC>`.

6. On your phone browser, navigate to your Mac's Tailscale IP address with the port 3456:
   ```
   http://<mac-tailscale-ip>:3456
   ```

7. Ensure Claude Desktop is open on your Mac with any necessary MCP servers connected.

8. Type a message on your phone and hit Send! You can also use the ntfy app to send messages to your `NTFY_INPUT_TOPIC`.

## Commands

- `#new`: Open a new chat in Claude Desktop.
  - Usage: `#new` (opens a new chat) or `#new How are you?` (opens a new chat and types "How are you?")

## Limitations

- The server does not launch Claude; it must already be open.
- Only one message can be processed at a time.
- AppleScript heuristics are used to determine when Claude has finished generating. If Claude's UI changes, the `is_claude_done.applescript` might need tweaking.
