import {
  Group,
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  Mesh,
  CanvasTexture,
  SRGBColorSpace,
  RepeatWrapping,
  DoubleSide,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  DirectionalLight,
  HemisphereLight,
  ACESFilmicToneMapping,
  MathUtils,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export const DEFAULTS = {
  width: 1.4,
  height: 2.0,
  thickness: 0.2,

  hardcover: true,
  sleeve: false,
  coverThickness: 0.028,
  coverOverhang: 0.028,
  endpaperColor: '#e8d9b8',
  edgeBevel: 0.015,

  coverColor: '#1f4d3a',
  coverImage: null,
  backImage: null,
  coverFinish: 'satin',
  coverTexture: 'smooth',

  title: 'The Value Engine',
  author: '',
  titleColor: '#e8e0c8',
  titleFont: 'Georgia, serif',

  spineColor: '#1f4d3a',
  spineText: '',
  spineTextColor: '#e8e0c8',

  pageColor: '#f4ecd8',
  pageCount: 400,

  autoRotate: true,
  autoRotateSpeed: 0.25,
  hoverTilt: 0.18,

  exposure: 1.2,
  keyLight: 2.4,
  fillLight: 0.7,
  rimLight: 0.5,
  ambientLight: 0.45,
  lightColor: '#ffffff',
}

export const LIGHTING_KEYS = new Set([
  'exposure','keyLight','fillLight','rimLight','ambientLight','lightColor',
])

const FINISH = {
  matte: { roughness: 0.85, clearcoat: 0.0, clearcoatRoughness: 0.0 },
  satin: { roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 },
  gloss: { roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1 },
}

const REBUILD_KEYS = new Set([
  'width','height','thickness',
  'hardcover','sleeve','coverThickness','coverOverhang','endpaperColor','edgeBevel',
  'coverColor','coverImage','backImage','coverFinish','coverTexture',
  'title','author','titleColor','titleFont',
  'spineColor','spineText','spineTextColor',
  'pageColor','pageCount',
])

const BUMP_SCALE = {
  cloth: 0.11,
  linen: 0.08,
  leather: 0.14,
  paper: 0.045,
}
const BUMP_REPEAT = {
  cloth: [4, 6],
  linen: [3, 5],
  leather: [2, 3],
  paper: [2, 2],
}

function bowedPlaneGeometry(width, height, maxBow, segments = 22) {
  const geo = new PlaneGeometry(width, height, segments, segments)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const u = (x + width / 2) / width
    const v = (y + height / 2) / height
    // sin·sin pins the displacement at all four edges and bulges in the middle
    const bow = Math.sin(u * Math.PI) * Math.sin(v * Math.PI)
    pos.setZ(i, bow * maxBow)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// RoundedBoxGeometry requires radius < half the smallest dimension. Clamp defensively.
function roundedBox(w, h, d, radius, segments = 4) {
  const r = Math.max(0.0001, Math.min(radius, w * 0.49, h * 0.49, d * 0.49))
  return new RoundedBoxGeometry(w, h, d, segments, r)
}

export class Book {
  constructor(config = {}) {
    this.config = { ...DEFAULTS, ...config }
    this.group = new Group()
    this._build()
  }

  _build() {
    if (this.config.hardcover) this._buildHardcover()
    else this._buildPaperback()
  }

  _buildPaperback() {
    const c = this.config
    const geo = roundedBox(c.width, c.height, c.thickness, c.edgeBevel * 0.6)
    const finish = FINISH[c.coverFinish] || FINISH.satin
    const bump = this._coverBumpOptions()

    // Textured materials use white base color — the map encodes the final color,
    // so multiplying by a tint would darken the result.
    const coverMat = new MeshPhysicalMaterial({
      color: 0xffffff, map: this._makeCoverTexture(), ...finish, ...bump,
    })
    const backMat = new MeshPhysicalMaterial({
      color: c.coverColor, ...finish, ...bump,
    })
    const spineMat = new MeshPhysicalMaterial({
      color: 0xffffff, map: this._makeSpineTexture(), ...finish, ...bump,
    })
    const foreEdgeMat = new MeshStandardMaterial({
      color: 0xffffff, map: this._makePagesTexture('vertical'), roughness: 0.95,
    })
    const topEdgeMat = new MeshStandardMaterial({
      color: 0xffffff, map: this._makePagesTexture('horizontal'), roughness: 0.95,
    })

    // BoxGeometry material order: +x, -x, +y, -y, +z, -z
    const mats = [foreEdgeMat, spineMat, topEdgeMat, topEdgeMat, coverMat, backMat]
    this.group.add(new Mesh(geo, mats))
  }

  _buildHardcover() {
    const c = this.config
    const W = c.width
    const H = c.height
    const T = c.thickness
    // clamp cover thickness / overhang so we never create degenerate geometry
    const cT = Math.min(c.coverThickness, T * 0.4)
    const ov = Math.min(c.coverOverhang, Math.min(W, H) * 0.25)
    const finish = FINISH[c.coverFinish] || FINISH.satin

    const bump = this._coverBumpOptions()

    // Textured materials use white base color — the map encodes the final color,
    // so multiplying by a tint would darken the result.
    // When the sleeve is on, the cover art + spine text live on the dust jacket
    // instead of the board; underneath, the board becomes plain coverColor.
    const coverPlain = new MeshPhysicalMaterial({
      color: c.coverColor, ...finish, ...bump,
    })
    const coverOuter = c.sleeve ? coverPlain : new MeshPhysicalMaterial({
      color: 0xffffff, map: this._makeCoverTexture(), ...finish, ...bump,
    })
    const spineMat = c.sleeve ? coverPlain : new MeshPhysicalMaterial({
      color: 0xffffff, map: this._makeSpineTexture(), ...finish, ...bump,
    })
    // When there's a back cover image and no sleeve, render it on the back board.
    // With sleeve on, the dust jacket carries the back image instead.
    const backArtMat = (!c.sleeve && c.backImage)
      ? new MeshPhysicalMaterial({
          color: 0xffffff, map: this._makeBackCoverTexture(), ...finish, ...bump,
        })
      : coverPlain
    const endpaperMat = new MeshStandardMaterial({
      color: c.endpaperColor, roughness: 0.85,
    })
    const foreEdgeMat = new MeshStandardMaterial({
      color: 0xffffff, map: this._makePagesTexture('vertical'), roughness: 0.95,
    })
    const topEdgeMat = new MeshStandardMaterial({
      color: 0xffffff, map: this._makePagesTexture('horizontal'), roughness: 0.95,
    })

    // Boards sit adjacent to the spine strip (not overlapping it) to avoid
    // coplanar z-fighting. Boards occupy x ∈ [-W/2+cT, W/2]; spine owns [-W/2, -W/2+cT].
    const boardW = W - cT
    const boardX = cT / 2
    const bevel = c.edgeBevel

    // FRONT BOARD
    const frontBoard = new Mesh(
      roundedBox(boardW, H, cT, bevel),
      [coverPlain, coverPlain, coverPlain, coverPlain, coverOuter, endpaperMat],
    )
    frontBoard.position.set(boardX, 0, T / 2 - cT / 2)
    this.group.add(frontBoard)

    // BACK BOARD
    const backBoard = new Mesh(
      roundedBox(boardW, H, cT, bevel),
      [coverPlain, coverPlain, coverPlain, coverPlain, endpaperMat, backArtMat],
    )
    backBoard.position.set(boardX, 0, -(T / 2 - cT / 2))
    this.group.add(backBoard)

    // SPINE STRIP — sole occupant of the x ∈ [-W/2, -W/2+cT] column
    const spine = new Mesh(
      roundedBox(cT, H, T, bevel),
      [coverPlain, spineMat, coverPlain, coverPlain, coverPlain, coverPlain],
    )
    spine.position.x = -W / 2 + cT / 2
    this.group.add(spine)

    // TEXT BLOCK (pages) — inset from fore-edge + top/bottom by `ov`,
    // flush with inner face of spine, sandwiched between the two boards.
    // Pages get a very subtle bevel so the page-edge stripes aren't distorted.
    const pagesW = Math.max(0.01, W - ov - cT)
    const pagesH = Math.max(0.01, H - 2 * ov)
    const pagesT = Math.max(0.01, T - 2 * cT)
    const pagesX = (cT - ov) / 2
    const pages = new Mesh(
      roundedBox(pagesW, pagesH, pagesT, bevel * 0.3, 3),
      [foreEdgeMat, endpaperMat, topEdgeMat, topEdgeMat, endpaperMat, endpaperMat],
    )
    pages.position.x = pagesX
    this.group.add(pages)

    if (c.sleeve) this._addDustJacket(W, H, T)
  }

  _addDustJacket(W, H, T) {
    const c = this.config
    const cT = Math.min(c.coverThickness, T * 0.4)

    const sleeveGap = 0.006
    const overhangY = 0.022
    const panelH = H + 2 * overhangY
    const flapLen = W * 0.5
    const flapInset = 0.0015
    const arcSteps = 20

    const xFore = W / 2
    const xSpineOut = -W / 2 - sleeveGap
    const zFrontOut = T / 2 + sleeveGap
    const zBackOut = -T / 2 - sleeveGap
    const zFrontIn = T / 2 - cT - flapInset
    const zBackIn = -T / 2 + cT + flapInset

    const frontR = Math.max(0.002, (zFrontOut - zFrontIn) / 2)
    const backR = Math.max(0.002, (zBackIn - zBackOut) / 2)
    const spineR = sleeveGap

    const midFrontZ = (zFrontOut + zFrontIn) / 2
    const midBackZ = (zBackOut + zBackIn) / 2

    // Arc sampler: point = center + (r·sin(θ), r·cos(θ)) in XZ
    const arc = (cx, cz, r, t0, t1, steps) => {
      const ps = []
      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const theta = t0 + (t1 - t0) * t
        ps.push([cx + r * Math.sin(theta), cz + r * Math.cos(theta)])
      }
      return ps
    }
    const halfArc = Math.max(3, Math.ceil(arcSteps / 3))

    // Path segments traced CW (viewed from +Y).
    // Groups: 0 = paper solid, 1 = back image, 2 = spine, 3 = front image.
    // Cover panels run against the natural path direction for correct face
    // winding, so they need uFlip to keep the texture readable.
    const segments = [
      // 1. Front flap (inside the front cover)
      { points: [[xFore - flapLen, zFrontIn], [xFore, zFrontIn]], group: 0 },
      // 2. Front fore-edge bend (flap side → cover side, via +X apex)
      { points: arc(xFore, midFrontZ, frontR, Math.PI, 0, arcSteps), group: 0 },
      // 3. Front cover (−X, visible from +Z)
      { points: [[xFore, zFrontOut], [-W / 2, zFrontOut]], group: 3, uFlip: true },
      // 4. Spine-front corner
      { points: arc(-W / 2, T / 2, spineR, 0, -Math.PI / 2, halfArc), group: 0 },
      // 5. Spine (−Z, visible from −X)
      { points: [[xSpineOut, T / 2], [xSpineOut, -T / 2]], group: 2 },
      // 6. Back-spine corner
      { points: arc(-W / 2, -T / 2, spineR, -Math.PI / 2, -Math.PI, halfArc), group: 0 },
      // 7. Back cover (+X, visible from −Z)
      { points: [[-W / 2, zBackOut], [xFore, zBackOut]], group: 1, uFlip: true },
      // 8. Back fore-edge bend (cover side → flap side, via +X apex)
      { points: arc(xFore, midBackZ, backR, Math.PI, 0, arcSteps), group: 0 },
      // 9. Back flap (−X, inside the back cover)
      { points: [[xFore, zBackIn], [xFore - flapLen, zBackIn]], group: 0 },
    ]

    // Build one BufferGeometry by extruding each segment's XZ path along Y.
    const positions = []
    const uvs = []
    const indices = []
    const groupList = []   // { start, count, matIdx }
    let vertexIndex = 0

    for (const seg of segments) {
      const pts = seg.points
      const n = pts.length
      if (n < 2) continue

      // Cumulative path length for U coordinate
      let totalLen = 0
      const lens = [0]
      for (let i = 1; i < n; i++) {
        totalLen += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        lens.push(totalLen)
      }

      const segStartVertex = vertexIndex
      for (let row = 0; row < 2; row++) {
        const v = row
        const y = (row - 0.5) * panelH
        for (let i = 0; i < n; i++) {
          const uRaw = totalLen > 0 ? lens[i] / totalLen : 0
          const u = seg.uFlip ? 1 - uRaw : uRaw
          positions.push(pts[i][0], y, pts[i][1])
          uvs.push(u, v)
          vertexIndex++
        }
      }

      const segStartIdx = indices.length
      for (let i = 0; i < n - 1; i++) {
        const a = segStartVertex + i
        const b = a + 1
        const cV = segStartVertex + n + i
        const d = cV + 1
        indices.push(a, cV, d)
        indices.push(a, d, b)
      }
      groupList.push({
        start: segStartIdx,
        count: indices.length - segStartIdx,
        matIdx: seg.group,
      })
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    for (const g of groupList) geo.addGroup(g.start, g.count, g.matIdx)
    geo.computeVertexNormals()

    // Materials — DoubleSide so the flaps / bend undersides render if the
    // camera sneaks into the overhang area at the top or bottom of the book.
    const jacketOpts = {
      roughness: 0.6,
      clearcoat: 0.05,
      clearcoatRoughness: 0.6,
      side: DoubleSide,
    }
    const materials = [
      new MeshPhysicalMaterial({ color: c.coverColor, ...jacketOpts }),
      new MeshPhysicalMaterial({
        color: 0xffffff,
        map: c.backImage ? this._makeBackCoverTexture() : null,
        ...jacketOpts,
      }),
      new MeshPhysicalMaterial({
        color: 0xffffff, map: this._makeSpineTexture(), ...jacketOpts,
      }),
      new MeshPhysicalMaterial({
        color: 0xffffff, map: this._makeCoverTexture(), ...jacketOpts,
      }),
    ]
    // If there's no back image, fall back to the plain paper colour for that group
    if (!c.backImage) {
      materials[1].map = null
      materials[1].color.set(c.coverColor)
    }

    const mesh = new Mesh(geo, materials)
    this.group.add(mesh)
  }

  _makeBackCoverTexture() {
    const c = this.config
    const canvas = document.createElement('canvas')
    const w = 512
    const h = Math.max(64, Math.round(512 * c.height / c.width))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = c.coverColor
    ctx.fillRect(0, 0, w, h)

    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8

    if (c.backImage) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h)
        tex.needsUpdate = true
      }
      img.src = c.backImage
    }
    return tex
  }

  update(patch) {
    const needsRebuild = Object.keys(patch).some(k => REBUILD_KEYS.has(k))
    Object.assign(this.config, patch)
    if (needsRebuild) {
      this.dispose()
      this.group.clear()
      this._build()
    }
  }

  dispose() {
    const seenMats = new Set()
    const seenTex = new Set()
    const TEX_SLOTS = ['map','bumpMap','normalMap','roughnessMap']
    this.group.traverse(obj => {
      if (!obj.isMesh) return
      obj.geometry?.dispose()
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (!m || seenMats.has(m)) continue
        seenMats.add(m)
        for (const key of TEX_SLOTS) {
          const t = m[key]
          if (t && !seenTex.has(t)) {
            seenTex.add(t)
            t.dispose()
          }
        }
        m.dispose()
      }
    })
  }

  _coverBumpOptions() {
    const variant = this.config.coverTexture
    if (!variant || variant === 'smooth') return {}
    const tex = this._makeCoverBumpMap(variant)
    if (!tex) return {}
    // Clearcoat layer would mask the bump shading — its specular highlights
    // come from a smooth top surface. Force it off when a texture is applied.
    return {
      bumpMap: tex,
      bumpScale: BUMP_SCALE[variant] || 0.05,
      clearcoat: 0,
      clearcoatRoughness: 0,
    }
  }

  _makeCoverBumpMap(variant) {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, size, size)

    if (variant === 'cloth' || variant === 'linen') {
      // Basket-weave: cells alternate horizontal/vertical threads so the
      // pattern reads as interlocking warp/weft rather than a flat grid.
      const thread = variant === 'cloth' ? 14 : 10
      const gap = 2
      const cell = thread + gap
      for (let gy = 0; gy < size; gy += cell) {
        for (let gx = 0; gx < size; gx += cell) {
          const horizontal = ((gx / cell + gy / cell) & 1) === 0
          // Raised (light) vs recessed (dark) threads alternate by orientation
          const grad = ctx.createLinearGradient(
            gx, gy,
            horizontal ? gx : gx + thread,
            horizontal ? gy + thread : gy,
          )
          grad.addColorStop(0, 'rgba(20,20,20,1)')
          grad.addColorStop(0.5, 'rgba(240,240,240,1)')
          grad.addColorStop(1, 'rgba(20,20,20,1)')
          ctx.fillStyle = grad
          if (horizontal) {
            ctx.fillRect(gx, gy, thread, thread)
          } else {
            ctx.fillRect(gx, gy, thread, thread)
          }
        }
      }
      // Add noise to break up the repetition and suggest individual fibres.
      const img = ctx.getImageData(0, 0, size, size)
      const noise = variant === 'cloth' ? 28 : 18
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * noise
        img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
        img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
        img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
      }
      ctx.putImageData(img, 0, 0)
    } else if (variant === 'leather') {
      // Splotchy organic grain via random blots
      for (let i = 0; i < 2400; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const r = 1 + Math.random() * 5
        const a = (Math.random() - 0.5) * 0.85
        ctx.fillStyle = a > 0 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${-a})`
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
    } else if (variant === 'paper') {
      const img = ctx.getImageData(0, 0, size, size)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 60
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 128 + n
      }
      ctx.putImageData(img, 0, 0)
    } else {
      return null
    }

    const tex = new CanvasTexture(canvas)
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    const [rx, ry] = BUMP_REPEAT[variant] || [4, 6]
    tex.repeat.set(rx, ry)
    tex.anisotropy = 8
    return tex
  }

  _makeCoverTexture() {
    const c = this.config
    const canvas = document.createElement('canvas')
    const w = 512
    const h = Math.max(64, Math.round(512 * c.height / c.width))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = c.coverColor
    ctx.fillRect(0, 0, w, h)

    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8

    const drawText = () => {
      ctx.fillStyle = c.titleColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const titleSize = Math.round(w * 0.11)
      ctx.font = `600 ${titleSize}px ${c.titleFont}`
      const lines = wrap(ctx, c.title, w * 0.82)
      const lineH = titleSize * 1.15
      let y = h * 0.28
      for (const line of lines) {
        ctx.fillText(line, w / 2, y)
        y += lineH
      }
      if (c.author) {
        const authorSize = Math.round(w * 0.05)
        ctx.font = `400 ${authorSize}px ${c.titleFont}`
        ctx.fillText(c.author, w / 2, h * 0.88)
      }
    }

    if (c.coverImage) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h)
        drawText()
        tex.needsUpdate = true
      }
      img.onerror = () => {
        drawText()
        tex.needsUpdate = true
      }
      img.src = c.coverImage
    } else {
      drawText()
    }
    return tex
  }

  _makePagesTexture(orientation) {
    const c = this.config
    const canvas = document.createElement('canvas')
    const longSide = 1024
    const shortSide = 256
    if (orientation === 'vertical') {
      canvas.width = longSide
      canvas.height = shortSide
    } else {
      canvas.width = shortSide
      canvas.height = longSide
    }
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = c.pageColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // very soft cream/warm gradient so the page block isn't uniform
    const grad = orientation === 'vertical'
      ? ctx.createLinearGradient(0, 0, 0, canvas.height)
      : ctx.createLinearGradient(0, 0, canvas.width, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0.12)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const stackSpan = orientation === 'vertical' ? canvas.width : canvas.height
    const crossSpan = orientation === 'vertical' ? canvas.height : canvas.width

    // page lines — cap draw count so very thick books still look like paper, not mud
    const drawCount = Math.min(c.pageCount, Math.floor(stackSpan / 1.8))

    for (let i = 0; i < drawCount; i++) {
      const t = (i + 0.5) / drawCount
      const jitter = (Math.random() - 0.5) * 0.6
      const pos = Math.floor(t * stackSpan + jitter) + 0.5
      // most lines faint, occasional signature (bundle) lines darker
      const isSignature = Math.random() < 0.06
      const opacity = isSignature
        ? 0.28 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.14
      ctx.strokeStyle = `rgba(30, 20, 10, ${opacity})`
      ctx.lineWidth = isSignature ? 1.3 : 1
      ctx.beginPath()
      if (orientation === 'vertical') {
        ctx.moveTo(pos, 0)
        ctx.lineTo(pos, crossSpan)
      } else {
        ctx.moveTo(0, pos)
        ctx.lineTo(crossSpan, pos)
      }
      ctx.stroke()
    }

    // subtle warm tint wash on top so pages don't read as pure white
    ctx.fillStyle = 'rgba(120, 80, 30, 0.04)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }

  _makeSpineTexture() {
    const c = this.config
    const canvas = document.createElement('canvas')
    const w = 128, h = 512
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = c.spineColor
    ctx.fillRect(0, 0, w, h)

    if (c.spineText) {
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillStyle = c.spineTextColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let size = Math.round(w * 0.38)
      ctx.font = `600 ${size}px ${c.titleFont}`
      while (ctx.measureText(c.spineText).width > h * 0.88 && size > 10) {
        size -= 2
        ctx.font = `600 ${size}px ${c.titleFont}`
      }
      ctx.fillText(c.spineText, 0, 0)
      ctx.restore()
    }

    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }
}

function wrap(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export function mount(container, config = {}) {
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.setClearColor(0x000000, 0)
  container.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.touchAction = 'none'
  renderer.domElement.style.cursor = 'grab'

  const scene = new Scene()
  const camera = new PerspectiveCamera(32, 1, 0.1, 100)
  camera.position.set(0, 0, 6.2)

  const book = new Book(config)
  scene.add(book.group)

  const key = new DirectionalLight(0xffffff, 1)
  key.position.set(2.5, 3, 4)
  scene.add(key)
  const fill = new DirectionalLight(0xffffff, 1)
  fill.position.set(-3, 1, 2)
  scene.add(fill)
  const rim = new DirectionalLight(0xffffff, 1)
  rim.position.set(0, 2, -4)
  scene.add(rim)
  const hemi = new HemisphereLight(0xffffff, 0x1a2024, 1)
  scene.add(hemi)

  const applyLighting = () => {
    const c = book.config
    renderer.toneMappingExposure = c.exposure
    key.intensity = c.keyLight
    fill.intensity = c.fillLight
    rim.intensity = c.rimLight
    hemi.intensity = c.ambientLight
    key.color.set(c.lightColor)
  }
  applyLighting()

  const AUTO_ROTATE_AMPLITUDE = 0.75 // radians; sway range around baseRotY
  const REST_ROT_X = 0.05            // neutral tilt that the book self-rights to
  const REST_ROT_Y = -0.2
  const state = {
    dragging: false,
    lastX: 0,
    lastY: 0,
    targetRotX: REST_ROT_X,
    targetRotY: REST_ROT_Y,
    baseRotY: REST_ROT_Y,
    oscPhase: 0,
    hoverX: 0,
    hoverY: 0,
  }
  book.group.rotation.x = state.targetRotX
  book.group.rotation.y = state.targetRotY

  const el = renderer.domElement

  const onDown = (e) => {
    state.dragging = true
    state.lastX = e.clientX
    state.lastY = e.clientY
    el.setPointerCapture?.(e.pointerId)
    el.style.cursor = 'grabbing'
  }
  const onMove = (e) => {
    const rect = el.getBoundingClientRect()
    state.hoverX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    state.hoverY = ((e.clientY - rect.top) / rect.height) * 2 - 1
    if (!state.dragging) return
    const dx = (e.clientX - state.lastX) / rect.width
    const dy = (e.clientY - state.lastY) / rect.height
    state.targetRotY += dx * Math.PI * 1.6
    state.targetRotX = MathUtils.clamp(state.targetRotX + dy * Math.PI, -0.8, 0.8)
    state.lastX = e.clientX
    state.lastY = e.clientY
  }
  const onUp = (e) => {
    state.dragging = false
    // Y rotation is free — both front and back covers are fully rendered now,
    // so leave the book wherever the user left it. Just re-anchor the auto-rotate
    // oscillator there so the sway resumes smoothly.
    state.baseRotY = state.targetRotY
    state.oscPhase = 0
    // X: self-right to the neutral tilt so the book doesn't stay pitched
    // up or down after an up/down drag.
    state.targetRotX = REST_ROT_X
    if (e && el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    el.style.cursor = 'grab'
  }
  const onLeave = () => { state.hoverX = 0; state.hoverY = 0 }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
  el.addEventListener('pointerleave', onLeave)

  const resize = () => {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  let raf = 0
  let prev = performance.now()
  const tick = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now

    if (!state.dragging && book.config.autoRotate) {
      // Oscillate around baseRotY so the front cover always faces camera.
      state.oscPhase += book.config.autoRotateSpeed * dt
      state.targetRotY = state.baseRotY + Math.sin(state.oscPhase) * AUTO_ROTATE_AMPLITUDE
    }

    const hoverRotX = state.targetRotX + state.hoverY * book.config.hoverTilt
    const hoverRotY = state.targetRotY + (state.dragging ? 0 : state.hoverX * book.config.hoverTilt * 0.6)

    book.group.rotation.x += (hoverRotX - book.group.rotation.x) * 0.1
    book.group.rotation.y += (hoverRotY - book.group.rotation.y) * 0.1

    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    book,
    update(patch) {
      book.update(patch)
      if (Object.keys(patch).some(k => LIGHTING_KEYS.has(k))) applyLighting()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('pointerleave', onLeave)
      book.dispose()
      renderer.dispose()
      if (el.parentElement === container) container.removeChild(el)
    },
  }
}
