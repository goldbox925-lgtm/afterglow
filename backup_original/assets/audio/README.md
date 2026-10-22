# Soundtrack slot

Put your original track here as **`soundtrack.mp3`** (exact name, lowercase).

- When present, the MP3 becomes the master clock: the film follows `audio.currentTime`.
- When absent, the generative score in `js/audio/score.js` plays instead (the browser console
  will show one harmless `404` for this file — that is the detection working).
- To align the song with the picture, change `AG.CONFIG.soundtrack.offset` in `js/config.js`
  (seconds into the MP3 that correspond to film time 0), and chapter times in `AG.CONFIG.chapters`.
- Keep it under ~10 MB so GitHub Pages serves it quickly. 192 kbps MP3 is plenty.
