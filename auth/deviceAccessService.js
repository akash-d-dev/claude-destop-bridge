const crypto = require('crypto')

class DeviceAccessService {
  constructor({
    passcode,
    sessionTtlMs = 24 * 60 * 60 * 1000,
    sessionCookieName = 'claude_bridge_session'
  }) {
    this.passcode = String(passcode || '')
    this.sessionTtlMs = sessionTtlMs
    this.sessionCookieName = sessionCookieName
    this.sessions = new Map()
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 10 * 60 * 1000)
    this.cleanupTimer.unref()
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
    return session
  }

  revokeSession(token) {
    if (!token) return
    this.sessions.delete(token)
  }

  validateSession(token, { userAgent }) {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token)
      return null
    }

    if (session.userAgent && session.userAgent !== String(userAgent || '')) {
      this.sessions.delete(token)
      return null
    }

    return session
  }

  cleanupExpiredSessions() {
    const now = Date.now()
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token)
      }
    }
  }
}

module.exports = {
  DeviceAccessService
}
