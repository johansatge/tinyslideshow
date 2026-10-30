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
    route = L.layerGroup().addTo(map)
    map.on('zoomend', () => { updateMapMarkers(); updateMapRoute() })
    showAllLocations()
    updateMapMarkers()
    updateMapRoute()
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

function updateMapRoute() {
  route.clearLayers()
  const zoom = map.getZoom()
  for (let i = 1; i < locatedMedia.length; i++) {
    L.polyline([locatedMedia[i - 1].location, locatedMedia[i].location], { color: '#6ca9ff', weight: 3 }).addTo(route)
    const start = map.project(locatedMedia[i - 1].location, zoom)
    const end = map.project(locatedMedia[i].location, zoom)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.hypot(dx, dy)
    if (distance < 24) continue
    const count = Math.min(20, Math.max(1, Math.floor(distance / 100)))
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    for (let j = 1; j <= count; j++) {
      const fraction = j / (count + 1)
      const position = map.unproject([start.x + dx * fraction, start.y + dy * fraction], zoom)
      const icon = L.divIcon({
        className: 'map-route-arrow',
        html: `<svg viewBox="0 0 16 16" style="transform: rotate(${angle}deg)" aria-hidden="true"><path d="M5 3l5 5-5 5"/></svg>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })
      L.marker(position, { icon, interactive: false, keyboard: false }).addTo(route)
    }
  }
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
