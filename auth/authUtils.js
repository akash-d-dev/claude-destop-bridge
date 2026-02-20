function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies

  const parts = String(cookieHeader).split(';')
  for (const part of parts) {
    const [rawName, ...rawValueParts] = part.trim().split('=')
    if (!rawName) continue
    const value = rawValueParts.join('=')
    cookies[rawName] = decodeURIComponent(value || '')
  }

  return cookies
}

function getCookie(req, cookieName) {
  const cookies = parseCookies(req.headers.cookie)
  return cookies[cookieName] || null
}

function isHttpsRequest(req) {
  if (req.secure) return true
  const forwardedProto = req.headers['x-forwarded-proto']
  if (!forwardedProto) return false
  return String(forwardedProto).split(',')[0].trim() === 'https'
}

module.exports = {
  getCookie,
  isHttpsRequest
}
