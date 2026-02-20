function registerStreamRoutes(app, streamService) {
  app.get('/stream/status', (req, res) => {
    res.json(streamService.getStatus())
  })

  app.post('/stream/start', (req, res) => {
    streamService.start()
    console.log('[STREAM] Live view started.')
    res.json({ status: 'ok', ...streamService.getStatus() })
  })

  app.post('/stream/stop', (req, res) => {
    streamService.stop()
    console.log('[STREAM] Live view stopped.')
    res.json({ status: 'ok', ...streamService.getStatus() })
  })

  app.get('/stream/frame', async (req, res) => {
    try {
      if (!streamService.isRunning()) {
        streamService.start()
      }

      const exists = await streamService.frameExists()
      if (!exists) {
        return res.status(503).json({ error: 'Frame not ready yet' })
      }

      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
      )
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.type('jpg')

      const readStream = streamService.getFrameReadStream()
      readStream.on('error', () => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to read frame' })
          return
        }
        res.end()
      })
      readStream.pipe(res)
    } catch (error) {
      console.error('[STREAM] /stream/frame failed:', error)
      res.status(500).json({ error: 'Failed to capture frame' })
    }
  })
}

module.exports = {
  registerStreamRoutes
}
