const video = document.querySelector('#film')
const screen = document.querySelector('#screen')
const setup = document.querySelector('#setup')
const start = document.querySelector('#start')
const language = document.querySelector('#language')
const subtitles = document.querySelector('#subtitles')
const status = document.querySelector('#status')
const mediaBase = '../assets/video/resonant-field-film/'
const requestedLanguage = new URLSearchParams(location.search).get('lang')
if (['tr', 'en', 'ko', 'off'].includes(requestedLanguage)) language.value = requestedLanguage
let cues = []
let subtitleRequest = 0
let activeCue = null
let wakeLock = null
let started = false

async function readJson(name) {
  const response = await fetch(mediaBase + name)
  if (!response.ok) throw new Error(`Subtitle request failed: ${response.status}`)
  return response.json()
}

async function loadSubtitles() {
  const request = ++subtitleRequest
  const selected = language.value
  cues = []
  activeCue = null
  subtitles.textContent = ''
  subtitles.lang = selected === 'off' ? 'tr' : selected
  status.textContent = ''
  if (selected === 'off') return
  try {
    const [timing, translation] = await Promise.all([
      readJson('resonant_field_subtitles.json'),
      selected === 'ko' ? null : readJson(`resonant_field_subtitles_${selected}.json`),
    ])
    if (request !== subtitleRequest) return
    const textById = new Map(translation?.subtitles.map(cue => [cue.id, cue.text]) ?? [])
    cues = timing.subtitles.map(cue => ({ ...cue, text: textById.get(cue.id) ?? cue.text }))
    updateSubtitles()
  } catch {
    if (request === subtitleRequest) status.textContent = 'Subtitles could not load. Check the connection and select the language again.'
  }
}

function updateSubtitles() {
  const cue = cues.find(cue => video.currentTime >= cue.start && video.currentTime < cue.end) ?? null
  if (cue === activeCue) return
  activeCue = cue
  subtitles.textContent = cue?.text ?? ''
  subtitles.classList.toggle('dark', cue?.id === 22 || cue?.id === 23)
}

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
  start.textContent = started ? 'Continue screening' : 'Start screening'
  start.focus()
}

async function enterFullscreen() {
  if (!document.fullscreenElement && screen.requestFullscreen) {
    try { await screen.requestFullscreen() } catch { /* Windowed screening remains available. */ }
  }
}

async function startScreening() {
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
language.addEventListener('change', () => void loadSubtitles())
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
  if (event.target instanceof HTMLSelectElement) return
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
