function createControls({ viewer, map }) {
  const fullscreen = document.querySelector('#fullscreen')

  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch(error) { console.warn('Fullscreen is not available', error) }
  })
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement)
    fullscreen.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen')
    fullscreen.title = active ? 'Exit fullscreen' : 'Enter fullscreen'
    fullscreen.innerHTML = active
      ? '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M15 20v-5h5M9 20v-5H4"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>'
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && map.isOpen() && (!viewer.isOpen() || map.isForeground())) {
      map.close()
      return
    }
    if (viewer.isOpen()) viewer.handleKey(event)
  })
}
