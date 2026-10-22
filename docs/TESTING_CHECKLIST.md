# Testing checklist — Chrome on macOS

Open the deployed URL (or `http://localhost:8000`) in normal Chrome with DevTools → Console open.

## Load
- [ ] Title screen, then **Enter Experience** becomes clickable within a few seconds.
- [ ] Console: no red errors. One `404` for `assets/audio/soundtrack.mp3` is expected only if you
      haven't added a soundtrack. A yellow `character pose …` warning means that image failed
      its transparency check and a silhouette is showing.
- [ ] **Help (?) → Character assets:** all ten poses listed, each with status `ok` (B, C, E, F, G come
      from `keyed/`, and D notes it is staged with J).
- [ ] Network tab: all `assets/character/…` files load with 200 from your Pages URL.

## The film
- [ ] 0–15 s: she lies curled on the wet roof, breathing; no rectangle visible around her.
- [ ] 15–32 s: five impacts with thunder; the city loses its lights; she pushes up under a flash.
- [ ] 32–48 s: first light (bell); she sits up, then kneels looking up, with soft dissolves.
- [ ] 48–65 s: rear view over the skyline; towers rebuild with gold seams; STILL HERE sign; she
      stands, rises and levitates with an aura.
- [ ] 65–90 s: lift-off flash, chase between towers with a light trail and streaks, a side pass, a
      climb into a pink/violet/cyan cloud, sunrise, the AFTERGLOW title, then the end card.
- [ ] The camera never passes through a building during the flight.

## Controls
- [ ] Space pauses and resumes in sync; ↺ replays; drag the timeline; keys 1–5 and the chips jump to
      each chapter, and each chapter looks right immediately after jumping.
- [ ] Mute and the volume slider; fullscreen; camera menu; **N** builds a new city and the flight
      still works.
- [ ] Mouse parallax and drag; during the flight, offsets stay small.

## Voice (HTTPS or localhost)
- [ ] Mic button → permission prompt only now. Allow: meter moves; a hum brightens and speeds the
      light; a clap during Fracture adds glitching.
- [ ] Block: a message appears and the film keeps playing.

## Performance
- [ ] Expect the *balanced* tier at ~50–60 fps; if choppy, Help → Quality → Low.
