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
    this.selectedDisplay = null
    this.lastWindowCaptureFailureKey = null
    this.lastDisplayCaptureFailureKey = null
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

  parseDisplayListOutput(rawOutput) {
    const lines = String(rawOutput || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const displays = []
    const seenIds = new Set()

    for (const line of lines) {
      const [idPart, isMainPart, xPart, yPart, widthPart, heightPart] =
        line.split('\t')
      const id = Number.parseInt(idPart, 10)
      if (!Number.isFinite(id) || id <= 0 || seenIds.has(id)) {
        continue
      }

      seenIds.add(id)
      displays.push({
        id,
        isMain: String(isMainPart) === '1',
        x: Number.parseInt(xPart, 10) || 0,
        y: Number.parseInt(yPart, 10) || 0,
        width: Number.parseInt(widthPart, 10) || 0,
        height: Number.parseInt(heightPart, 10) || 0
      })
    }

    displays.sort((a, b) => {
      if (a.isMain && !b.isMain) return -1
      if (!a.isMain && b.isMain) return 1
      return a.id - b.id
    })

    return displays
  }

  async listWindows() {
    const swiftScriptPath = path.join(
      this.projectRoot,
      'scripts',
      'list_windows.swift'
    )

    try {
      const { stdout } = await execFileAsync('swift', [swiftScriptPath], {
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024
      })

      const windows = this.parseWindowListOutput(stdout)
      if (windows.length > 0) {
        return windows
      }
    } catch (error) {
      console.warn('[STREAM] Swift window list failed, falling back to AppleScript.')
    }

    const appleScriptPath = path.join(
      this.projectRoot,
      'scripts',
      'list_windows.applescript'
    )
    try {
      const { stdout } = await execFileAsync('osascript', [appleScriptPath], {
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024
      })
      return this.parseWindowListOutput(stdout)
    } catch (error) {
      console.warn('[STREAM] AppleScript window list failed.')
      return []
    }
  }

  async listDisplays() {
    const scriptPath = path.join(this.projectRoot, 'scripts', 'list_displays.swift')
    try {
      const { stdout } = await execFileAsync('swift', [scriptPath], {
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024
      })
      return this.parseDisplayListOutput(stdout)
    } catch (error) {
      console.warn('[STREAM] Failed to list displays via Swift.')
      return []
    }
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

  setSelectedDisplay(displayInfo) {
    if (!displayInfo) {
      this.selectedDisplay = null
      return
    }

    const parsedId = Number.parseInt(String(displayInfo.id), 10)
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new Error('Invalid selected display id')
    }

    this.selectedDisplay = {
      id: parsedId,
      isMain: Boolean(displayInfo.isMain),
      x: Number.parseInt(String(displayInfo.x), 10) || 0,
      y: Number.parseInt(String(displayInfo.y), 10) || 0,
      width: Number.parseInt(String(displayInfo.width), 10) || 0,
      height: Number.parseInt(String(displayInfo.height), 10) || 0
    }
  }

  clearSelectedDisplay() {
    this.selectedDisplay = null
  }

  getSelectedDisplay() {
    if (!this.selectedDisplay) {
      return null
    }

    return { ...this.selectedDisplay }
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

      if (this.selectedDisplay && this.selectedDisplay.id) {
        const displayId = this.selectedDisplay.id
        try {
          await this.runScreenCapture([
            '-x',
            '-t',
            'jpg',
            '-D',
            String(displayId),
            this.framePath
          ])
          this.lastMode = 'selected-display'
          this.lastCaptureAt = Date.now()
          this.lastDisplayCaptureFailureKey = null
          return
        } catch (error) {
          const failureKey = `selected-display:${displayId}`
          if (this.lastDisplayCaptureFailureKey !== failureKey) {
            console.warn(
              `[STREAM] Display capture failed for display id=${displayId}. Falling back to all screens.`
            )
            this.lastDisplayCaptureFailureKey = failureKey
          }
        }
      }

      await this.runScreenCapture(['-x', '-t', 'jpg', this.framePath])
      this.lastMode = 'screen'
      this.lastCaptureAt = Date.now()
      if (!windowId) {
        this.lastWindowCaptureFailureKey = null
      }
      if (!this.selectedDisplay) {
        this.lastDisplayCaptureFailureKey = null
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
      selectedWindow: this.getSelectedWindow(),
      selectedDisplay: this.getSelectedDisplay()
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
