import { createSoundtrack } from './soundtrack.js?v=interlude15'
const soundtrack = createSoundtrack()
let starting = false

// The new tablet supplies transparent layers; playback remains independent.
const layerParams = new URLSearchParams(location.search)
const layerRoom = /^[a-zA-Z0-9_-]{1,40}$/.test(layerParams.get('room') || '') ? layerParams.get('room') : 'sinopale'
const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname)
const layerUrl = new URL(localPreview ? 'http://127.0.0.1:5190/' : '/gamepoem/', location.origin)
layerUrl.searchParams.set('display', '1')
layerUrl.searchParams.set('v', 'two-projectors1')
layerUrl.searchParams.set('room', layerRoom)
document.querySelector('#interaction-layers').src = layerUrl.href

const video = document.querySelector('#film')
const screen = document.querySelector('#screen')
const setup = document.querySelector('#setup')
const start = document.querySelector('#start')
const turkishLine = document.querySelector('#subtitle-tr')
const englishLine = document.querySelector('#subtitle-en')
const koreanLine = document.querySelector('#subtitle-ko')
const measure = document.createElement('canvas').getContext('2d')
const subtitles = document.querySelector('#subtitles')
const koreanTest = subtitles.dataset.language === 'ko' && koreanLine
const status = document.querySelector('#status')
const mediaBase = '../assets/video/resonant-field-film/'
let cues = []
let screeningDuration = 0
function subtitleTime(){
  return Number.isFinite(video.duration)&&video.duration>0?video.currentTime/video.duration*screeningDuration:0
}
function syncReadingPace(){
  if(screeningDuration>0&&Number.isFinite(video.duration)&&video.duration>0){
    video.defaultPlaybackRate=video.duration/screeningDuration
    video.playbackRate=video.defaultPlaybackRate
  }
}
video.addEventListener('loadedmetadata',syncReadingPace)
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
    if (koreanTest) {
      measure.font = getComputedStyle(koreanLine).font
      const words = cue.text.trim().split(/\s+/).length
      for (let count = 1; count <= words; count++) {
        const parts = splitText(cue.text, count)
        if (parts.every(line => measure.measureText(line).width <= width) || count === words) {
          cue.parts = parts.map(ko => ({ ko }))
          break
        }
      }
      continue
    }
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
    const timing=await readJson('resonant_field_bilingual_timeline.json?v=revised-slow1')
    if(!Number.isFinite(timing.duration)||timing.duration<=0)throw new Error('Invalid subtitle duration')
    screeningDuration=timing.duration
    cues=timing.subtitles.map(cue=>{
      if(!cue.tr||!cue.en||cue.end<=cue.start)throw new Error('Invalid bilingual subtitle')
      return {...cue,parts:[]}
    })
    syncReadingPace()
    fitCues()
    subtitlesReady = true
  } catch {
    status.textContent = 'Subtitles could not load. Check the connection and press play to retry.'
  }
}

function updateSubtitles() {
  const time=subtitleTime()
  const cue = cues.find(cue => time >= cue.start && time < cue.end)
  const index = cue ? Math.min(cue.parts.length - 1, Math.floor((time - cue.start) / (cue.end - cue.start) * cue.parts.length)) : 0
  const part = cue?.parts[index]
  const key = part ? `${cue.id}:${index}` : ''
  if (key === activeText) return
  activeText = key
  if (koreanLine) koreanLine.textContent = part?.ko ?? ''
  turkishLine.textContent = part?.tr ?? ''
  englishLine.textContent = part?.en ?? ''
  subtitles.classList.toggle('dark', video.currentTime>=238.5&&video.currentTime<258.75)
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
  if (starting||awaitingPoem) return
  starting = true
  const fullscreen = enterFullscreen()
  const audioPlayback = soundtrack.start()
  if (!subtitlesReady) {
    await loadSubtitles()
    if(!subtitlesReady){await audioPlayback.catch(()=>{});await soundtrack.pause();starting=false;return}
  }
  // Both calls begin in the user gesture so browsers can permit audio and fullscreen.
  const playback = video.play()
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

// Pause on the final frame while the connected tablet's poem is presented.
const interactionFrame=document.querySelector('#interaction-layers')
let awaitingPoem=false,poemTimeout=null,blackoutTimer=null,resuming=false,endingToken=null
let filmCycle=Date.now().toString(36),endingPhase='waiting'
const projectorChannel=new BroadcastChannel(`sinopale-projectors-${layerRoom}`)
function broadcastProjectors(){
  projectorChannel.postMessage({type:'projector-state',cycle:filmCycle,elapsed:subtitleTime(),sentAt:Date.now(),phase:awaitingPoem?endingPhase:video.paused?'paused':'playing'})
}
projectorChannel.onmessage=event=>{if(event.data?.type==='floor-ready')broadcastProjectors()}
setInterval(broadcastProjectors,250)
async function resumeFilm(){
  if(resuming)return
  resuming=true;clearTimeout(poemTimeout);clearTimeout(blackoutTimer)
  const resetToken=endingToken
  video.currentTime=0
  try{
    await video.play()
    filmCycle=Date.now().toString(36);awaitingPoem=false;endingToken=null;endingPhase='waiting'
    document.body.classList.remove('blackout');subtitles.style.visibility=''
    interactionFrame.contentWindow.postMessage({type:'film-restarted',resetToken},layerUrl.origin)
    broadcastProjectors();sendFilmProgress()
  }catch{awaitingPoem=false;showSetup()}
  finally{resuming=false}
}
function blackoutAndRestart(){
  if(endingPhase==='blackout')return
  clearTimeout(poemTimeout);endingPhase='blackout';document.body.classList.add('blackout');broadcastProjectors()
  blackoutTimer=setTimeout(resumeFilm,2000)
}
video.addEventListener('ended',()=>{
  if(awaitingPoem)return
  awaitingPoem=true;endingPhase='waiting';endingToken=null;subtitles.style.visibility='hidden'
  broadcastProjectors();sendFilmProgress()
  interactionFrame.contentWindow.postMessage({type:'film-ended'},layerUrl.origin)
  // Offline tablet layer: loop the movie without clearing anyone's unfinished poem.
  poemTimeout=setTimeout(resumeFilm,2500)
})
window.addEventListener('message',event=>{
  if(event.source!==interactionFrame.contentWindow||event.origin!==layerUrl.origin||!awaitingPoem)return
  if(event.data?.type==='poem-ending'){
    clearTimeout(poemTimeout)
    if(event.data.duration===0){void resumeFilm();return}
    if(typeof event.data.token!=='string'||event.data.duration!==10000){void resumeFilm();return}
    endingToken=event.data.token;endingPhase='ending';broadcastProjectors()
    poemTimeout=setTimeout(blackoutAndRestart,10000)
  }else if(event.data?.type==='poem-finished'&&event.data.token===endingToken)blackoutAndRestart()
})

// The tablet's water level is driven by the actual movie clock, not a local timer.
function sendFilmProgress(){
  if(!Number.isFinite(video.duration)||video.duration<=0)return
  interactionFrame.contentWindow.postMessage({type:'film-progress',currentTime:subtitleTime(),cycle:filmCycle,progress:awaitingPoem?1:video.currentTime/video.duration,phase:awaitingPoem?'ending':video.paused?'paused':'playing'},layerUrl.origin)
}
setInterval(sendFilmProgress,1000)
for(const event of ['loadedmetadata','seeked','play','pause','ended'])video.addEventListener(event,sendFilmProgress)
interactionFrame.addEventListener('load',sendFilmProgress)

// A gentle camera drift follows a phrase sent through either side of the tank.
let cameraMotion=null
const cameraSeen=new Set()
window.addEventListener('message',event=>{
  const data=event.data
  if(event.source!==interactionFrame.contentWindow||event.origin!==layerUrl.origin||data?.type!=='film-camera'||!['left','right'].includes(data.direction)||typeof data.eventId!=='string'||awaitingPoem)return
  if(cameraSeen.has(data.eventId))return
  video.dataset.cameraDirection=data.direction;video.dataset.cameraEvent=data.eventId
  cameraSeen.add(data.eventId);if(cameraSeen.size>256)cameraSeen.delete(cameraSeen.values().next().value)
  const from=getComputedStyle(video).transform
  cameraMotion?.cancel()
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
  const x=data.direction==='left'?2:-2
  cameraMotion=video.animate([{transform:from==='none'?'scale(1)':from},{transform:`scale(1.065) translateX(${x}%)`,offset:.38},{transform:`scale(1.045) translateX(${x*.8}%)`,offset:.7},{transform:'scale(1) translateX(0)'}],{duration:9000,easing:'ease-in-out'})
})
video.addEventListener('ended',()=>{cameraMotion?.cancel();cameraMotion=null})
