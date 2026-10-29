const folder = document.querySelector('#folder')
const count = document.querySelector('#count')
const grid = document.querySelector('#grid')
const viewer = document.querySelector('#viewer')
const mediaContainer = document.querySelector('#media')
const previous = document.querySelector('#previous')
const next = document.querySelector('#next')
const play = document.querySelector('#play')
const interval = document.querySelector('#interval')
const settings = document.querySelector('#settings')
const settingsMenu = document.querySelector('#settings-menu')
const fullscreen = document.querySelector('#fullscreen')
const mapView = document.querySelector('#map-view')
const mapMessage = document.querySelector('#map-message')
const mapRouteButton = document.querySelector('#toggle-route')
const mapToolbar = document.querySelector('#map-toolbar')
const mediaMapButton = document.querySelector('#media-map')
const locatedMedia = slideshow.media.map((item, itemIndex) => ({ ...item, index: itemIndex })).filter((item) => item.location)
let map = null
let markers = null
let route = null
let mapOpenedFromViewer = false
let highlightedMediaIndex = null
let index = 0
let playing = false
let timer = null
let lastFocus = null
let gesture = null
let suppressClick = false
let currentMedia = null
let transitionTimer = null
let transitioning = false
let zoom = { scale: 1, x: 0, y: 0 }
let pointers = new Map()
let pinch = null
let clickTimer = null
let lastTap = null
const track = document.createElement('div')
track.className = 'viewer__track'
const preloadedImages = new Map()
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

folder.textContent = slideshow.name
document.title = slideshow.name + ' — Tiny Slideshow'
count.textContent = `${slideshow.media.length} items`
document.querySelector('#empty').hidden = slideshow.media.length !== 0
slideshow.media.forEach((item, itemIndex) => {
  const button = document.createElement('button')
  button.className = 'tile'
  button.setAttribute('aria-label', `Open ${item.name}`)
  const image = document.createElement('img')
  image.loading = 'lazy'
  image.alt = ''
  if (item.thumbnail || !item.video) image.src = item.thumbnail || item.url
  button.append(image)
  if (item.video) {
    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>'
    button.append(badge)
  }
  if (item.location) {
    const badge = document.createElement('span')
    badge.className = 'badge badge--location'
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>'
    button.append(badge)
  }
  button.addEventListener('click', () => openViewer(itemIndex))
  grid.append(button)
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
  if (transitioning || viewer.hidden || itemIndex < 0 || itemIndex >= slideshow.media.length) return
  clearTimeout(timer)
  if (!currentMedia) {
    index = itemIndex
    renderMedia()
    startCurrentMedia()
    return
  }
  const direction = Math.sign(itemIndex - index)
  if (!direction) return
  resetZoom()
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
  resetZoom()
  track.replaceChildren()
  track.style.transition = 'none'
  track.style.transform = 'translateX(0px)'
  for (const offset of [-1, 0, 1]) {
    const itemIndex = index + offset
    const item = slideshow.media[itemIndex]
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
  next.disabled = index === slideshow.media.length - 1
  mediaMapButton.hidden = !slideshow.media[index].location
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
    image.src = slideshow.media[itemIndex].url
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
  if (index === slideshow.media.length - 1) stopPlaying()
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
  gesture = null
  pointers.clear()
  pinch = null
  clearTimeout(clickTimer)
  lastTap = null
  viewer.hidden = true
  document.body.style.overflow = mapView.hidden ? '' : 'hidden'
  if (lastFocus) lastFocus.focus()
}

previous.addEventListener('click', () => { if (index > 0) showMedia(index - 1) })
next.addEventListener('click', () => { if (index < slideshow.media.length - 1) showMedia(index + 1) })
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
document.querySelector('#open-map').addEventListener('click', () => openMap())
mediaMapButton.addEventListener('click', () => openMap(slideshow.media[index].location))
document.querySelector('#close-map').addEventListener('click', closeMap)
document.querySelector('#map-global').addEventListener('click', showAllLocations)
mapRouteButton.addEventListener('click', () => {
  if (!route) return
  const visible = map.hasLayer(route)
  if (visible) map.removeLayer(route)
  else route.addTo(map)
  mapRouteButton.setAttribute('aria-pressed', String(!visible))
  mapRouteButton.classList.toggle('map-route--hidden', visible)
  mapRouteButton.setAttribute('aria-label', visible ? 'Show route' : 'Hide route')
  mapRouteButton.title = visible ? 'Show route' : 'Hide route'
})

function openMap(location = null) {
  mapOpenedFromViewer = Boolean(location && !viewer.hidden)
  highlightedMediaIndex = mapOpenedFromViewer ? index : null
  if (mapOpenedFromViewer) stopPlaying()
  mapView.classList.toggle('map-view--foreground', mapOpenedFromViewer)
  mapView.hidden = false
  document.body.style.overflow = 'hidden'
  document.querySelector('#close-map').focus()
  mapMessage.hidden = true
  mapToolbar.hidden = true
  if (!locatedMedia.length) {
    mapMessage.textContent = 'No geotagged photos or videos found.'
    mapMessage.hidden = false
    return
  }
  if (typeof L === 'undefined') {
    mapMessage.textContent = 'The map could not be loaded. Check your internet connection.'
    mapMessage.hidden = false
    return
  }
  if (!map) {
    map = L.map('map', { zoomControl: false })
    L.control.zoom({ position: 'topleft' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    markers = L.layerGroup().addTo(map)
    route = L.polyline(locatedMedia.map((item) => item.location), { color: '#6ca9ff', weight: 3 }).addTo(map)
    map.on('zoomend', updateMapMarkers)
    showAllLocations()
    updateMapMarkers()
  }
  mapToolbar.hidden = false
  requestAnimationFrame(() => {
    map.invalidateSize()
    if (location) map.setView(location, 15)
    updateMapMarkers()
  })
}

function closeMap() {
  mapView.hidden = true
  mapView.classList.remove('map-view--foreground')
  document.body.style.overflow = viewer.hidden ? '' : 'hidden'
  if (mapOpenedFromViewer && !viewer.hidden) mediaMapButton.focus()
  else document.querySelector('#open-map').focus()
  mapOpenedFromViewer = false
}

function showAllLocations() {
  if (map && locatedMedia.length) map.fitBounds(L.latLngBounds(locatedMedia.map((item) => item.location)), { padding: [40, 40], maxZoom: 15 })
}

function updateMapMarkers() {
  markers.clearLayers()
  const groups = new Map()
  for (const item of locatedMedia) {
    const point = map.project(item.location, map.getZoom())
    const key = `${Math.round(point.x / 70)},${Math.round(point.y / 70)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  for (const items of groups.values()) {
    const position = [items.reduce((sum, item) => sum + item.location[0], 0) / items.length, items.reduce((sum, item) => sum + item.location[1], 0) / items.length]
    const markerContent = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="M4 17l5-5 3 3 3-3 5 5"/></svg>' + (items.length > 1 ? `<span>${items.length}</span>` : '')
    const markerWidth = items.length > 1 ? Math.max(48, 34 + String(items.length).length * 8) : 36
    const markerClass = items.some((item) => item.index === highlightedMediaIndex) ? 'map-marker map-marker--highlighted' : 'map-marker'
    const icon = L.divIcon({ className: markerClass, html: markerContent, iconSize: [markerWidth, 36], iconAnchor: [markerWidth / 2, 18] })
    const popup = document.createElement('div')
    popup.className = 'map-photos'
    for (const item of items) {
      const button = document.createElement('button')
      button.className = 'map-photos__item'
      button.setAttribute('aria-label', `Open ${item.name}`)
      const image = document.createElement('img')
      image.src = item.thumbnail || (!item.video ? item.url : '')
      image.alt = item.name
      image.loading = 'lazy'
      button.append(image)
      button.addEventListener('click', () => {
        mapView.classList.remove('map-view--foreground')
        mapOpenedFromViewer = false
        openViewer(item.index)
      })
      popup.append(button)
    }
    L.marker(position, { icon, title: `${items.length} ${items.length === 1 ? 'media item' : 'media items'}` }).bindPopup(popup, { maxWidth: 300 }).addTo(markers)
  }
}
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
  if (event.key === 'Escape' && !mapView.hidden && (viewer.hidden || mapOpenedFromViewer)) {
    closeMap()
    return
  }
  if (viewer.hidden) {
    return
  }
  if (event.key === 'Escape' && !settingsMenu.hidden) { setSettingsOpen(false); settings.focus() }
  else if (event.key === 'Escape') closeViewer()
  else if (event.target.tagName !== 'SELECT') {
    if (event.key === 'ArrowLeft') previous.click()
    if (event.key === 'ArrowRight') next.click()
    if (event.key === ' ') { event.preventDefault(); play.click() }
  }
})
mediaContainer.addEventListener('pointerdown', (event) => {
  if (transitioning || !currentMedia) return
  if (event.target.tagName === 'VIDEO' && event.clientY >= event.target.getBoundingClientRect().bottom - 60) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (pointers.size === 0) suppressClick = false
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2 && currentMedia.tagName === 'IMG') {
    const [first, second] = [...pointers.values()]
    const center = getCenter(first, second)
    pinch = { distance: getDistance(first, second), scale: zoom.scale, center, x: zoom.x, y: zoom.y }
    gesture = null
    suppressClick = true
    clearTimeout(clickTimer)
    lastTap = null
    moveTrack(0, true)
    mediaContainer.setPointerCapture(event.pointerId)
    return
  }
  if (pointers.size > 1) return
  gesture = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  if (zoom.scale > 1) { gesture.zoomX = zoom.x; gesture.zoomY = zoom.y }
  mediaContainer.setPointerCapture(event.pointerId)
})
mediaContainer.addEventListener('pointermove', (event) => {
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pinch && pointers.size >= 2) {
    const [first, second] = [...pointers.values()]
    const center = getCenter(first, second)
    const scale = Math.max(1, Math.min(5, pinch.scale * getDistance(first, second) / pinch.distance))
    const rect = mediaContainer.getBoundingClientRect()
    const anchorX = pinch.center.x - (rect.left + rect.width / 2)
    const anchorY = pinch.center.y - (rect.top + rect.height / 2)
    const ratio = scale / pinch.scale
    zoom = { scale, x: anchorX - (anchorX - pinch.x) * ratio + center.x - pinch.center.x, y: anchorY - (anchorY - pinch.y) * ratio + center.y - pinch.center.y }
    applyZoom()
    if (scale > 1 && playing) stopPlaying()
    return
  }
  if (!gesture || event.pointerId !== gesture.pointerId) return
  if (zoom.scale > 1 && currentMedia.tagName === 'IMG') {
    zoom.x = gesture.zoomX + event.clientX - gesture.x
    zoom.y = gesture.zoomY + event.clientY - gesture.y
    applyZoom()
    return
  }
  let dx = event.clientX - gesture.x
  if ((dx > 0 && index === 0) || (dx < 0 && index === slideshow.media.length - 1)) dx *= 0.2
  moveTrack(dx, false)
})
mediaContainer.addEventListener('pointerup', (event) => {
  pointers.delete(event.pointerId)
  if (pinch) {
    if (pointers.size < 2) pinch = null
    gesture = null
    suppressClick = true
    return
  }
  if (!gesture || event.pointerId !== gesture.pointerId) return
  const dx = event.clientX - gesture.x
  const dy = event.clientY - gesture.y
  gesture = null
  suppressClick = Math.abs(dx) > 10 || Math.abs(dy) > 10
  if (zoom.scale > 1) return
  const target = index + (dx < 0 ? 1 : -1)
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && target >= 0 && target < slideshow.media.length) showMedia(target)
  else moveTrack(0, true)
})
mediaContainer.addEventListener('pointercancel', (event) => { pointers.delete(event.pointerId); pinch = null; gesture = null; moveTrack(0, true) })
mediaContainer.addEventListener('click', (event) => {
  if (suppressClick) { suppressClick = false; return }
  if (event.target.tagName === 'VIDEO' && event.clientY >= event.target.getBoundingClientRect().bottom - 60) return
  if (!currentMedia || currentMedia.tagName !== 'IMG') {
    viewer.classList.toggle('viewer--controls-hidden')
    setSettingsOpen(false)
    return
  }
  const now = Date.now()
  if (lastTap && now - lastTap.time < 350 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 40) {
    clearTimeout(clickTimer)
    lastTap = null
    if (zoom.scale > 1) resetZoom()
    else {
      const rect = mediaContainer.getBoundingClientRect()
      zoom = { scale: 2, x: -(event.clientX - rect.left - rect.width / 2), y: -(event.clientY - rect.top - rect.height / 2) }
      applyZoom()
      if (playing) stopPlaying()
    }
    return
  }
  lastTap = { time: now, x: event.clientX, y: event.clientY }
  clickTimer = setTimeout(() => {
    lastTap = null
    viewer.classList.toggle('viewer--controls-hidden')
    setSettingsOpen(false)
  }, 350)
})

function getCenter(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

function getDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y) || 1
}

function applyZoom() {
  if (!currentMedia || currentMedia.tagName !== 'IMG') return
  const width = currentMedia.clientWidth * zoom.scale
  const height = currentMedia.clientHeight * zoom.scale
  const maxX = Math.max(0, (width - mediaContainer.clientWidth) / 2)
  const maxY = Math.max(0, (height - mediaContainer.clientHeight) / 2)
  zoom.x = Math.max(-maxX, Math.min(maxX, zoom.x))
  zoom.y = Math.max(-maxY, Math.min(maxY, zoom.y))
  currentMedia.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`
}

function resetZoom() {
  if (currentMedia && currentMedia.tagName === 'IMG') currentMedia.style.transform = ''
  zoom = { scale: 1, x: 0, y: 0 }
}

