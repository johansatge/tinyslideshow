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
