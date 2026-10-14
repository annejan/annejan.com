// video.js: a big play button on a film. A YouTube film loads nothing from YouTube until it is
// played: the page shows a still and the button, and a press swaps them for youtube-nocookie.com's
// player, playing. A film of our own just starts.
//
//   <div class="yt" data-yt="VIDEO_ID" data-title="..."><img ...><button class="yt-play">...</button></div>
//   <div class="yt playable"><video ...></video><button class="yt-play">...</button></div>
'use strict';

document.querySelectorAll('.yt[data-yt]').forEach((box) => {
  box.querySelector('.yt-play').addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(box.dataset.yt)}?autoplay=1&rel=0`;
    frame.title = box.dataset.title || 'Video';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    // This site sends no referrer to others; YouTube's player will not play without one.
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.className = 'film';
    box.replaceChildren(frame);
    frame.focus();
  });
});

document.querySelectorAll('.yt.playable').forEach((box) => {
  const video = box.querySelector('video');
  const button = box.querySelector('.yt-play');
  button.addEventListener('click', () => {
    video.play();
    video.focus();
  });
  // Started from its own controls too: the button goes either way, and comes back at the end.
  video.addEventListener('play', () => { button.hidden = true; });
  video.addEventListener('ended', () => { button.hidden = false; });
});
