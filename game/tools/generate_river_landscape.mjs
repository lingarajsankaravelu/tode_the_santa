// Procedural low-poly river landscape -> public/models/river_landscape.glb
// No deps: writes glTF 2.0 binary by hand. Flat-shaded, vertex-coloured.
// Regenerate with:  node tools/generate_river_landscape.mjs

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/models/river_landscape.glb')

// ---------------------------------------------------------------- randomness
// Deterministic so the same model comes out every run.
let seed = 0x5eed1234
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0
  seed ^= seed >> 17
  seed ^= seed << 5; seed >>>= 0
  return seed / 0xffffffff
}
const rng = (a, b) => a + rnd() * (b - a)

// ------------------------------------------------------------------- colours
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const hex = (h, jitter = 0) => {
  const k = 1 + (jitter ? rng(-jitter, jitter) : 0)
  return [16, 8, 0].map((s) => srgbToLinear(Math.min(1, (((h >> s) & 255) / 255) * k)))
}

const SAND = 0xc2b280
const ROCK = 0x8a8577
// The ground beneath the snow. It is mostly not seen -- only the river bed, the
// wet bank and the steep faces that shed their snow -- so it is frozen earth
// rather than the grass it used to be. A green field showing through the gaps
// in a snowfield is worse than no gaps at all.
const EARTH = 0x6a6355
const BARK = 0x6b4a2f
const PINE = 0x2f6b3f
const PINE_LIGHT = 0x3d8a4d
const WATER = 0x3f8fd4
// SNOW and SNOW_SHADE are the mountain caps, and the ground deliberately does
// not reuse them: fields the same white as the peaks dissolve the horizon, and
// the mountains stop reading as distance. The ground pair is a little cooler
// and darker so the caps still separate from the snowfield they stand in.
const SNOW = 0xf2f4f7
const SNOW_SHADE = 0xd4e0ec
// The bright crest and the cool hollow the drift field below blends between.
// The hollow is a definite blue-grey rather than a slightly grey white: snow in
// shadow is blue, because what lights a hollow is the sky and not the sun, and
// that blue is most of what tells the eye it is looking at snow. The pair gives
// 43 levels of rendered crest-to-hollow contrast. If the fields want more form,
// this is the dial -- 0xacc1da gives 55 and 0x9fb6d2 gives 67, and nothing else
// has to change.
const GROUND_SNOW = 0xe6eef8
const GROUND_SNOW_SHADE = 0xb8cadf

// Snow does not read as snow from a flat colour the way grass reads as grass.
// The eye accepts a flat green plane as a lawn; it reads a flat white plane as
// paper. The first attempt at this recoloured the fields and relied on the
// per-face hex() jitter for texture, and that does not work: the jitter is
// high-frequency noise, and at the distance the camera sits -- every triangle
// is 37 world units against a view 2500 units deep -- it averages straight
// back to flat white. The play area makes it worse, being guaranteed dead flat
// out to FLAT_R: all 1725 basin faces share the single normal (0,-1,0), so
// there is no geometric shading there at all and colour is carrying everything.
//
// So the fields take a smooth drift field as well: broad bright crests and
// cool hollows varying over tens of units, which is the form snow actually has.
// Tuned by measurement, not by eye: these frequencies put a light-to-dark patch
// every 174 world units across X and 349 across Z, so two to four hops of
// Tode's 80 cross one. Deliberately anisotropic -- equal frequencies gave an
// even blotch, and drifts lie along a wind direction. An earlier pass used a
// third of these and put only two patches across the whole basin, which is a
// single gradient rather than snow.
// Colour only, and deliberately so -- real drifts are geometry, and raising the
// snow where Tode walks would push the ground up through his feet and break the
// flat-basin agreement Landscape.js has with WORLD_RADIUS.
const drift = (x, z) => {
  const d = 0.5
    + 0.30 * Math.sin(x * 0.38 + 0.4) * Math.cos(z * 0.32)
    + 0.13 * Math.sin(x * 0.78 - z * 0.63 + 1.1)
    + 0.07 * Math.cos(x * 1.55 + z * 1.24)
  return Math.max(0, Math.min(1, d))
}

// Blends in sRGB byte space, which is where the palette is written.
const mixHex = (a, b, t) => [16, 8, 0].reduce((out, s) => {
  const av = (a >> s) & 255
  const bv = (b >> s) & 255
  return out | (Math.round(av + (bv - av) * t) << s)
}, 0)

const snowAt = (x, z) => mixHex(GROUND_SNOW_SHADE, GROUND_SNOW, drift(x, z))

// --------------------------------------------------------------- mesh buffer
const mesh = () => ({ pos: [], nrm: [], col: [] })
const land = mesh()
const water = mesh()
const snow = mesh()

function tri (m, a, b, c, color) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  nx /= len; ny /= len; nz /= len
  for (const p of [a, b, c]) {
    m.pos.push(p[0], p[1], p[2])
    m.nrm.push(nx, ny, nz)
    m.col.push(color[0], color[1], color[2])
  }
}
const quad = (m, a, b, c, d, color) => { tri(m, a, b, c, color); tri(m, a, c, d, color) }

// A triangle carrying its own normal and colour at each corner, for a surface
// that has to read as smooth rather than faceted.
//
// This is the difference between the snow bed and the snow on the house, and it
// is why three passes of colour work never fixed the ground. tri() above gives
// every triangle one normal and one colour -- flat shading, which is the whole
// low-poly look and is right for earth and rock. On a near-white surface it is
// ruinous: each triangle takes a visibly different amount of light and you see
// every one of them, which is exactly the "triangles instead of snow" that kept
// coming back. The house's own Snow2 mesh is 11,988 vertices carrying 22,769
// triangles -- shared corners, averaged normals, a continuous surface. The snow
// bed needs the same, and since snowY() is an analytic function its normals can
// simply be evaluated rather than averaged.
function smoothTri (m, verts, normals, colors) {
  for (let i = 0; i < 3; i += 1) {
    m.pos.push(verts[i][0], verts[i][1], verts[i][2])
    m.nrm.push(normals[i][0], normals[i][1], normals[i][2])
    m.col.push(colors[i][0], colors[i][1], colors[i][2])
  }
}

// ------------------------------------------------------------------- terrain
const SIZE = 40          // half-extent of the ground plane
const GRID = 88          // cells per side
const WATER_Y = -0.55
const BANK = 2.6         // half-width of the carved channel

// The game plays on a flat plane at z = 0, so the middle of the model is
// levelled: FLAT_R is dead flat, and the hills ramp back in by BLEND_R.
// At the import scale of 100 these are 1700 and 2100 world units. The flat
// disc has to cover everywhere Tode can actually reach, not just where the
// fight starts: he hops 80 units at a time across a 40-square floor, so his
// range is 1600 from the origin. Sizing the basin to the spawn ring instead
// would leave him walking into a hillside six hops out.
const FLAT_R = 17
const BLEND_R = 21

// Centre line of the river. Pushed out past the basin so the whole channel,
// banks included, clears it: the nearest the carve ever comes to the origin
// is about 21.6, just outside BLEND_R.
const riverX = (z) => 30.5 + 1.8 * Math.sin(z * 0.17) + 0.9 * Math.sin(z * 0.071 + 1.3)

// Smoothstep from the flat basin out into the hills.
function basinWeight (x, z) {
  const r = Math.hypot(x, z)
  if (r >= BLEND_R) return 1
  if (r <= FLAT_R) return 0
  const t = (r - FLAT_R) / (BLEND_R - FLAT_R)
  return t * t * (3 - 2 * t)
}

function height (x, z) {
  // Rolling hills.
  let h = 1.5 * Math.sin(x * 0.17 + 0.6) * Math.cos(z * 0.14)
       + 0.8 * Math.sin(x * 0.31 - z * 0.23)
       + 0.4 * Math.cos(x * 0.6 + z * 0.5)
  // Lift the far edges towards the mountains.
  h += Math.max(0, (z + 12) * 0.18) ** 1.6 * 0.35
  // Carve the channel.
  const d = Math.abs(x - riverX(z))
  if (d < BANK * 2.2) {
    const t = Math.min(1, d / (BANK * 2.2))
    const carve = (1 - t * t) ** 1.5
    h = h * (1 - carve * 0.9) - carve * 1.9
  }
  return h * basinWeight(x, z)
}

// ------------------------------------------------------------------ snow bed
// A second surface lying on top of the terrain, the way the snow on the house
// is its own layer over the roof rather than a white roof.
//
// Recolouring the ground was tried first, twice, and it does not work: a flat
// white plane reads as paper however it is tinted, because what makes snow look
// like snow is a surface of its own, with its own thickness, catching the light
// at its own angles. No amount of vertex colour supplies that on a plane whose
// 1712 basin faces all share one normal.
//
// SNOW_DEPTH is how deep the snow lies. The terrain is lowered by it and the
// snow surface laid at the old terrain line, so the snow goes in *under* Tode's
// feet rather than on top of them -- the level he walks on does not move, and
// the flat-basin agreement with WORLD_RADIUS survives untouched. At the import
// scale of 41 this is 12 world units, about a foot of snow.
const SNOW_DEPTH = 0.30
// Relief in the snow surface itself, which is the thing that actually reads.
// Inside the basin it may only ever dip *below* the walk plane, and only
// slightly: Tode has no ground-following, so every unit of hollow is a unit he
// hovers over. 0.06 is 2.5 world units, against his 102 units of height.
// Outside FLAT_R he cannot go at all -- WORLD_RADIUS is exactly the basin edge
// -- so the drifts out there are free to be real geometry, and they are most of
// what the camera actually sees.
const SNOW_RELIEF_BASIN = 0.06
const SNOW_RELIEF_HILLS = 0.55

// Snow does not lie on water, and it slides off anything steep -- which is what
// leaves the rock faces bare and gives the hills back their shape. Without this
// the snow layer would shrink-wrap the terrain and lose every silhouette on it.
function snowCover (x, z) {
  const d = Math.abs(x - riverX(z))
  if (d < BANK * 1.9) return 0
  const e = 0.35
  const slope = Math.hypot(height(x + e, z) - height(x - e, z),
                           height(x, z + e) - height(x, z - e)) / (2 * e)
  const edge = Math.min(1, (d - BANK * 1.9) / (BANK * 0.9))
  return Math.max(0, edge * (1 - Math.min(1, slope / 1.1)))
}

// Below this much cover the snow is not drawn at all, rather than drawn as a
// film too thin to win a depth test. 0.12 of SNOW_DEPTH is 1.5 world units of
// snow, which is the thinnest edge worth keeping: measured against the depth
// buffer it is 37 times the resolution at the far edge of the map, where the
// faces that were failing had thinned to under one unit. Belt and braces with
// Camera.js's near plane -- that fix alone is enough, but a surface this large
// should not be relying on a single setting elsewhere to stay visible.
const COVER_MIN = 0.12

// Soft lumps in the surface, on a wavelength of about 3.1 model units -- three
// and a bit grid cells, so the grid can actually resolve them.
//
// This replaces a near-random per-vertex value at a wavelength BELOW one cell.
// That aliased into something different at every corner, which was the right
// idea for a faceted surface and the wrong one here: nothing smaller than a
// cell can be shaded smoothly, because there are no vertices in between to
// carry the curve. Band-limited, it reads as lumpy snow; sub-cell, it read as
// triangles.
const lumps = (x, z) => 0.5 + 0.5 * Math.sin(x * 2.1 + 1.7) * Math.cos(z * 1.9 - 0.6)

// Where the snow is drawn, with single-cell holes filled in. A lone bare cell
// in the middle of a snowfield is not rock showing through, it is a stray
// earth-coloured triangle in a white field -- which is the exact artifact this
// pass exists to remove, so it is not left to chance. Two of them appeared at
// COVER_MIN before this went in.
const GRID_STEP = (SIZE * 2) / GRID
function snowHere (x, z) {
  if (snowCover(x, z) >= COVER_MIN) return true

  let neighbours = 0
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (snowCover(x + dx * GRID_STEP, z + dz * GRID_STEP) >= COVER_MIN) neighbours += 1
  }

  return neighbours >= 3
}

// The terrain, dropped by the depth of the snow now sitting on it.
const landY = (x, z) => height(x, z) - SNOW_DEPTH

function snowY (x, z) {
  // Inside the snow region the thickness has a floor, so a filled hole or a
  // boundary vertex cannot end up as a film too thin to win a depth test.
  // Outside it the raw value stands, so the surface still tapers into the land
  // rather than ending on a step.
  const raw = snowCover(x, z)
  const cover = snowHere(x, z) ? Math.max(COVER_MIN, raw) : raw
  const amp = SNOW_RELIEF_BASIN +
    (SNOW_RELIEF_HILLS - SNOW_RELIEF_BASIN) * basinWeight(x, z)
  // Both terms are subtracted, so the surface can never rise above the old
  // terrain line. That is what keeps the basin a floor rather than a hazard.
  const dip = (1 - drift(x, z)) + 0.18 * lumps(x, z)
  // Tapers to nothing as cover falls away, so the snow thins out at the water's
  // edge and on the rock instead of ending in a cliff that needs a side wall.
  return height(x, z) - SNOW_DEPTH * (1 - cover) - amp * dip * cover
}

// The surface is y = snowY(x, z), so its normal is (-dy/dx, 1, -dy/dz).
// Evaluated rather than averaged from the faces: the function is analytic, and
// a central difference over a fifth of a cell is both cheaper and smoother than
// collecting the neighbours of every vertex.
const SNOW_EPS = 0.18
function snowNormal (x, z) {
  const dydx = (snowY(x + SNOW_EPS, z) - snowY(x - SNOW_EPS, z)) / (2 * SNOW_EPS)
  const dydz = (snowY(x, z + SNOW_EPS) - snowY(x, z - SNOW_EPS)) / (2 * SNOW_EPS)
  const len = Math.hypot(dydx, 1, dydz)

  return [-dydx / len, 1 / len, -dydz / len]
}

const gridX = (i) => -SIZE + (i / GRID) * SIZE * 2
const landPt = (i, j) => { const x = gridX(i), z = gridX(j); return [x, landY(x, z), z] }
const snowPt = (i, j) => { const x = gridX(i), z = gridX(j); return [x, snowY(x, z), z] }

for (let i = 0; i < GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    // Split each cell on alternating diagonals: breaks up the grid read.
    const diag = (i + j) % 2

    // --- the ground, which is now mostly underneath the snow ---
    const a = landPt(i, j), b = landPt(i + 1, j)
    const c = landPt(i + 1, j + 1), d = landPt(i, j + 1)
    const faces = diag ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]
    for (const f of faces) {
      const my = (f[0][1] + f[1][1] + f[2][1]) / 3
      const mx = (f[0][0] + f[1][0] + f[2][0]) / 3
      const mz = (f[0][2] + f[1][2] + f[2][2]) / 3
      const dist = Math.abs(mx - riverX(mz))
      // Measured against the terrain line, not the lowered surface: these two
      // thresholds were chosen against height() and the whole grid now sits
      // SNOW_DEPTH below it, which would quietly widen the river bed and shrink
      // the high ground by that much.
      const hy = my + SNOW_DEPTH
      // Earth tones throughout. This surface is seen only where the snow is
      // not: the river bed, the wet bank, and the faces too steep to hold it.
      let base = EARTH
      if (hy < WATER_Y + 0.35 && dist < BANK * 2.4) base = SAND          // riverbed
      else if (dist < BANK * 2.9) base = rnd() < 0.4 ? SAND : EARTH      // banks
      else if (hy > 2.2) base = rnd() < 0.5 ? ROCK : EARTH               // high ground
      tri(land, f[0], f[1], f[2], hex(base, 0.09))
    }

    // --- the snow lying on it ---
    // Each corner carries its own position, normal and colour, so the four
    // triangles meeting at a vertex all agree there and the surface shades as
    // one piece. No per-face colour jitter either: a jitter is a discontinuity
    // at every edge, and it would draw the triangles back in just as clearly as
    // a per-face normal does.
    const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([ci, cj]) => {
      const x = gridX(ci), z = gridX(cj)

      return { p: [x, snowY(x, z), z], n: snowNormal(x, z), c: hex(snowAt(x, z)) }
    })
    const [sa, sb, sc, sd] = corners
    // Wound the opposite way round to the land, so the winding agrees with the
    // normals above. The land grid's all point down and survive only because
    // its material is doubleSided; the surface the whole scene is lit through
    // should not be relying on that.
    const sfaces = diag ? [[sa, sc, sb], [sa, sd, sc]] : [[sa, sd, sb], [sb, sd, sc]]
    for (const f of sfaces) {
      const mx = (f[0].p[0] + f[1].p[0] + f[2].p[0]) / 3
      const mz = (f[0].p[2] + f[1].p[2] + f[2].p[2]) / 3
      // No face at all where the snow has tapered away, rather than a
      // degenerate one lying in the ground z-fighting it.
      if (!snowHere(mx, mz)) continue
      smoothTri(snow, f.map((v) => v.p), f.map((v) => v.n), f.map((v) => v.c))
    }
  }
}

// --------------------------------------------------------------------- water
// A ribbon that follows the channel, slightly rippled, sitting above the bed.
const WSTEPS = 80
for (let s = 0; s < WSTEPS; s++) {
  const z0 = -SIZE + (s / WSTEPS) * SIZE * 2
  const z1 = -SIZE + ((s + 1) / WSTEPS) * SIZE * 2
  const w = BANK * 1.45
  const ripple = (x, z) => WATER_Y + 0.05 * Math.sin(x * 1.7 + z * 2.3) + 0.04 * Math.sin(z * 0.9)
  const x0l = riverX(z0) - w, x0r = riverX(z0) + w
  const x1l = riverX(z1) - w, x1r = riverX(z1) + w
  quad(water,
    [x0l, ripple(x0l, z0), z0],
    [x0r, ripple(x0r, z0), z0],
    [x1r, ripple(x1r, z1), z1],
    [x1l, ripple(x1l, z1), z1],
    hex(WATER, 0.06))
}

// ------------------------------------------------------------------- helpers
function cone (m, cx, cz, baseY, radius, h, seg, color, jitter = 0.12) {
  const apex = [cx + rng(-jitter, jitter), baseY + h, cz + rng(-jitter, jitter)]
  const ring = []
  const off = rnd() * Math.PI * 2
  for (let i = 0; i < seg; i++) {
    const a = off + (i / seg) * Math.PI * 2
    const r = radius * (1 + rng(-jitter, jitter))
    ring.push([cx + Math.cos(a) * r, baseY, cz + Math.sin(a) * r])
  }
  for (let i = 0; i < seg; i++) {
    const p = ring[i], q = ring[(i + 1) % seg]
    tri(m, p, q, apex, hex(color, 0.08))
    tri(m, ring[0], q, p, hex(color, 0.08)) // underside, keeps it watertight
  }
}

function prism (m, cx, cz, baseY, radius, h, seg, color) {
  const ring = (y, r) => {
    const out = []
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2
      out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r])
    }
    return out
  }
  const lo = ring(baseY, radius), hi = ring(baseY + h, radius * 0.78)
  for (let i = 0; i < seg; i++) {
    const n = (i + 1) % seg
    quad(m, lo[i], lo[n], hi[n], hi[i], hex(color, 0.1))
  }
  for (let i = 1; i < seg - 1; i++) tri(m, hi[0], hi[i], hi[i + 1], hex(color, 0.1))
}

function rock (m, cx, cy, cz, r, color) {
  // Jittered octahedron: six verts, eight faces, unmistakably low-poly.
  const j = () => r * rng(0.55, 1.35)
  const v = [[cx, cy + j(), cz], [cx, cy - j() * 0.5, cz],
             [cx + j(), cy, cz], [cx - j(), cy, cz],
             [cx, cy, cz + j()], [cx, cy, cz - j()]]
  const faces = [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]]
  for (const [a, b, c] of faces) tri(m, v[a], v[b], v[c], hex(color, 0.12))
}

function mountain (m, cx, cz, baseY, radius, h, seg) {
  // Stacked rings instead of a plain cone: the snow line can then follow the
  // faces, and every column keeps its own silhouette.
  const levels = [0, 0.26, 0.48, 0.68, 0.85, 1]
  const angOff = rnd() * Math.PI * 2
  const colAng = [], colR = [], colSnow = []
  for (let i = 0; i < seg; i++) {
    colAng.push(angOff + (i / seg) * Math.PI * 2 + rng(-0.16, 0.16))
    colR.push(1 + rng(-0.22, 0.22))     // per-column width, gives angular ridges
    colSnow.push(rng(-0.09, 0.09) * h)  // per-column snow line, gives a ragged edge
  }
  const snowLine = baseY + h * rng(0.34, 0.46)

  const ring = (t) => {
    const out = []
    // Stays broad on the way up and still has width at the top, so the
    // summit reads as a blunt crag rather than a spike.
    const rr = radius * (1 - 0.82 * t ** 1.45)
    for (let i = 0; i < seg; i++) {
      out.push([
        cx + Math.cos(colAng[i]) * rr * colR[i],
        baseY + h * t + rng(-0.12, 0.12) * h * 0.14,
        cz + Math.sin(colAng[i]) * rr * colR[i]
      ])
    }
    return out
  }

  const rings = levels.map(ring)
  // Summit sits only a little above the top ring, and off-centre, so the
  // peak is a tilted plateau with a bit of crag to it.
  const top = rings[rings.length - 1]
  const apex = [
    cx + rng(-radius * 0.1, radius * 0.1),
    baseY + h + rng(0.05, 0.3),
    cz + rng(-radius * 0.1, radius * 0.1)
  ]

  const faceColor = (y, i) => {
    const line = snowLine + colSnow[i]
    if (y > line + h * 0.06) return hex(rnd() < 0.78 ? SNOW : SNOW_SHADE, 0.05)
    if (y > line - h * 0.06) return hex(rnd() < 0.5 ? SNOW_SHADE : ROCK, 0.1) // patchy transition
    return hex(ROCK, 0.14)
  }

  for (let l = 0; l < rings.length - 1; l++) {
    const lo = rings[l], hi = rings[l + 1]
    for (let i = 0; i < seg; i++) {
      const n = (i + 1) % seg
      // Split the quad so each triangle can take the snow line separately.
      tri(m, lo[i], lo[n], hi[n], faceColor((lo[i][1] + lo[n][1] + hi[n][1]) / 3, i))
      tri(m, lo[i], hi[n], hi[i], faceColor((lo[i][1] + hi[n][1] + hi[i][1]) / 3, i))
    }
  }
  for (let i = 0; i < seg; i++) {
    const n = (i + 1) % seg
    tri(m, top[i], top[n], apex, faceColor(apex[1], i))
  }
  // Cap the base so the silhouette stays solid from low angles.
  for (let i = 1; i < seg - 1; i++) tri(m, rings[0][0], rings[0][i + 1], rings[0][i], hex(ROCK, 0.1))
}

function pine (m, x, z) {
  const y = snowY(x, z)
  const th = rng(0.55, 0.95)
  prism(m, x, z, y - 0.15, rng(0.1, 0.16), th, 5, BARK)
  const tiers = 3
  let ty = y + th * 0.75
  let r = rng(0.85, 1.25)
  let hgt = rng(1.0, 1.4)
  for (let t = 0; t < tiers; t++) {
    cone(m, x, z, ty, r, hgt, 6, t === 0 ? PINE : PINE_LIGHT)
    ty += hgt * 0.52
    r *= 0.72
    hgt *= 0.85
  }
}

// ------------------------------------------------------------------ scatters
const nearRiver = (x, z) => Math.abs(x - riverX(z)) < BANK * 2.9
const inBounds = (x, z) => Math.abs(x) < SIZE - 1 && Math.abs(z) < SIZE - 1
// Nothing is planted inside the play area, or on the ramp out of it.
const inBasin = (x, z) => Math.hypot(x, z) < BLEND_R + 1.5

// Pines on the grass, clear of the banks.
for (let n = 0, guard = 0; n < 110 && guard < 14000; guard++) {
  const x = rng(-SIZE + 2, SIZE - 2), z = rng(-SIZE + 2, SIZE - 8)
  if (inBasin(x, z) || nearRiver(x, z) || height(x, z) < WATER_Y + 0.6) continue
  pine(land, x, z); n++
}

// Rocks hugging the water line.
for (let n = 0, guard = 0; n < 55 && guard < 7000; guard++) {
  const z = rng(-SIZE + 1, SIZE - 1)
  const side = rnd() < 0.5 ? -1 : 1
  const x = riverX(z) + side * rng(BANK * 1.2, BANK * 2.3)
  if (!inBounds(x, z)) continue
  // On whichever is higher: snow where it lies, bare bank where it does not.
  const y = Math.max(snowY(x, z), landY(x, z))
  rock(land, x, y + rng(0.0, 0.15), z, rng(0.18, 0.45), ROCK); n++
}

// A few boulders standing in the stream.
for (let n = 0, guard = 0; n < 7 && guard < 500; guard++) {
  const z = rng(-SIZE + 2, SIZE - 2)
  const x = riverX(z) + rng(-BANK * 0.7, BANK * 0.7)
  rock(land, x, WATER_Y + rng(-0.05, 0.2), z, rng(0.2, 0.38), ROCK); n++
}

// No wildflowers. There were 170 of them in purple and yellow, which is the
// single most obviously wrong thing in a snowfield, and the flower() builder
// went with them rather than being left behind unused.

// Angular snow-capped mountains along the far edge.
for (let i = 0; i < 14; i++) {
  const x = -SIZE + (i + rng(0.1, 0.9)) * (SIZE * 2 / 14)
  const z = -SIZE - rng(1.5, 7)
  mountain(land, x, z, rng(-0.5, 0.8), rng(4.2, 6.6), rng(6, 9.5), rnd() < 0.5 ? 6 : 7)
}
// A second range beyond the river, so the far bank has a horizon of its own.
for (let i = 0; i < 7; i++) {
  const z = -SIZE + (i + rng(0.1, 0.9)) * (SIZE * 2 / 7)
  const x = SIZE + rng(1.5, 6)
  mountain(land, x, z, rng(-0.5, 0.8), rng(3.8, 5.8), rng(5.5, 8.5), rnd() < 0.5 ? 6 : 7)
}

// ---------------------------------------------------------------- glb writer
const chunks = []
let byteLength = 0
const addView = (floats) => {
  const buf = Buffer.alloc(floats.length * 4)
  floats.forEach((v, i) => buf.writeFloatLE(v, i * 4))
  const offset = byteLength
  chunks.push(buf)
  byteLength += buf.length
  const pad = (4 - (byteLength % 4)) % 4
  if (pad) { chunks.push(Buffer.alloc(pad)); byteLength += pad }
  return { offset, length: buf.length }
}

const json = { asset: { version: '2.0', generator: 'tod_the_frog procedural low-poly' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'RiverLandscape' }],
  meshes: [{ name: 'RiverLandscape', primitives: [] }],
  materials: [], accessors: [], bufferViews: [], buffers: [] }

// Roughness is a flat 1, not 0.95. At 0.95 a near-white surface this large
// keeps a broad specular sheen, and it is why the snowfield read as glossy
// white plastic next to the house, whose own Snow2 material is roughness 1.
// There is no sun disc in this scene to catch a highlight, so the sheen buys
// nothing and costs the matte surface snow needs.
json.materials.push({ name: 'Landscape', doubleSided: true,
  pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } })
json.materials.push({ name: 'Water', doubleSided: true, alphaMode: 'BLEND',
  pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 0.78], metallicFactor: 0.05, roughnessFactor: 0.15 } })
// Roughness a flat 1, like the house's own Snow2 material. At 0.95 a near-white
// surface this large keeps a broad specular sheen, and that sheen is why the
// first attempt read as glossy white plastic. There is no sun disc in this
// scene for a highlight to catch, so it buys nothing.
json.materials.push({ name: 'Snow', doubleSided: true,
  pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1 } })

function addPrimitive (m, material) {
  const attrs = {}
  for (const [name, data, typed] of [['POSITION', m.pos, true], ['NORMAL', m.nrm, false], ['COLOR_0', m.col, false]]) {
    const { offset, length } = addView(data)
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: length, target: 34962 })
    const acc = { bufferView: json.bufferViews.length - 1, componentType: 5126, count: data.length / 3, type: 'VEC3' }
    if (typed) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < data.length; i += 3) for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], data[i + k]); max[k] = Math.max(max[k], data[i + k])
      }
      acc.min = min; acc.max = max
    }
    json.accessors.push(acc)
    attrs[name] = json.accessors.length - 1
  }
  json.meshes[0].primitives.push({ attributes: attrs, material, mode: 4 })
}

addPrimitive(land, 0)
addPrimitive(water, 1)
addPrimitive(snow, 2)

const bin = Buffer.concat(chunks)
json.buffers.push({ byteLength: bin.length })

let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
const jpad = (4 - (jsonBuf.length % 4)) % 4
if (jpad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)])

const header = Buffer.alloc(12)
header.write('glTF', 0, 'ascii')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8)
const chunkHdr = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4, 'ascii'); return b }

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, Buffer.concat([
  header,
  chunkHdr(jsonBuf.length, 'JSON'), jsonBuf,
  chunkHdr(bin.length, 'BIN\0'), bin
]))

const tris = (land.pos.length + water.pos.length + snow.pos.length) / 9
console.log(`wrote ${OUT}`)
console.log(`  ${tris} triangles, ${(12 + 8 + jsonBuf.length + 8 + bin.length / 1)} bytes`)
console.log(`  snow layer: ${snow.pos.length / 9} triangles`)
