const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')

const execFileAsync = promisify(execFile)

class ClaudeScreenStreamService {
  constructor({ projectRoot, intervalMs = 1000 }) {
    this.projectRoot = projectRoot
    this.intervalMs = intervalMs
    this.framePath = path.join(os.tmpdir(), 'claude-bridge-latest-frame.jpg')
    this.timer = null
    this.captureInProgress = false
    this.lastCaptureAt = null
    this.lastMode = 'screen'
  }

  async getClaudeWindowId() {
    const scriptPath = path.join(
      this.projectRoot,
      'scripts',
      'get_claude_window_id.applescript'
    )

    try {
      const { stdout } = await execFileAsync('osascript', [scriptPath], {
        cwd: this.projectRoot
      })
      const value = Number.parseInt(String(stdout || '').trim(), 10)
      if (!Number.isFinite(value) || value <= 0) {
        return null
      }
      return value
    } catch {
      return null
    }
  }

  async runScreenCapture(args) {
    await execFileAsync('screencapture', args, { cwd: this.projectRoot })
  }

  async captureFrame() {
    if (this.captureInProgress) {
      return
    }

    this.captureInProgress = true
    try {
      const windowId = await this.getClaudeWindowId()

      if (windowId) {
        try {
          await this.runScreenCapture([
            '-x',
            '-t',
            'jpg',
            '-l',
            String(windowId),
            this.framePath
          ])
          this.lastMode = 'window'
          this.lastCaptureAt = Date.now()
          return
        } catch {
          // Fall through to full-screen capture.
        }
      }

      await this.runScreenCapture(['-x', '-t', 'jpg', this.framePath])
      this.lastMode = 'screen'
      this.lastCaptureAt = Date.now()
    } finally {
      this.captureInProgress = false
    }
  }

  start() {
    if (this.timer) {
      return
    }

    this.captureFrame().catch((error) => {
      console.error('[STREAM] Initial frame capture failed:', error)
    })

    this.timer = setInterval(() => {
      this.captureFrame().catch((error) => {
        console.error('[STREAM] Frame capture failed:', error)
      })
    }, this.intervalMs)
  }

  stop() {
    if (!this.timer) {
      return
    }
    clearInterval(this.timer)
    this.timer = null
  }

  isRunning() {
    return Boolean(this.timer)
  }

  getStatus() {
    return {
      running: this.isRunning(),
      intervalMs: this.intervalMs,
      lastCaptureAt: this.lastCaptureAt,
      mode: this.lastMode
    }
  }

  async frameExists() {
    try {
      await fs.promises.access(this.framePath, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  getFrameReadStream() {
    return fs.createReadStream(this.framePath)
  }
}

module.exports = {
  ClaudeScreenStreamService
}
