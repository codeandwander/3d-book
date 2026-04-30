import GUI from 'lil-gui'
import { mount } from './book.js'

const STORAGE_KEY = 'book3d.designer.v2'
// clean up v1 payload if present
try { localStorage.removeItem('book3d.designer.v1') } catch {}

const loadStored = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!raw || typeof raw !== 'object') return { book: {}, ui: {} }
    return { book: raw.book || {}, ui: raw.ui || {} }
  } catch { return { book: {}, ui: {} } }
}

const stored = loadStored()

const uiState = {
  bgColor: '#0B1E23',
  ...stored.ui,
}
const applyBg = (c) => { document.body.style.background = c }
applyBg(uiState.bgColor)

const container = document.getElementById('book')
const inst = mount(container, {
  title: '',
  author: '',
  spineText: '',
  coverImage: '/ebook.jpg',
  backImage: '/ebook-back.jpg',
  ...stored.book,
})

const saveStored = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      book: inst.book.config,
      ui: uiState,
    }))
  } catch {}
}

const rawUpdate = inst.update.bind(inst)
inst.update = (patch) => {
  rawUpdate(patch)
  saveStored()
}

const cfg = inst.book.config
const u = (k) => (v) => inst.update({ [k]: v })

const gui = new GUI({ title: 'Book Designer' })

const view = gui.addFolder('View')
view.addColor(uiState, 'bgColor').name('background').onChange(v => {
  applyBg(v)
  saveStored()
})

// Binding type gets its own dropdown at the top level so it's obvious.
const bindingState = { binding: cfg.hardcover ? 'hardcover' : 'softcover' }
gui.add(bindingState, 'binding', ['hardcover', 'softcover'])
  .name('Binding')
  .onChange(v => inst.update({ hardcover: v === 'hardcover' }))

const construction = gui.addFolder('Construction')
construction.open()
construction.add(cfg, 'sleeve').name('dust jacket').onChange(u('sleeve'))
construction.add(cfg, 'edgeBevel', 0, 0.05, 0.001).name('edge bevel').onChange(u('edgeBevel'))
construction.add(cfg, 'coverThickness', 0.005, 0.08, 0.001).onChange(u('coverThickness'))
construction.add(cfg, 'coverOverhang', 0, 0.1, 0.001).onChange(u('coverOverhang'))
construction.addColor(cfg, 'endpaperColor').onChange(u('endpaperColor'))

const cover = gui.addFolder('Cover')
cover.add(cfg, 'title').onChange(u('title'))
cover.add(cfg, 'author').onChange(u('author'))
cover.addColor(cfg, 'coverColor').onChange(u('coverColor'))
cover.addColor(cfg, 'titleColor').onChange(u('titleColor'))
cover.add(cfg, 'titleFont', [
  'Georgia, serif',
  'Palatino, serif',
  '"Times New Roman", serif',
  'Helvetica, sans-serif',
  '"Courier New", monospace',
]).onChange(u('titleFont'))
cover.add(cfg, 'coverFinish', ['matte','satin','gloss']).onChange(u('coverFinish'))
cover.add(cfg, 'coverTexture', ['smooth','cloth','linen','leather','paper']).name('texture').onChange(u('coverTexture'))
cover.add({ coverImage: cfg.coverImage || '' }, 'coverImage')
  .name('cover image (URL)')
  .onChange(v => inst.update({ coverImage: v || null }))
cover.add({ backImage: cfg.backImage || '' }, 'backImage')
  .name('back image (URL)')
  .onChange(v => inst.update({ backImage: v || null }))

const spine = gui.addFolder('Spine')
spine.add(cfg, 'spineText').onChange(u('spineText'))
spine.addColor(cfg, 'spineColor').onChange(u('spineColor'))
spine.addColor(cfg, 'spineTextColor').onChange(u('spineTextColor'))

const dims = gui.addFolder('Dimensions')
dims.add(cfg, 'width', 0.5, 3, 0.01).onChange(u('width'))
dims.add(cfg, 'height', 0.5, 3, 0.01).onChange(u('height'))
dims.add(cfg, 'thickness', 0.05, 2, 0.01).onChange(u('thickness'))

const pages = gui.addFolder('Pages')
pages.addColor(cfg, 'pageColor').onChange(u('pageColor'))
pages.add(cfg, 'pageCount', 50, 1200, 10).onChange(u('pageCount'))

const lighting = gui.addFolder('Lighting')
lighting.add(cfg, 'exposure', 0.3, 2.5, 0.01).onChange(u('exposure'))
lighting.add(cfg, 'keyLight', 0, 6, 0.01).name('key').onChange(u('keyLight'))
lighting.add(cfg, 'fillLight', 0, 3, 0.01).name('fill').onChange(u('fillLight'))
lighting.add(cfg, 'rimLight', 0, 3, 0.01).name('rim').onChange(u('rimLight'))
lighting.add(cfg, 'ambientLight', 0, 3, 0.01).name('ambient').onChange(u('ambientLight'))
lighting.addColor(cfg, 'lightColor').name('key colour').onChange(u('lightColor'))

const interaction = gui.addFolder('Interaction')
interaction.add(cfg, 'autoRotate').onChange(u('autoRotate'))
interaction.add(cfg, 'autoRotateSpeed', 0, 1, 0.01).onChange(u('autoRotateSpeed'))
interaction.add(cfg, 'hoverTilt', 0, 0.5, 0.01).onChange(u('hoverTilt'))

const SCRIPT_URL = 'https://cdn.jsdelivr.net/gh/codeandwander/3d-book@v0.1.1/dist-embed/book.iife.js'
const URL_KEYS = new Set(['coverImage', 'backImage'])

const actions = {
  exportEmbed() {
    const kebab = (k) => k.replace(/([A-Z])/g, '-$1').toLowerCase()
    const attrs = ['data-book-mount']
    for (const [k, v] of Object.entries(cfg)) {
      if (v == null || v === '') continue
      let val = String(v)
      if (URL_KEYS.has(k) && val.startsWith('/')) val = location.origin + val
      attrs.push(`data-book-${kebab(k)}="${val.replace(/"/g, '&quot;')}"`)
    }
    const html = `<div\n  ${attrs.join('\n  ')}\n  style="width:100%;height:600px;background:${uiState.bgColor}"\n></div>\n<script src="${SCRIPT_URL}"></script>`
    console.log(html)
    navigator.clipboard?.writeText(html)
    alert('Embed snippet copied to clipboard (and logged to console)')
  },
}
gui.add(actions, 'exportEmbed').name('Copy Webflow embed')

gui.add({
  reset() {
    localStorage.removeItem(STORAGE_KEY)
    location.reload()
  },
}, 'reset').name('Reset to defaults')
