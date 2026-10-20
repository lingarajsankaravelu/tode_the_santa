// Rewrites a .glb's materials from KHR_materials_pbrSpecularGlossiness to
// plain metallic-roughness, in place.
//
// Why this exists: winter_country_house.glb is a Sketchfab export whose 31
// materials all keep their colour in
// `extensions.KHR_materials_pbrSpecularGlossiness.diffuseFactor`, with no
// `baseColorFactor` anywhere, and the extension listed in extensionsRequired.
// three.js removed support for that extension, so GLTFLoader quietly falls
// back to a default metallic-roughness material -- and the glTF default for
// baseColorFactor is opaque white. The result is a house, a well, trees and a
// snowman rendered entirely white, with the colours sitting unread in the file.
//
// Converting offline rather than at load time keeps the fix out of the render
// path and makes it inspectable: run it once, commit the result, and the game
// just loads a normal glTF.
//
// Usage:  node tools/convert_specular_glossiness.mjs public/models/<file>.glb

import { readFileSync, writeFileSync } from 'node:fs'

const EXTENSION = 'KHR_materials_pbrSpecularGlossiness'
const JSON_CHUNK = 0x4e4f534a
const MAGIC = 0x46546c67

const path = process.argv[2]

if (!path) {
  console.error('usage: node tools/convert_specular_glossiness.mjs <file.glb>')
  process.exit(1)
}

const file = readFileSync(path)

if (file.readUInt32LE(0) !== MAGIC) {
  console.error(`${path}: not a .glb`)
  process.exit(1)
}

// Walk the chunk table rather than assuming JSON-then-BIN. The spec allows
// other chunks, and a wrong guess here corrupts the mesh data silently.
const chunks = []
let offset = 12

while (offset < file.length) {
  const length = file.readUInt32LE(offset)
  const type = file.readUInt32LE(offset + 4)

  chunks.push({ type, data: file.subarray(offset + 8, offset + 8 + length) })
  offset += 8 + length
}

const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK)
const gltf = JSON.parse(jsonChunk.data.toString('utf8'))

let converted = 0

for (const material of gltf.materials ?? []) {
  const spec = material.extensions?.[EXTENSION]

  if (!spec) continue

  const diffuse = spec.diffuseFactor ?? [1, 1, 1, 1]
  // Glossiness and roughness are opposites, and that is the whole mapping.
  // Specular colour has no metallic-roughness equivalent; every material in
  // this model has specularFactor [0,0,0], so nothing is lost by dropping it.
  const glossiness = spec.glossinessFactor ?? 1

  material.pbrMetallicRoughness = {
    ...material.pbrMetallicRoughness,
    baseColorFactor: diffuse,
    // Nothing in this model is a metal surface, and leaving the glTF default
    // of 1.0 would render every material as a black mirror under the scene's
    // two lights.
    metallicFactor: 0,
    roughnessFactor: 1 - glossiness,
  }

  delete material.extensions[EXTENSION]
  if (Object.keys(material.extensions).length === 0) delete material.extensions

  converted += 1
}

// The extension has to come out of both lists too. Left in extensionsRequired,
// a strict loader is entitled to refuse the file outright.
for (const list of ['extensionsUsed', 'extensionsRequired']) {
  if (!gltf[list]) continue

  gltf[list] = gltf[list].filter((name) => name !== EXTENSION)
  if (gltf[list].length === 0) delete gltf[list]
}

// Chunks are 4-byte aligned; JSON pads with spaces, binary with zeroes.
const rebuilt = chunks.map((chunk) => {
  const body =
    chunk.type === JSON_CHUNK ? Buffer.from(JSON.stringify(gltf), 'utf8') : chunk.data
  const padding = (4 - (body.length % 4)) % 4
  const header = Buffer.alloc(8)

  header.writeUInt32LE(body.length + padding, 0)
  header.writeUInt32LE(chunk.type, 4)

  return Buffer.concat([
    header,
    body,
    Buffer.alloc(padding, chunk.type === JSON_CHUNK ? 0x20 : 0x00),
  ])
})

const header = Buffer.alloc(12)
const total = 12 + rebuilt.reduce((sum, chunk) => sum + chunk.length, 0)

header.writeUInt32LE(MAGIC, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(total, 8)

writeFileSync(path, Buffer.concat([header, ...rebuilt]))

console.log(`${path}: converted ${converted} materials, ${file.length} -> ${total} bytes`)
