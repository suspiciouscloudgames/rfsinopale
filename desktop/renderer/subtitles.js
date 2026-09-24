// Keep complete sentences visible across their original paired reading intervals.
export function sentenceCues(cues) {
  const sentences = [];
  for (const cue of cues) {
    const previous = sentences.at(-1);
    if (previous && cue.sentenceId != null && previous.sentenceId === cue.sentenceId) {
      previous.end = cue.end;
      previous.tr += ' ' + cue.tr;
      previous.en += ' ' + cue.en;
    } else sentences.push({...cue});
  }
  return sentences;
}

export async function createSubtitles(root) {
  const response = await fetch('/subtitles/resonant_field_bilingual_timeline.json');
  if (!response.ok) throw new Error('자막 로딩 실패');
  const timeline = await response.json();
  const cues = sentenceCues(timeline.subtitles);
  const tr = root.querySelector('#subtitle-tr'), en = root.querySelector('#subtitle-en');
  tr.lang = 'tr'; en.lang = 'en';
  let last;
  const update = time => {
    const cue = cues.find(c => time >= c.start && time < c.end);
    if (cue === last) return;
    last = cue;
    tr.textContent = cue?.tr || '';
    en.textContent = cue?.en || '';
  };
  update.duration = timeline.duration;
  return update;
}
