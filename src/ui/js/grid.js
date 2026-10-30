function createGrid({ name, media, onOpenMedia }) {
  const folder = document.querySelector('#folder')
  const count = document.querySelector('#count')
  const grid = document.querySelector('#grid')

  folder.textContent = name
  document.title = name + ' — Tiny Slideshow'
  count.textContent = `${media.length} items`
  document.querySelector('#empty').hidden = media.length !== 0
  media.forEach((item, itemIndex) => {
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
    button.addEventListener('click', () => onOpenMedia(itemIndex))
    grid.append(button)
  })
}
