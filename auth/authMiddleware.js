const { getCookie } = require('./authUtils')

function createRequireAuth(accessService) {
  return (req, res, next) => {
    const token = getCookie(req, accessService.getCookieName())
    const session = accessService.validateSession(token, {
      userAgent: req.headers['user-agent'] || ''
    })

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    req.deviceSession = session
    next()
  }
}

module.exports = {
  createRequireAuth
}
