function createViewer({ media, onOpenMap, isMapOpen }) {
  const viewer = document.querySelector('#viewer')
  const mediaContainer = document.querySelector('#media')
  const previous = document.querySelector('#previous')
  const next = document.querySelector('#next')
  const play = document.querySelector('#play')
  const interval = document.querySelector('#interval')
  const settings = document.querySelector('#settings')
  const settingsMenu = document.querySelector('#settings-menu')
  const mediaMapButton = document.querySelector('#media-map')
  let index = 0
  let playing = false
  let timer = null
  let lastFocus = null
  let currentMedia = null
  let transitionTimer = null
  let transitioning = false
  const track = document.createElement('div')
  track.className = 'viewer__track'
  const preloadedImages = new Map()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const gestures = createGestures({
    mediaContainer, viewer, media, getIndex: () => index,
    getCurrentMedia: () => currentMedia, isTransitioning: () => transitioning,
    isPlaying: () => playing, stopPlaying, moveTrack, showMedia, setSettingsOpen,
  })

  function openViewer(itemIndex) {
    lastFocus = document.activeElement
    viewer.hidden = false
    viewer.classList.remove('viewer--controls-hidden')
    document.body.style.overflow = 'hidden'
    showMedia(itemIndex)
    document.querySelector('#close').focus()
  }

  function showMedia(itemIndex) {
    if (transitioning || viewer.hidden || itemIndex < 0 || itemIndex >= media.length) return
    clearTimeout(timer)
    if (!currentMedia) {
      index = itemIndex
      renderMedia()
      startCurrentMedia()
      return
    }
    const direction = Math.sign(itemIndex - index)
    if (!direction) return
    gestures.resetZoom()
    if (currentMedia.tagName === 'VIDEO') currentMedia.pause()
    transitioning = true
    moveTrack(-direction * (mediaContainer.clientWidth + 10), true)
    transitionTimer = setTimeout(() => {
      if (viewer.hidden) return
      index = itemIndex
      transitioning = false
      renderMedia()
      startCurrentMedia()
    }, reducedMotion.matches ? 0 : 350)
  }

  function renderMedia() {
    gestures.resetZoom()
    track.replaceChildren()
    track.style.transition = 'none'
    track.style.transform = 'translateX(0px)'
    for (const offset of [-1, 0, 1]) {
      const itemIndex = index + offset
      const item = media[itemIndex]
      if (!item) continue
      const slide = document.createElement('div')
      slide.className = 'viewer__slide'
      slide.style.left = `calc(${offset * 100}% + ${offset * 10}px)`
      let element
      if (item.video && offset === 0) {
        element = document.createElement('video')
        element.src = item.url
        element.controls = true
        element.playsInline = true
        element.preload = 'metadata'
        element.muted = true
        if (item.thumbnail) element.poster = item.thumbnail
        element.addEventListener('ended', () => { if (playing && currentMedia === element) advance() })
      } else if (item.video) {
        element = document.createElement('img')
        if (item.thumbnail) element.src = item.thumbnail
        element.alt = ''
      } else {
        element = getImage(itemIndex)
        element.alt = item.name
        element.decode().catch(() => {})
      }
      element.draggable = false
      slide.append(element)
      track.append(slide)
      if (offset === 0) currentMedia = element
    }
    mediaContainer.replaceChildren(track)
    previous.disabled = index === 0
    next.disabled = index === media.length - 1
    mediaMapButton.hidden = !media[index].location
    for (const cachedIndex of preloadedImages.keys()) {
      if (Math.abs(cachedIndex - index) > 1) preloadedImages.delete(cachedIndex)
    }
  }

  function startCurrentMedia() {
    if (playing) schedule()
    else if (currentMedia && currentMedia.tagName === 'VIDEO') currentMedia.play().catch(() => {})
  }

  function moveTrack(offset, animate) {
    track.style.transition = animate && !reducedMotion.matches ? 'transform 350ms ease-out' : 'none'
    track.style.transform = `translateX(${offset}px)`
  }

  function getImage(itemIndex) {
    if (!preloadedImages.has(itemIndex)) {
      const image = new Image()
      image.src = media[itemIndex].url
      preloadedImages.set(itemIndex, image)
    }
    return preloadedImages.get(itemIndex)
  }

  function schedule() {
    clearTimeout(timer)
    const video = currentMedia && currentMedia.tagName === 'VIDEO' ? currentMedia : null
    if (video) {
      video.muted = true
      video.play().catch(() => { if (currentMedia === video && playing) stopPlaying() })
    } else {
      const seconds = Math.max(1, Math.min(3600, Number(interval.value) || 5))
      timer = setTimeout(advance, seconds * 1000)
    }
  }

  function advance() {
    if (index === media.length - 1) stopPlaying()
    else showMedia(index + 1)
  }

  function stopPlaying() {
    playing = false
    clearTimeout(timer)
    play.setAttribute('aria-label', 'Play slideshow')
    play.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>'
    const video = currentMedia && currentMedia.tagName === 'VIDEO' ? currentMedia : null
    if (video) video.pause()
  }

  function closeViewer() {
    clearTimeout(transitionTimer)
    transitioning = false
    stopPlaying()
    setSettingsOpen(false)
    mediaContainer.replaceChildren()
    currentMedia = null
    preloadedImages.clear()
    gestures.reset()
    viewer.hidden = true
    document.body.style.overflow = isMapOpen() ? 'hidden' : ''
    if (lastFocus) lastFocus.focus()
  }

  previous.addEventListener('click', () => { if (index > 0) showMedia(index - 1) })
  next.addEventListener('click', () => { if (index < media.length - 1) showMedia(index + 1) })
  play.addEventListener('click', () => {
    if (playing) return stopPlaying()
    playing = true
    play.setAttribute('aria-label', 'Pause slideshow')
    play.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'
    schedule()
  })
  interval.addEventListener('change', () => { if (playing && currentMedia && currentMedia.tagName !== 'VIDEO') schedule() })
  function setSettingsOpen(open) {
    settingsMenu.hidden = !open
    settings.setAttribute('aria-expanded', String(open))
  }
  settings.addEventListener('click', () => setSettingsOpen(settingsMenu.hidden))
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.settings')) setSettingsOpen(false)
  })
  document.querySelector('#close').addEventListener('click', closeViewer)

  mediaMapButton.addEventListener('click', () => onOpenMap(index))

  return { open: openViewer, close: closeViewer, pause: stopPlaying, isOpen: () => !viewer.hidden, getIndex: () => index, handleKey }

  function handleKey(event) {
    if (event.key === 'Escape' && !settingsMenu.hidden) { setSettingsOpen(false); settings.focus() }
    else if (event.key === 'Escape') closeViewer()
    else if (event.target.tagName !== 'SELECT') {
      if (event.key === 'ArrowLeft') previous.click()
      if (event.key === 'ArrowRight') next.click()
      if (event.key === ' ') { event.preventDefault(); play.click() }
    }
  }
}
