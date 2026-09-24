# Current screening soundtrack

`stuck-final.mp3` is the unmodified **Stuck (Final).mp3** supplied by the artist. It loops through a decoded Web Audio buffer at its original speed. No additional waves, fades or silent interval are added. Audio is played only by the upper screen.

## Previous soundtrack (retained, not played)

# Main screening soundtrack

- Music: `Stuck.mp3`, supplied by the artist for this exhibition.
- Waves: “Oceanwavescrushing”, Luftrum, 16 February 2008.
  Source: https://commons.wikimedia.org/wiki/File:Oceanwavescrushing.ogg
  Original: https://www.freesound.org/people/Luftrum/sounds/48412/
  License: Creative Commons Attribution 3.0 Unported, https://creativecommons.org/licenses/by/3.0/
  Changes: excerpted, level adjusted, loop seam crossfaded, and crossfaded between repetitions of the supplied music.

`stuck-sea-loop.wav`: five-second music fade-in, five-second music fade-out,
then fifteen seconds of waves alone. Added waves are silent during full-level music;
they fade in only during the final five-second music fade-out and fade away
during the next five-second music fade-in. The transition crosses the loop seam.
The music loop runs independently of the picture loop.

Rebuild using `scripts/render-screening-audio.py` and the sources in `artwork/audio/`.
