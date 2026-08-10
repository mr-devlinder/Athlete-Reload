import { readdir, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const limits = { '.css': 170_000, '.js': 850_000, '.png': 550_000 }
const failures = []

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await visit(path)
    else {
      const extension = extname(entry.name)
      const limit = limits[extension]
      if (!limit) continue
      const { size } = await stat(path)
      if (size > limit) failures.push(`${relative(root, path)} is ${size} bytes; limit is ${limit}`)
    }
  }
}

await visit(root)
if (failures.length) {
  console.error(`Bundle budget failed:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('Bundle budgets passed.')
