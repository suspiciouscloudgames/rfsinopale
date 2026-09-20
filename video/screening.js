// The new tablet supplies transparent layers; playback remains independent.
const layerParams = new URLSearchParams(location.search)
const layerRoom = /^[a-zA-Z0-9_-]{1,40}$/.test(layerParams.get('room') || '') ? layerParams.get('room') : 'sinopale'
const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname)
const layerUrl = new URL(localPreview ? 'http://127.0.0.1:5190/' : '/gamepoem/', location.origin)
layerUrl.searchParams.set('display', '1')
layerUrl.searchParams.set('v', 'autolink2')
layerUrl.searchParams.set('room', layerRoom)
document.querySelector('#interaction-layers').src = layerUrl.href

const video = document.querySelector('#film')
const screen = document.querySelector('#screen')
const setup = document.querySelector('#setup')
const start = document.querySelector('#start')
const turkishLine = document.querySelector('#subtitle-tr')
const englishLine = document.querySelector('#subtitle-en')
const measure = document.createElement('canvas').getContext('2d')
const subtitles = document.querySelector('#subtitles')
const status = document.querySelector('#status')
const mediaBase = '../assets/video/resonant-field-film/'
let cues = []
let activeText = null
let subtitlesReady = false
let wakeLock = null
let started = false

async function readJson(name) {
  const response = await fetch(mediaBase + name)
  if (!response.ok) throw new Error(`Subtitle request failed: ${response.status}`)
  return response.json()
}

// Balanced phrase-sized portions keep exactly one readable line per language.
// Both languages advance together within the original cue's start/end interval.
function splitText(text, count) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const parts = []
  let offset = 0
  for (let part = 0; part < count - 1; part++) {
    const remaining = words.slice(offset).join(' ').length
    const target = remaining / (count - part)
    let length = 0
    let bestEnd = offset + 1
    let bestScore = Infinity
    const lastEnd = words.length - (count - part - 1)
    for (let end = offset + 1; end <= lastEnd; end++) {
      length += words[end - 1].length + (end > offset + 1 ? 1 : 0)
      const punctuationBonus = /[.,;:!?]$/.test(words[end - 1]) ? target * 0.12 : 0
      const score = Math.abs(length - target) - punctuationBonus
      if (score < bestScore) { bestEnd = end; bestScore = score }
      if (length > target * 1.4) break
    }
    parts.push(words.slice(offset, bestEnd).join(' '))
    offset = bestEnd
  }
  parts.push(words.slice(offset).join(' '))
  return parts
}

function fitCues() {
  const width = subtitles.clientWidth - 4
  if (width <= 0) return
  const trFont = getComputedStyle(turkishLine).font
  const enFont = getComputedStyle(englishLine).font
  for (const cue of cues) {
    const maxParts = Math.min(cue.tr.trim().split(/\s+/).length, cue.en.trim().split(/\s+/).length)
    for (let count = 1; count <= maxParts; count++) {
      const tr = splitText(cue.tr, count)
      const en = splitText(cue.en, count)
      measure.font = trFont
      const trFits = tr.every(line => measure.measureText(line).width <= width)
      measure.font = enFont
      const enFits = en.every(line => measure.measureText(line).width <= width)
      if (trFits && enFits || count === maxParts) {
        cue.parts = tr.map((text, i) => ({ tr: text, en: en[i] }))
        break
      }
    }
  }
  activeText = null
  updateSubtitles()
}

async function loadSubtitles() {
  status.textContent = ''
  try {
    const [timing, turkish, english] = await Promise.all([
      readJson('resonant_field_subtitles.json'),
      readJson('resonant_field_subtitles_tr.json'),
      readJson('resonant_field_subtitles_en.json'),
    ])
    const tr = new Map(turkish.subtitles.map(cue => [cue.id, cue.text]))
    const en = new Map(english.subtitles.map(cue => [cue.id, cue.text]))
    cues = timing.subtitles.map(cue => {
      if (!tr.get(cue.id) || !en.get(cue.id)) throw new Error('Missing bilingual subtitle')
      return { ...cue, tr: tr.get(cue.id), en: en.get(cue.id), parts: [] }
    })
    fitCues()
    subtitlesReady = true
  } catch {
    status.textContent = 'Subtitles could not load. Check the connection and press play to retry.'
  }
}

function updateSubtitles() {
  const cue = cues.find(cue => video.currentTime >= cue.start && video.currentTime < cue.end)
  const index = cue ? Math.min(cue.parts.length - 1, Math.floor((video.currentTime - cue.start) / (cue.end - cue.start) * cue.parts.length)) : 0
  const part = cue?.parts[index]
  const key = part ? `${cue.id}:${index}` : ''
  if (key === activeText) return
  activeText = key
  turkishLine.textContent = part?.tr ?? ''
  englishLine.textContent = part?.en ?? ''
  subtitles.classList.toggle('dark', cue?.id === 22 || cue?.id === 23)
}

new ResizeObserver(fitCues).observe(subtitles)

async function keepAwake() {
  if (!started || document.visibilityState !== 'visible' || wakeLock || !navigator.wakeLock) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => { wakeLock = null }, { once: true })
  } catch { /* Screening continues when the browser cannot hold a wake lock. */ }
}

function showSetup() {
  setup.hidden = false
  document.body.classList.remove('screening')
  start.setAttribute('aria-label', started ? 'Continue screening' : 'Start screening')
  start.focus()
}

async function enterFullscreen() {
  if (!document.fullscreenElement && screen.requestFullscreen) {
    try { await screen.requestFullscreen() } catch { /* Windowed screening remains available. */ }
  }
}

async function startScreening() {
  if (!subtitlesReady) void loadSubtitles()
  // Both calls begin in the user gesture so browsers can permit audio and fullscreen.
  const fullscreen = enterFullscreen()
  const playback = video.play()
  try {
    await playback
    started = true
    setup.hidden = true
    document.body.classList.add('screening')
    void keepAwake()
  } catch {
    showSetup()
    status.textContent = 'Playback could not start. Check the connection and try again.'
  }
  await fullscreen
}

start.addEventListener('click', () => void startScreening())
video.addEventListener('timeupdate', updateSubtitles)
video.addEventListener('seeked', updateSubtitles)
video.addEventListener('error', () => {
  showSetup()
  status.textContent = 'The film could not load. Check the connection, then reload this page.'
})
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && started) showSetup()
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') showSetup()
  if (event.key.toLowerCase() === 'f' && started) {
    event.preventDefault()
    void startScreening()
  }
  if (event.key === 'Enter' && event.target !== start) {
    event.preventDefault()
    void startScreening()
  }
})
document.addEventListener('visibilitychange', () => void keepAwake())
void loadSubtitles()
