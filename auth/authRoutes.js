const { getCookie, isHttpsRequest } = require('./authUtils')

function registerAuthRoutes(app, accessService) {
  app.get('/auth/status', (req, res) => {
    const token = getCookie(req, accessService.getCookieName())
    const session = accessService.validateSession(token, {
      userAgent: req.headers['user-agent'] || ''
    })

    if (!session) {
      return res.json({
        authenticated: false,
        sessionTtlMs: accessService.getSessionTtlMs()
      })
    }

    return res.json({
      authenticated: true,
      expiresAt: session.expiresAt,
      sessionTtlMs: accessService.getSessionTtlMs()
    })
  })

  app.post('/auth/login', (req, res) => {
    const { passcode } = req.body || {}
    if (!accessService.isPasscodeValid(passcode)) {
      return res.status(401).json({ error: 'Invalid passcode' })
    }

    const session = accessService.createSession({
      userAgent: req.headers['user-agent'] || ''
    })

    res.cookie(accessService.getCookieName(), session.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isHttpsRequest(req),
      maxAge: accessService.getSessionTtlMs(),
      path: '/'
    })

    return res.json({
      status: 'ok',
      expiresAt: session.expiresAt,
      sessionTtlMs: accessService.getSessionTtlMs()
    })
  })

  app.post('/auth/logout', (req, res) => {
    const token = getCookie(req, accessService.getCookieName())
    accessService.revokeSession(token)
    res.clearCookie(accessService.getCookieName(), { path: '/' })
    return res.json({ status: 'ok' })
  })
}

module.exports = {
  registerAuthRoutes
}
