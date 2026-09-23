export const SETTINGS_KEY = 'drifting-sea-screening-v1'
export const DEFAULTS = Object.freeze({fadeSeconds:60,holdSeconds:30,overlayOpacity:0.65,overlayOpacityVersion:3,overlaySeconds:17,overlayTimingVersion:3,maxOverlays:3,jelliesPerTrigger:1,minJellies:1,maxJellies:16,modelUrl:'../animation/jellyfish_slow_swim.glb',triggerVideoUrl:'./trigger-videos.json'})
const rules = {fadeSeconds:[0,3600],holdSeconds:[0,3600],overlayOpacity:[0,1],overlaySeconds:[0.5,240],maxOverlays:[1,4,true],jelliesPerTrigger:[1,10,true],minJellies:[1,16,true],maxJellies:[1,16,true]}
export function validateSettings(input) {
  if(!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('설정은 JSON 객체여야 합니다.')
  const result={...DEFAULTS}
  for(const [key,[min,max,integer]] of Object.entries(rules)) {
    const value=input[key]??result[key]
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))) throw new Error(`${key}: ${min}~${max}${integer?' 정수':''} 범위로 입력하세요.`)
    result[key]=value
  }
  if(result.minJellies>result.maxJellies) throw new Error('최소 해파이 수는 최대 수보다 클 수 없습니다.')
  for(const key of ['modelUrl','triggerVideoUrl']) {
    const value=input[key]??result[key]
    if(typeof value!=='string'||value.length>2048||!value.trim()||/^(?:javascript|data|file):/i.test(value.trim())) throw new Error(`${key}: 유효한 파일 경로를 입력하세요.`)
    result[key]=value.trim()
  }
  if(result.modelUrl==='../assets/models/haepai/haepai.glb')result.modelUrl=DEFAULTS.modelUrl
  if(result.triggerVideoUrl==='../assets/hub-background.mp4')result.triggerVideoUrl=DEFAULTS.triggerVideoUrl
  return result
}
export async function loadSettings(includeSaved=true) {
  let defaults=DEFAULTS
  try {const response=await fetch('./settings.json',{cache:'no-store'});if(response.ok)defaults=validateSettings(await response.json())}catch{}
  if(!includeSaved)return defaults
  return readSavedSettings(defaults)
}
export function readSavedSettings(fallback=DEFAULTS) {
  try {const saved=localStorage.getItem(SETTINGS_KEY);if(!saved)return fallback;const input=JSON.parse(saved);if(input.overlayTimingVersion!==3)input.overlaySeconds=17;if(input.overlayOpacityVersion!==3)input.overlayOpacity=.65;return validateSettings({...fallback,...input})}catch{return fallback}
}
