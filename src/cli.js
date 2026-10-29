#!/usr/bin/env node

import { promises as fsp } from 'fs'
import path from 'path'
import { createInterface } from 'readline/promises'
import { stdin, stdout } from 'process'
import { checkFfmpeg, checkExiftool } from './media.js'
import { renderPage } from './render.js'
import { createServer } from './server.js'

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: tinyslideshow [folder] [port] [--static] [--overwrite]')
    return
  }
  if (args.includes('--version')) {
    console.log('1.0.0')
    return
  }
  const staticMode = args.includes('--static')
  const overwrite = args.includes('--overwrite')
  const positional = args.filter((arg) => !arg.startsWith('--'))
  if (args.some((arg) => arg.startsWith('--') && !['--static', '--overwrite'].includes(arg)) || positional.length > 2 || (staticMode && positional.length > 1) || (overwrite && !staticMode)) {
    throw new Error('Invalid arguments. Use --help for usage.')
  }
  const basePath = await fsp.realpath(path.resolve(positional[0] || '.'))
  if (!(await fsp.stat(basePath)).isDirectory()) throw new Error('The path must be a directory')
  await checkFfmpeg()
  await checkExiftool()
  if (staticMode) {
    const outputPath = path.join(basePath, 'tinyslideshow.html')
    let exists = false
    try { await fsp.access(outputPath); exists = true } catch(error) {}
    if (exists && !overwrite) {
      if (!stdin.isTTY) throw new Error('tinyslideshow.html already exists; use --overwrite to replace it')
      const prompt = createInterface({ input: stdin, output: stdout })
      const answer = await prompt.question('Replace tinyslideshow.html? [y/N] ')
      prompt.close()
      if (!/^y(es)?$/i.test(answer.trim())) return
    }
    await fsp.writeFile(outputPath, await renderPage(basePath))
    console.log(`Generated ${outputPath}`)
    return
  }
  const httpPort = Number(positional[1] || 9080)
  if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) throw new Error('Invalid port number')
  const server = createServer({ basePath, httpPort })
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
  server.listen(httpPort, '0.0.0.0', () => console.log(`Serving ${basePath} at http://localhost:${httpPort} (available on the local network)`))
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
