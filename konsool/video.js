// video.js: a YouTube film that loads nothing from YouTube until it is played. The page shows a
// still and a button; a press swaps them for youtube-nocookie.com's player, playing.
//
//   <div class="yt" data-yt="VIDEO_ID" data-title="..."><img ...><button class="yt-play">...</button></div>
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
