import { mount, DEFAULTS } from './book.js'

const TYPES = {
  width: 'number', height: 'number', thickness: 'number',
  coverThickness: 'number', coverOverhang: 'number', edgeBevel: 'number',
  pageCount: 'number', autoRotateSpeed: 'number', hoverTilt: 'number',
  exposure: 'number', keyLight: 'number', fillLight: 'number',
  rimLight: 'number', ambientLight: 'number',
  hardcover: 'bool', sleeve: 'bool', autoRotate: 'bool',
}

function parseConfig(el) {
  const cfg = {}
  for (const key of Object.keys(DEFAULTS)) {
    const attr = 'book' + key[0].toUpperCase() + key.slice(1)
    const v = el.dataset[attr]
    if (v == null) continue
    const t = TYPES[key]
    cfg[key] = t === 'number' ? Number(v) : t === 'bool' ? v === 'true' : v
  }
  return cfg
}

function init() {
  const els = document.querySelectorAll('[data-book-mount]')
  els.forEach(el => {
    if (el.__book3d) return
    el.__book3d = mount(el, parseConfig(el))
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

export default { mount, init }
