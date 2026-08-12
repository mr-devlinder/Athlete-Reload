import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

async function filesBelow(directory, extensions) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path, extensions) : extensions.has(extname(path)) ? [path] : []
  }))
  return nested.flat()
}

const cssFiles = await filesBelow('src', new Set(['.css']))
const jsxFiles = await filesBelow('src', new Set(['.js', '.jsx']))
const selectors = new Map()
const declarations = new Map()
const cssClasses = new Set()
const jsxClasses = new Set()
const dynamicClasses = []

for (const file of cssFiles) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ')
    const body = match[2].trim().replace(/\s+/g, ' ')
    if (!selector || selector.startsWith('@')) continue
    selectors.set(selector, [...(selectors.get(selector) ?? []), relative('.', file)])
    if (body) declarations.set(body, [...(declarations.get(body) ?? []), selector])
    for (const classMatch of selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) cssClasses.add(classMatch[1])
  }
}

for (const file of jsxFiles) {
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/className\s*=\s*["']([^"']+)["']/g)) match[1].split(/\s+/).forEach((name) => jsxClasses.add(name))
  if (/className\s*=\s*\{/.test(source)) dynamicClasses.push(relative('.', file))
}

const repeated = (map) => [...map].filter(([, locations]) => locations.length > 1)
console.log(JSON.stringify({
  duplicateSelectors: repeated(selectors),
  exactDuplicateDeclarations: repeated(declarations),
  cssClassesNotFoundStaticallyInJsx: [...cssClasses].filter((name) => !jsxClasses.has(name)).sort(),
  jsxStaticClassesWithoutCssSelector: [...jsxClasses].filter((name) => !cssClasses.has(name)).sort(),
  filesWithDynamicClasses: dynamicClasses,
  note: 'Dynamic class names are reported separately and must be reviewed manually; this script never deletes CSS.',
}, null, 2))
