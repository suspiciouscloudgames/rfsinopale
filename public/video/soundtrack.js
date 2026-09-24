// The WAV contains the complete music/fades/15-second sea interval.
// A decoded looping buffer avoids timer drift and media-element loop gaps.
export function createSoundtrack() {
  let context = null
  let source = null
  let decoded = null
  let loading = null
  const url = new URL('../assets/audio/stuck-sea-loop.wav?v=interlude15', import.meta.url)
  function load() {
    if (!loading) {
      loading = fetch(url).then(response => {
        if (!response.ok) throw new Error('Soundtrack could not load')
        return response.arrayBuffer()
      }).catch(error => { loading = null; throw error })
    }
    return loading
  }
  // Preload bytes without starting audio or requiring a gesture.
  void load().catch(() => {})
  return {
    async start() {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) throw new Error('Web Audio is unavailable')
      if (!context) context = new Audio()
      // Called directly from START, before waiting for network or decoding.
      const resumed = context.resume()
      await resumed
      if (!decoded) {
        const bytes = await load()
        decoded = await new Promise((resolve, reject) => {
          context.decodeAudioData(bytes.slice(0), resolve, reject)
        })
      }
      if (!source) {
        source = context.createBufferSource()
        source.buffer = decoded
        source.loop = true
        source.connect(context.destination)
        source.start()
      }
      document.body.dataset.soundtrack = 'playing'
    },
    async pause() {
      if (context) await context.suspend()
      document.body.dataset.soundtrack = 'paused'
    },
  }
}
