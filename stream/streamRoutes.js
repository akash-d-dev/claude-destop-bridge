function registerStreamRoutes(app, streamService) {
  app.get('/stream/status', (req, res) => {
    res.json(streamService.getStatus())
  })

  app.get('/stream/windows', async (req, res) => {
    try {
      const windows = await streamService.listWindows()
      const selectedWindow = streamService.getSelectedWindow()
      console.log(
        `[STREAM] Window list loaded. count=${windows.length} selectedWindowId=${selectedWindow ? selectedWindow.id : 'none'}`
      )
      res.json({
        windows,
        selectedWindowId: selectedWindow ? selectedWindow.id : null
      })
    } catch (error) {
      console.error('[STREAM] Failed to list windows:', error)
      res.status(500).json({ error: 'Failed to list windows' })
    }
  })

  app.post('/stream/select-window', async (req, res) => {
    try {
      const { windowId } = req.body || {}

      if (windowId === null || windowId === undefined || windowId === '') {
        streamService.clearSelectedWindow()
        await streamService.captureFrame()
        console.log('[STREAM] Cleared selected window. Using Claude auto mode.')
        return res.json({ status: 'ok', ...streamService.getStatus() })
      }

      const parsedWindowId = Number.parseInt(String(windowId), 10)
      if (!Number.isFinite(parsedWindowId) || parsedWindowId <= 0) {
        return res.status(400).json({
          error: 'windowId must be a positive integer'
        })
      }

      const windows = await streamService.listWindows()
      const selectedWindow = windows.find((item) => item.id === parsedWindowId)
      if (!selectedWindow) {
        return res.status(404).json({
          error: 'Selected window not found. Refresh windows and select again.'
        })
      }

      streamService.setSelectedWindow(selectedWindow)
      await streamService.captureFrame()
      console.log(
        `[STREAM] Selected window id=${selectedWindow.id} app="${selectedWindow.appName}" title="${selectedWindow.title}"`
      )
      res.json({ status: 'ok', ...streamService.getStatus() })
    } catch (error) {
      console.error('[STREAM] Failed to set selected window:', error)
      res.status(500).json({ error: 'Failed to set selected window' })
    }
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
