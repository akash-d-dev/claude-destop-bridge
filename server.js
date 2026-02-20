require('dotenv').config()

const express = require('express')
const path = require('path')
const { exec } = require('child_process')
const {
  ClaudeScreenStreamService
} = require('./stream/claudeScreenStreamService')
const { registerStreamRoutes } = require('./stream/streamRoutes')

const app = express()
const PORT = process.env.PORT || 3456
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'default-claude-bridge'
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 2000
const MAX_WAIT_MS = parseInt(process.env.MAX_WAIT_MS) || 300000 // 5 minutes
const DONE_DELAY_MS = parseInt(process.env.DONE_DELAY_MS, 10) || 2000
const STREAM_INTERVAL_MS = parseInt(process.env.STREAM_INTERVAL_MS, 10) || 1000

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url} from ${req.ip}`)
  next()
})

const screenStreamService = new ClaudeScreenStreamService({
  projectRoot: __dirname,
  intervalMs: STREAM_INTERVAL_MS
})
registerStreamRoutes(app, screenStreamService)

// Expose configuration to the frontend
app.get('/config', (req, res) => {
  console.log(`[HTTP] GET /config -> ntfyTopic=${NTFY_TOPIC}`)
  res.json({
    ntfyTopic: NTFY_TOPIC,
    doneDelayMs: DONE_DELAY_MS,
    streamIntervalMs: STREAM_INTERVAL_MS
  })
})

// Centralized commands mapping
const COMMANDS = {
  '#new': {
    script: 'scripts/new_chat.applescript',
    waitMs: 500,
    description: 'Open a new chat'
  }
  // Add future commands here
}

// Track if Claude is currently processing a message
let isProcessing = false

async function sendDoneNotification() {
  console.log(`[NTFY] Publishing done notification to topic "${NTFY_TOPIC}"`)
  try {
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      body: 'Claude has responded ✅',
      headers: {
        Title: 'Claude Bridge'
      }
    })

    if (!response.ok) {
      console.error(
        `[NTFY] Failed to publish done notification. status=${response.status}`
      )
      return
    }

    console.log(
      `[NTFY] Done notification published successfully. status=${response.status}`
    )
  } catch (err) {
    console.error('[NTFY] Error sending done notification:', err)
  }
}

function processMessage(message) {
  if (isProcessing) {
    return { success: false, reason: 'Claude is already processing a message' }
  }

  isProcessing = true
  console.log(`[MSG] Received message: ${message}`)

  let textToType = message.trim()
  let matchedCommand = null

  // Check if message starts with any known command
  for (const [cmd, config] of Object.entries(COMMANDS)) {
    if (textToType.startsWith(cmd)) {
      matchedCommand = config
      textToType = textToType.substring(cmd.length).trim()
      break
    }
  }

  const typeMessage = () => {
    if (!textToType) {
      isProcessing = false
      return
    }

    // Call AppleScript to type the message
    exec(
      `osascript scripts/type_message.applescript "${textToType.replace(/"/g, '\\"')}"`,
      (error) => {
        if (error) {
          console.error('[APPLESCRIPT] Error typing message:', error)
          isProcessing = false
          return
        }

        console.log(
          `[APPLESCRIPT] Message typed. Notifying done in ${DONE_DELAY_MS}ms...`
        )
        setTimeout(() => {
          isProcessing = false
          console.log('[STATE] Claude marked as done (fixed delay mode).')
          sendDoneNotification()
        }, DONE_DELAY_MS)
      }
    )
  }

  if (matchedCommand) {
    console.log(`[CMD] Executing command: ${matchedCommand.description}`)
    exec(`osascript ${matchedCommand.script}`, (error) => {
      if (error) {
        console.error('[CMD] Error executing command script:', error)
        isProcessing = false
        return
      }

      if (textToType) {
        setTimeout(typeMessage, matchedCommand.waitMs || 500) // Wait a bit for UI to render
      } else {
        isProcessing = false
        sendDoneNotification()
      }
    })
  } else {
    typeMessage()
  }

  return { success: true }
}

// API endpoint to handle sending message
app.post('/send', async (req, res) => {
  const { message } = req.body
  console.log(`[HTTP] POST /send payload: ${JSON.stringify(req.body)}`)

  if (!message) {
    console.warn('[HTTP] POST /send rejected: missing message')
    return res.status(400).json({ error: 'Message is required' })
  }

  const result = processMessage(message)
  if (!result.success) {
    console.warn(`[HTTP] POST /send rejected: ${result.reason}`)
    return res.status(429).json({ error: result.reason })
  }

  console.log('[HTTP] POST /send accepted')
  res.json({ status: 'ok' })
})

const server = app.listen(PORT)
let bootHadError = false

server.on('error', (error) => {
  bootHadError = true
  if (error && error.code === 'EADDRINUSE') {
    console.error(
      `[BOOT] Port ${PORT} is already in use. Stop the existing server, then retry.`
    )
    process.exit(1)
  }

  console.error('[BOOT] Server failed to start:', error)
  process.exit(1)
})

server.on('listening', () => {
  // Delay startup logs slightly so dual-stack bind errors are reported first.
  setTimeout(() => {
    if (bootHadError || !server.listening) {
      return
    }
    console.log(`Claude Bridge server is running on http://localhost:${PORT}`)
    console.log('[NTFY] Input listener disabled (notification-only mode).')
  }, 100)
})
