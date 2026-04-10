const fs = require('node:fs')
const path = require('node:path')

const distDir = path.join(process.cwd(), '.next')
const buildManifestPath = path.join(distDir, 'build-manifest.json')
const fallbackManifestPath = path.join(distDir, 'fallback-build-manifest.json')

if (!fs.existsSync(distDir)) {
  process.exit(0)
}

if (fs.existsSync(fallbackManifestPath)) {
  process.exit(0)
}

if (!fs.existsSync(buildManifestPath)) {
  process.exit(0)
}

const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'))

const fallbackManifest = {
  ...buildManifest,
  pages: {
    '/_app': buildManifest?.pages?.['/_app'] ?? [],
    '/_error': buildManifest?.pages?.['/_error'] ?? [],
  },
}

fs.writeFileSync(fallbackManifestPath, JSON.stringify(fallbackManifest, null, 2))
console.log(`[ensure-fallback-build-manifest] Created ${fallbackManifestPath}`)
