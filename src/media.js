import { promises as fsp } from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const videoExtensions = ['.mp4', '.webm']

export { checkFfmpeg, checkExiftool, getMedia }

async function checkFfmpeg() {
  try {
    await execFileAsync('ffmpeg', ['-version'])
  } catch(error) {
    throw new Error('FFmpeg is required and must be available in PATH')
  }
}

async function checkExiftool() {
  try {
    await execFileAsync('exiftool', ['-ver'])
  } catch(error) {
    throw new Error('ExifTool is required and must be available in PATH')
  }
}

async function getMedia(basePath) {
  const startedAt = performance.now()
  console.log(`Scanning ${basePath}`)
  let stepStartedAt = performance.now()
  const entries = await fsp.readdir(basePath, { withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile() && [...imageExtensions, ...videoExtensions].includes(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  const videoCount = files.filter((file) => videoExtensions.includes(path.extname(file.name).toLowerCase())).length
  console.log(`Found ${files.length - videoCount} photos and ${videoCount} videos`)
  console.log(`Directory scan: ${formatDuration(performance.now() - stepStartedAt)}`)
  stepStartedAt = performance.now()
  const cachePath = path.join(basePath, 'tinyslideshow')
  await fsp.mkdir(cachePath, { recursive: true })
  const filesWithHashes = await Promise.all(files.map(async (file) => {
    const filePath = path.join(basePath, file.name)
    const stat = await fsp.stat(filePath)
    const hash = createHash('sha256').update(JSON.stringify([file.name, stat.size, stat.mtimeMs])).digest('hex')
    return { name: file.name, filePath, hash }
  }))
  console.log(`File stats: ${formatDuration(performance.now() - stepStartedAt)}`)
  stepStartedAt = performance.now()
  const locations = await getGpsLocations(cachePath, filesWithHashes)
  console.log(`GPS metadata: ${formatDuration(performance.now() - stepStartedAt)}`)
  stepStartedAt = performance.now()
  const existingThumbnails = await fsp.readdir(cachePath, { withFileTypes: true })
  const currentThumbnails = new Set()
  const media = []
  let generated = 0
  let reused = 0
  let failed = 0
  let removed = 0
  let thumbnailCheckDuration = 0
  let thumbnailGenerationDuration = 0
  let progressVisible = false
  const clearProgress = () => {
    if (progressVisible) {
      process.stdout.clearLine(0)
      process.stdout.cursorTo(0)
      progressVisible = false
    }
  }
  for (const file of filesWithHashes) {
    const { filePath, hash } = file
    let operationStartedAt
    const video = videoExtensions.includes(path.extname(file.name).toLowerCase())
    const thumbnail = `${hash}.jpg`
    currentThumbnails.add(thumbnail)
    const thumbnailPath = path.join(cachePath, thumbnail)
    operationStartedAt = performance.now()
    try {
      await fsp.access(thumbnailPath)
      thumbnailCheckDuration += performance.now() - operationStartedAt
      reused++
    } catch(error) {
      thumbnailCheckDuration += performance.now() - operationStartedAt
      try {
        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          process.stdout.write(`Generating thumbnails: ${generated + failed + 1} (${media.length + 1}/${files.length} processed)`)
          progressVisible = true
        }
        operationStartedAt = performance.now()
        await execFileAsync('ffmpeg', ['-v', 'error', '-y', '-i', filePath, '-vf', 'thumbnail,scale=400:400:force_original_aspect_ratio=decrease', '-frames:v', '1', thumbnailPath])
        thumbnailGenerationDuration += performance.now() - operationStartedAt
        generated++
      } catch(error) {
        thumbnailGenerationDuration += performance.now() - operationStartedAt
        failed++
        clearProgress()
        console.error(`Could not generate thumbnail for ${file.name}: ${error.message}`)
      }
    }
    let thumbnailUrl = null
    operationStartedAt = performance.now()
    try {
      await fsp.access(thumbnailPath)
      thumbnailUrl = `tinyslideshow/${thumbnail}`
    } catch(error) {}
    thumbnailCheckDuration += performance.now() - operationStartedAt
    media.push({ name: file.name, url: encodeURIComponent(file.name), thumbnail: thumbnailUrl, video, location: locations.get(file.name) || null })
  }
  clearProgress()
  console.log(`Media and thumbnail processing: ${formatDuration(performance.now() - stepStartedAt)} (thumbnail checks: ${formatDuration(thumbnailCheckDuration)}, generation: ${formatDuration(thumbnailGenerationDuration)})`)
  stepStartedAt = performance.now()
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
  console.log(`Obsolete thumbnail cleanup: ${formatDuration(performance.now() - stepStartedAt)}`)
  console.log(`Thumbnails: ${generated} generated, ${reused} reused, ${removed} removed${failed ? `, ${failed} failed` : ''}`)
  console.log(`Media scan total: ${formatDuration(performance.now() - startedAt)}`)
  return media
}

async function getGpsLocations(cachePath, files) {
  const cacheFile = path.join(cachePath, 'gps.json')
  let previous = {}
  try {
    previous = JSON.parse(await fsp.readFile(cacheFile, 'utf8'))
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) previous = {}
  } catch(error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
  }
  const locations = new Map()
  const missing = []
  const current = Object.create(null)
  for (const file of files) {
    const cached = Object.hasOwn(previous, file.hash) ? previous[file.hash] : undefined
    if (cached === null || (Array.isArray(cached) && cached.length === 2 && Number.isFinite(cached[0]) && Number.isFinite(cached[1]) && Math.abs(cached[0]) <= 90 && Math.abs(cached[1]) <= 180)) {
      current[file.hash] = cached
      locations.set(file.name, cached)
    } else missing.push(file)
  }
  for (let offset = 0; offset < missing.length; offset += 100) {
    const batch = missing.slice(offset, offset + 100)
    const { stdout } = await execFileAsync('exiftool', ['-json', '-n', '-GPSLatitude', '-GPSLongitude', ...batch.map((file) => file.filePath)], { maxBuffer: 20 * 1024 * 1024 })
    const results = new Map(JSON.parse(stdout).map((item) => [item.SourceFile, item]))
    for (const file of batch) {
      const item = results.get(file.filePath)
      if (!item) continue
      const location = Number.isFinite(item.GPSLatitude) && Number.isFinite(item.GPSLongitude) && Math.abs(item.GPSLatitude) <= 90 && Math.abs(item.GPSLongitude) <= 180 ? [item.GPSLatitude, item.GPSLongitude] : null
      current[file.hash] = location
      locations.set(file.name, location)
    }
  }
  const removed = Object.keys(previous).filter((hash) => !Object.hasOwn(current, hash)).length
  if (missing.length || removed) {
    const temporaryFile = path.join(cachePath, `gps-${randomUUID()}.tmp`)
    try {
      await fsp.writeFile(temporaryFile, JSON.stringify(current))
      await fsp.rename(temporaryFile, cacheFile)
    } finally {
      await fsp.unlink(temporaryFile).catch((error) => { if (error.code !== 'ENOENT') throw error })
    }
  }
  console.log(`GPS cache: ${files.length - missing.length} reused, ${missing.length} read, ${removed} removed`)
  return locations
}

function formatDuration(duration) {
  return `${Math.round(duration)} ms`
}
