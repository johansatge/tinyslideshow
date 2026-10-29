import fs from 'fs'
import { promises as fsp } from 'fs'
import http from 'http'
import path from 'path'
import { renderPage } from './render.js'

export { createServer }

const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' }

function createServer({ basePath, httpPort }) {
  return http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end()
        return
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      if (pathname === '/') {
        const html = await renderPage(basePath)
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        response.end(request.method === 'HEAD' ? undefined : html)
        return
      }
      const filePath = await fsp.realpath(path.join(basePath, pathname))
      if (!filePath.startsWith(basePath + path.sep)) {
        response.writeHead(403).end()
        return
      }
      const stat = await fsp.stat(filePath)
      const type = types[path.extname(filePath).toLowerCase()]
      if (!stat.isFile() || !type) {
        response.writeHead(404).end()
        return
      }
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache',
      })
      if (request.method === 'HEAD' || stat.size === 0) response.end()
      else fs.createReadStream(filePath).on('error', () => response.destroy()).pipe(response)
    } catch(error) {
      if (!response.headersSent) response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Unable to serve resource')
      else response.destroy()
    }
  })
}
