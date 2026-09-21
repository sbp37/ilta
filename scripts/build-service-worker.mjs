import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

async function files(dir, prefix = '') {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name
    if (entry.isDirectory()) result.push(...(await files(join(dir, entry.name), `${path}/`)))
    else if (path !== 'sw.js') result.push(path === 'index.html' ? './' : path)
  }
  return result.sort()
}

const paths = await files('dist')
const source = await readFile('public/sw.js', 'utf8')
const hash = createHash('sha256').update(source)
for (const path of paths) hash.update(await readFile(join('dist', path === './' ? 'index.html' : path)))
await writeFile(
  'dist/sw.js',
  source
    .replace('__ILTA_BUILD__', hash.digest('hex').slice(0, 16))
    .replace('[] // BUILD_ASSETS', JSON.stringify(paths)),
)
