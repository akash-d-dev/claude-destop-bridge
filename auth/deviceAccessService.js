const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

class DeviceAccessService {
  constructor({
    passcode,
    sessionTtlMs = 24 * 60 * 60 * 1000,
    sessionCookieName = 'claude_bridge_session',
    storeDir = '.data',
    storeFile = 'sessions.json'
  }) {
    this.passcode = String(passcode || '')
    this.sessionTtlMs = sessionTtlMs
    this.sessionCookieName = sessionCookieName
    this.storePath = path.join(storeDir, storeFile)
    this.sessions = new Map()
    this.ensureStoreDir()
    this.loadSessionsFromDisk()
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 10 * 60 * 1000)
    this.cleanupTimer.unref()
  }

  ensureStoreDir() {
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true })
    } catch (error) {
      console.error('[AUTH] Failed to ensure session store directory:', error)
    }
  }

  normalizeSessionRecord(token, raw) {
    if (!raw || typeof raw !== 'object') return null
    const createdAt = Number.parseInt(String(raw.createdAt), 10)
    const expiresAt = Number.parseInt(String(raw.expiresAt), 10)
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
      return null
    }

    return {
      token,
      createdAt,
      expiresAt,
      userAgent: String(raw.userAgent || '')
    }
  }

  loadSessionsFromDisk() {
    try {
      if (!fs.existsSync(this.storePath)) {
        return
      }

      const raw = fs.readFileSync(this.storePath, 'utf8')
      if (!raw.trim()) {
        return
      }

      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') {
        return
      }

      const loadedSessions = new Map()
      for (const [token, session] of Object.entries(parsed)) {
        const normalized = this.normalizeSessionRecord(token, session)
        if (normalized) {
          loadedSessions.set(token, normalized)
        }
      }
      this.sessions = loadedSessions
      this.cleanupExpiredSessions()
    } catch (error) {
      console.error('[AUTH] Failed to load sessions from disk:', error)
      this.sessions = new Map()
    }
  }

  persistSessionsToDisk() {
    try {
      this.ensureStoreDir()
      const serialized = JSON.stringify(
        Object.fromEntries(this.sessions),
        null,
        2
      )
      const tempPath = `${this.storePath}.tmp`
      fs.writeFileSync(tempPath, serialized, 'utf8')
      fs.renameSync(tempPath, this.storePath)
    } catch (error) {
      console.error('[AUTH] Failed to persist sessions to disk:', error)
    }
  }

  getCookieName() {
    return this.sessionCookieName
  }

  getSessionTtlMs() {
    return this.sessionTtlMs
  }

  isPasscodeConfigured() {
    return Boolean(this.passcode)
  }

  isPasscodeValid(input) {
    if (!this.isPasscodeConfigured()) {
      return false
    }

    const provided = Buffer.from(String(input || ''))
    const expected = Buffer.from(this.passcode)
    if (provided.length !== expected.length) {
      return false
    }

    return crypto.timingSafeEqual(provided, expected)
  }

  createSession({ userAgent }) {
    const token = crypto.randomBytes(32).toString('hex')
    const now = Date.now()
    const session = {
      token,
      createdAt: now,
      expiresAt: now + this.sessionTtlMs,
      userAgent: String(userAgent || '')
    }
    this.sessions.set(token, session)
    this.persistSessionsToDisk()
    return session
  }

  revokeSession(token) {
    if (!token) return
    if (this.sessions.delete(token)) {
      this.persistSessionsToDisk()
    }
  }

  validateSession(token, { userAgent }) {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token)
      this.persistSessionsToDisk()
      return null
    }

    if (session.userAgent && session.userAgent !== String(userAgent || '')) {
      this.sessions.delete(token)
      this.persistSessionsToDisk()
      return null
    }

    return session
  }

  cleanupExpiredSessions() {
    const now = Date.now()
    let removed = false
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token)
        removed = true
      }
    }
    if (removed) {
      this.persistSessionsToDisk()
    }
  }
}

module.exports = {
  DeviceAccessService
}
