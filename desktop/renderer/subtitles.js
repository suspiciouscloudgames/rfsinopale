// Artist-approved bilingual cards: paired translations share one reading interval.
export async function createSubtitles(root) {
  const response = await fetch('/subtitles/resonant_field_bilingual_timeline.json');
  if (!response.ok) throw new Error('자막 로딩 실패');
  const timeline = await response.json();
  const tr = root.querySelector('#subtitle-tr'), en = root.querySelector('#subtitle-en');
  tr.lang = 'tr'; en.lang = 'en';
  let last;
  const update = time => {
    const cue = timeline.subtitles.find(c => time >= c.start && time < c.end);
    if (cue === last) return;
    last = cue;
    tr.textContent = cue?.tr || '';
    en.textContent = cue?.en || '';
  };
  update.duration = timeline.duration;
  return update;
}
