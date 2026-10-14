// The QtPass padlocked heart, for the demo (demo.js) and for typing "pass" (fx/unlock.js).
// The heart (AnonMoos, public domain) comes without its shackle: the shackle is drawn from the
// logo's own geometry as a round bar, so it can lift out of the heart and swing open.

export const HEART_SRC = '/demo/qtpass-body.svg';
export const PAD_X = 0.4; // room beside the heart for the swung shackle
export const PAD_TOP = 0.3; // and above it for the lifted one
const VIEW = 3230; // the logo's viewBox runs from (-1615, -1050) to (1615, 2180)

// The padlock at heart size S, its heart at (PAD_X * S, PAD_TOP * S): the shackle lifted by
// `lift` px and swung round its long left leg (swing 0 closed, 1 swung round).
export function drawPadlock(g, heart, S, lift, swing) {
  const px = PAD_X * S;
  const py = PAD_TOP * S;
  // The shackle is a round bar: turned round its left leg, its centre line is foreshortened,
  // but from any side the bar stays as thick as it is. So foreshorten only the path, and
  // stroke it untransformed. Logo units, y up, as in the logo's own transform.
  const k = S / VIEW;
  g.save();
  g.setTransform(k, 0, 0, -k, px + 1615 * k, py - lift + 2186 * k);
  g.save();
  g.translate(-630, 0);
  g.scale(Math.cos(swing * Math.PI), 1);
  g.translate(630, 0);
  g.beginPath();
  g.moveTo(-630, 0);
  g.lineTo(-630, 1320);
  g.arc(0, 1320, 630, Math.PI, 0, true);
  // A padlock's short leg: just into the heart (its top is at y 1030-1080 here), so lifted, it's out.
  g.lineTo(630, 900);
  g.restore();
  // The logo's shading across the bar: gray at the edges, silver in the middle. As nested
  // strokes, outside in, it looks the same from every side.
  for (let width = 360; width > 0; width -= 12) {
    const v = Math.round(128 + 64 * Math.min(1, Math.max(0, (0.45 - width / 720) / 0.35)));
    g.lineWidth = width;
    g.strokeStyle = `rgb(${v}, ${v}, ${v})`;
    g.stroke();
  }
  g.restore();
  g.drawImage(heart, px, py, S, S);
}
