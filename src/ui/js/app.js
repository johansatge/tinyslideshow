const viewer = createViewer({
  media: slideshow.media,
  onOpenMap: (index) => map.open(index),
  isMapOpen: () => map.isOpen(),
})
const map = createMap({
  media: slideshow.media,
  isViewerOpen: () => viewer.isOpen(),
  pauseViewer: () => viewer.pause(),
  onOpenMedia: (index) => viewer.open(index),
})
createGrid({ name: slideshow.name, media: slideshow.media, onOpenMedia: (index) => viewer.open(index) })
createControls({ viewer, map })
