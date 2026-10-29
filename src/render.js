import { promises as fsp } from 'fs'
import path from 'path'
import { getMedia } from './media.js'

export { renderPage }

async function renderPage(basePath) {
  const [html, css, js, media] = await Promise.all([
    fsp.readFile(path.join(import.meta.dirname, 'ui/index.html'), 'utf8'),
    fsp.readFile(path.join(import.meta.dirname, 'ui/style.css'), 'utf8'),
    fsp.readFile(path.join(import.meta.dirname, 'ui/app.js'), 'utf8'),
    getMedia(basePath),
  ])
  const data = JSON.stringify({ name: path.basename(basePath), media }).replace(/</g, '\\u003c')
  return html.replace('{{ css }}', () => css).replace('{{ data }}', () => data).replace('{{ js }}', () => js)
}
