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
  console.log(`Scanning ${basePath}`)
  const entries = await fsp.readdir(basePath, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && [...imageExtensions, ...videoExtensions].includes(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  const videoCount = files.filter((file) => videoExtensions.includes(path.extname(file.name).toLowerCase())).length
  console.log(`Found ${files.length - videoCount} photos and ${videoCount} videos`)
  const cachePath = path.join(basePath, 'tinyslideshow')
  await fsp.mkdir(cachePath, { recursive: true })
  const existingThumbnails = await fsp.readdir(cachePath, { withFileTypes: true })
  const currentThumbnails = new Set()
  const media = []
  let generated = 0
  let reused = 0
  let failed = 0
  let removed = 0
  let progressVisible = false
  const clearProgress = () => {
    if (progressVisible) {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      progressVisible = false
    }
  }
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
      reused++
    } catch(error) {
      try {
        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          process.stdout.write(`Generating thumbnails: ${generated + failed + 1} (${media.length + 1}/${files.length} processed)`)
          progressVisible = true
        }
        await execFileAsync('ffmpeg', ['-v', 'error', '-y', '-i', filePath, '-vf', 'thumbnail,scale=400:400:force_original_aspect_ratio=decrease', '-frames:v', '1', thumbnailPath])
        generated++
      } catch(error) {
        failed++
        clearProgress()
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
        removed++
      } catch(error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
  }
  clearProgress()
  console.log(`Thumbnails: ${generated} generated, ${reused} reused, ${removed} removed${failed ? `, ${failed} failed` : ''}`)
  return media
}
