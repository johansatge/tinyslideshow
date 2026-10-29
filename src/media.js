import { promises as fsp } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const videoExtensions = ['.mp4', '.webm']

export { checkFfmpeg, getMedia }

async function checkFfmpeg() {
  try {
    await execFileAsync('ffmpeg', ['-version'])
  } catch(error) {
    throw new Error('FFmpeg is required and must be available in PATH')
  }
}

async function getMedia(basePath) {
  const entries = await fsp.readdir(basePath, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && [...imageExtensions, ...videoExtensions].includes(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  const cachePath = path.join(basePath, 'tinyslideshow')
  await fsp.mkdir(cachePath, { recursive: true })
  const existingThumbnails = await fsp.readdir(cachePath, { withFileTypes: true })
  const currentThumbnails = new Set()
  const media = []
  for (const file of files) {
    const filePath = path.join(basePath, file.name)
    const stat = await fsp.stat(filePath)
    const video = videoExtensions.includes(path.extname(file.name).toLowerCase())
    const hash = createHash('sha256').update(JSON.stringify([file.name, stat.size, stat.mtimeMs])).digest('hex')
    const thumbnail = `${hash}.jpg`
    currentThumbnails.add(thumbnail)
    const thumbnailPath = path.join(cachePath, thumbnail)
    try {
      await fsp.access(thumbnailPath)
    } catch(error) {
      try {
        await execFileAsync('ffmpeg', ['-v', 'error', '-y', '-i', filePath, '-vf', 'thumbnail,scale=400:400:force_original_aspect_ratio=decrease', '-frames:v', '1', thumbnailPath])
      } catch(error) {
        console.error(`Could not generate thumbnail for ${file.name}: ${error.message}`)
      }
    }
    let thumbnailUrl = null
    try {
      await fsp.access(thumbnailPath)
      thumbnailUrl = `tinyslideshow/${thumbnail}`
    } catch(error) {}
    media.push({ name: file.name, url: encodeURIComponent(file.name), thumbnail: thumbnailUrl, video })
  }
  for (const thumbnail of existingThumbnails) {
    if (thumbnail.isFile() && /^[a-f0-9]{64}\.jpg$/.test(thumbnail.name) && !currentThumbnails.has(thumbnail.name)) {
      try {
        await fsp.unlink(path.join(cachePath, thumbnail.name))
      } catch(error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
  }
  return media
}
