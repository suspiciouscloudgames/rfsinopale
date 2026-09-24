import { loadSettings, readSavedSettings, SETTINGS_KEY } from './config.js'
import { ScreeningCycle } from './cycle.js'
import { createOverlays } from './overlays.js'
import { createJellies } from './jellies.js'
import { createSoundtrack } from './soundtrack.js?v=audio1'
const soundtrack = createSoundtrack()
let starting = false
const fileSettings = await loadSettings(false)
let nextSettings = readSavedSettings(fileSettings)
const cycle = new ScreeningCycle(nextSettings)
const screenSession = crypto.randomUUID()

// The new tablet supplies transparent layers; playback remains independent.
const layerParams = new URLSearchParams(location.search)
const layerRoom = /^[a-zA-Z0-9_-]{1,40}$/.test(layerParams.get('room') || '') ? layerParams.get('room') : 'sinopale'
const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname)
const layerUrl = new URL(localPreview ? 'http://127.0.0.1:5190/' : '/gamepoem/', location.origin)
layerUrl.searchParams.set('display', '1')
layerUrl.searchParams.set('v', 'phrase1')
layerUrl.searchParams.set('room', layerRoom)
layerUrl.searchParams.set('screenSession', screenSession)
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

function reportFullscreen() {
  document.body.dataset.fullscreen=(document.fullscreenElement||document.webkitFullscreenElement)?'on':'off'
}
document.addEventListener('fullscreenchange',reportFullscreen)
document.addEventListener('webkitfullscreenchange',reportFullscreen)
reportFullscreen()
async function enterFullscreen() {
  const request=screen.requestFullscreen||screen.webkitRequestFullscreen
  if(!(document.fullscreenElement||document.webkitFullscreenElement)&&request){
    try { await request.call(screen); reportFullscreen() }
    catch { document.body.dataset.fullscreen='unavailable' }
  }else if(!request)document.body.dataset.fullscreen='unsupported'
}

async function startScreening() {
  if (starting) return
  starting = true
  if (!subtitlesReady) void loadSubtitles()
  // Both calls begin in the user gesture so browsers can permit audio and fullscreen.
  const fullscreen = enterFullscreen()
  const playback = startOrResumeFilm()
  const audioPlayback = soundtrack.start()
  try {
    const results = await Promise.allSettled([playback, audioPlayback])
    if (results.some(result => result.status === 'rejected')) throw new Error('Media playback failed')
    started = true
    setup.hidden = true
    document.body.classList.add('screening')
    void keepAwake()
  } catch {
    video.pause()
    await soundtrack.pause()
    showSetup()
    status.textContent = 'Video or sound could not start. Check the connection and try again.'
  } finally {
    starting = false
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
// Escape leaves fullscreen through the browser without interrupting playback.
document.addEventListener('keydown', event => {
  if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input,textarea,select'))return
  if ((event.code === 'KeyF' || event.key.toLowerCase() === 'f') && started) {
    event.preventDefault()
    void enterFullscreen()
  }
  if (event.key === 'Enter' && !event.target.closest?.('button,a,summary,input,textarea,select')) {
    event.preventDefault()
    void startScreening()
  }
})
document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); void keepAwake() })
void loadSubtitles()


const filmArea = document.querySelector('.film')
const jellyRoot = document.querySelector('#jellies')
const overlays = createOverlays(document.querySelector('#trigger-overlays'),message=>document.querySelector('#overlay-status').textContent=message)
const jellies = createJellies(jellyRoot,message=>document.querySelector('#asset-status').textContent=message)
void jellies.load(nextSettings.modelUrl)
const operator = document.querySelector('#operator')
operator.hidden = !layerParams.has('controls')
let lastFrame = performance.now(), lastReport = 0, roundStarting = false, pendingVisuals = 0, previewId = 0
let hiddenPause = false, fps = 0, fpsFrames = 0, fpsStart = performance.now()

function renderCycle(now) {
  const fade = cycle.frame(video.currentTime,video.duration)
  filmArea.style.setProperty('--film-opacity',String(1-fade))
  jellies.set(cycle.displayJellyCount(),fade,cycle.settings)
  jellies.frame(now)
  overlays.frame()
  document.body.dataset.phase=cycle.phase
  document.body.dataset.round=String(cycle.round)
  document.body.dataset.triggerCount=String(cycle.count)
  if(now-lastReport>250){
    lastReport=now
    const duration=Number.isFinite(video.duration)?video.duration:0
    document.querySelector('#runtime-status').textContent=`회차 ${cycle.round} · ${cycle.phase}\n영상 ${video.currentTime.toFixed(1)} / ${duration.toFixed(1)}초 · 대기 ${cycle.remaining.toFixed(1)}초\n문장트리거 ${cycle.count}회 · 다음 회차 ${cycle.pending}회\n근경 해파이 ${fade>0?cycle.displayJellyCount():0}개 · 군집 ${jellyRoot.dataset.swarmCount||0}개 · 트리거영상 ${overlays.count}개 · ${fps} FPS\n현재 페이드 ${cycle.settings.fadeSeconds}초 / 대기 ${cycle.settings.holdSeconds}초\n다음 회차 페이드 ${nextSettings.fadeSeconds}초 / 대기 ${nextSettings.holdSeconds}초`
  }
}

async function startOrResumeFilm() {
  if(roundStarting)return
  if(cycle.phase==='hold')return
  if(cycle.phase!=='ready'&&cycle.phase!=='restarting')return video.play()
  roundStarting=true
  let callback=null, committed=false
  const commit=()=>{
    if(committed)return;committed=true
    cycle.start(nextSettings)
    overlays.clear()
    // Hide every previous jelly in the same update that reveals the first frame.
    jellies.set(0,0)
    void jellies.load(cycle.settings.modelUrl)
    filmArea.style.setProperty('--film-opacity','1')
    while(pendingVisuals>0){overlays.play(nextSettings);pendingVisuals--}
    renderCycle(performance.now())
  }
  try {
    video.currentTime=0
    if(video.requestVideoFrameCallback)callback=video.requestVideoFrameCallback(commit)
    else video.addEventListener('playing',commit,{once:true})
    await video.play()
  }catch(error){
    if(callback!==null)video.cancelVideoFrameCallback(callback)
    video.removeEventListener('playing',commit)
    throw error
  }finally{roundStarting=false}
}

video.addEventListener('ended',()=>{
  if(cycle.end()){
    overlays.clear();turkishLine.textContent='';englishLine.textContent=''
    lastFrame=performance.now();renderCycle(lastFrame)
  }
})
function frame(now){
  fpsFrames++
  if(now-fpsStart>=1000){fps=Math.round(fpsFrames*1000/(now-fpsStart));fpsFrames=0;fpsStart=now;document.body.dataset.fps=String(fps)}
  const dt=Math.max(0,(now-lastFrame)/1000);lastFrame=now
  if(cycle.tick(dt,!document.hidden)){
    void startOrResumeFilm().catch(()=>{showSetup();status.textContent='다음 영상 재생에 실패했습니다. 시작 버튼으로 다시 시도하세요.'})
  }
  renderCycle(now)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

function acceptTrigger(id){
  if(!cycle.accept(id))return
  if(cycle.phase==='playing'||cycle.phase==='fading')overlays.play(nextSettings)
  else pendingVisuals=Math.min(pendingVisuals+1,nextSettings.maxOverlays)
  renderCycle(performance.now())
}
window.addEventListener('message',event=>{
  const iframe=document.querySelector('#interaction-layers')
  if(event.origin!==layerUrl.origin||event.source!==iframe.contentWindow||event.data?.type!=='sentence-trigger'||event.data.room!==layerRoom)return
  const trigger=event.data.event
  if(!trigger||trigger.sessionId!==screenSession||typeof trigger.senderId!=='string'||trigger.senderId.length>100||!Number.isSafeInteger(trigger.sequence)||trigger.sequence<1||trigger.eventId!==`${trigger.senderId}:${trigger.sequence}`)return
  acceptTrigger(trigger.eventId)
  iframe.contentWindow.postMessage({type:'sentence-ack',sessionId:screenSession,eventId:trigger.eventId},layerUrl.origin)
})
window.addEventListener('storage',event=>{if(event.key===SETTINGS_KEY||event.key===null)nextSettings=readSavedSettings(fileSettings)})
document.addEventListener('keydown',event=>{
  if((event.code==='KeyT'||event.key.toLowerCase()==='t')&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')){
    event.preventDefault()
    triggerRehearsal()
  }
  if((event.code==='KeyE'||event.key.toLowerCase()==='e')&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')){
    event.preventDefault()
    previewFade()
  }
  if((event.code==='KeyO'||event.key.toLowerCase()==='o')&&!event.ctrlKey&&!event.metaKey&&!event.target.closest?.('input,textarea,select')){operator.hidden=!operator.hidden}
})
// Rehearsal only: seek this screening instance; never change settings or send events.
function previewFade(){
  if((cycle.phase==='playing'||cycle.phase==='fading')&&Number.isFinite(video.duration)){
    video.currentTime=Math.min(video.duration,Math.max(0,video.duration-Math.min(video.duration,cycle.settings.fadeSeconds)+.1))
  }
}
document.querySelector('#preview-fade').addEventListener('click',previewFade)
document.querySelector('#preview-end').addEventListener('click',()=>{
  if(cycle.phase==='playing'||cycle.phase==='fading')video.currentTime=Math.max(0,video.duration-2)
})
function triggerRehearsal(){acceptTrigger(`rehearsal:${++previewId}`)}
document.querySelector('#preview-trigger').addEventListener('click',triggerRehearsal)
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenPause=!video.paused;if(hiddenPause)video.pause()}
  else if(hiddenPause){hiddenPause=false;video.play().catch(()=>showSetup())}
})

// Check for a new static release without interrupting an active screening.
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('../sw.js',{scope:'../',updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{})
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!started)location.reload()
    else document.querySelector('#overlay-status').textContent='업데이트가 준비되었습니다. 상영 후 새로고침하면 적용됩니다.'
  })
}
