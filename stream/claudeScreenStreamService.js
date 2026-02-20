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
    this.selectedWindow = null
    this.lastWindowCaptureFailureKey = null
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

  parseWindowListOutput(rawOutput) {
    const lines = String(rawOutput || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const seenIds = new Set()
    const windows = []

    for (const line of lines) {
      const [idPart, appNamePart, ...titleParts] = line.split('\t')
      const id = Number.parseInt(idPart, 10)
      if (!Number.isFinite(id) || id <= 0 || seenIds.has(id)) {
        continue
      }

      seenIds.add(id)
      windows.push({
        id,
        appName: String(appNamePart || 'Unknown').trim(),
        title: titleParts.join('\t').trim()
      })
    }

    windows.sort((a, b) => {
      if (a.appName === b.appName) {
        return a.title.localeCompare(b.title)
      }
      return a.appName.localeCompare(b.appName)
    })

    return windows
  }

  async listWindows() {
    const scriptPath = path.join(
      this.projectRoot,
      'scripts',
      'list_windows.applescript'
    )
    const { stdout } = await execFileAsync('osascript', [scriptPath], {
      cwd: this.projectRoot,
      maxBuffer: 1024 * 1024
    })
    return this.parseWindowListOutput(stdout)
  }

  setSelectedWindow(windowInfo) {
    if (!windowInfo) {
      this.selectedWindow = null
      return
    }

    const parsedId = Number.parseInt(String(windowInfo.id), 10)
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new Error('Invalid selected window id')
    }

    this.selectedWindow = {
      id: parsedId,
      appName: String(windowInfo.appName || ''),
      title: String(windowInfo.title || '')
    }
  }

  clearSelectedWindow() {
    this.selectedWindow = null
  }

  getSelectedWindow() {
    if (!this.selectedWindow) {
      return null
    }

    return { ...this.selectedWindow }
  }

  async captureFrame() {
    if (this.captureInProgress) {
      return
    }

    this.captureInProgress = true
    try {
      let windowId = null
      let windowMode = 'claude-window'

      if (this.selectedWindow && this.selectedWindow.id) {
        windowId = this.selectedWindow.id
        windowMode = 'selected-window'
      } else {
        windowId = await this.getClaudeWindowId()
      }

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
          this.lastMode = windowMode
          this.lastCaptureAt = Date.now()
          this.lastWindowCaptureFailureKey = null
          return
        } catch (error) {
          const failureKey = `${windowMode}:${windowId}`
          if (this.lastWindowCaptureFailureKey !== failureKey) {
            console.warn(
              `[STREAM] Window capture failed for ${windowMode} id=${windowId}. Falling back to full screen.`
            )
            this.lastWindowCaptureFailureKey = failureKey
          }
          // Fall through to full-screen capture.
        }
      }

      await this.runScreenCapture(['-x', '-t', 'jpg', this.framePath])
      this.lastMode = 'screen'
      this.lastCaptureAt = Date.now()
      if (!windowId) {
        this.lastWindowCaptureFailureKey = null
      }
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
      mode: this.lastMode,
      selectedWindow: this.getSelectedWindow()
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
