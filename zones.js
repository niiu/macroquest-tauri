/* Shared geometry for drawing and hit testing; coordinates survive image resizing. */
(function installQuestZones(root) {
  'use strict';
  const colors = ['#f28372', '#84c9fa', '#d7b5fa', '#f5cb70', '#7eddb1', '#f49ac1'];
  const color = index => colors[index % colors.length];
  function validStrokes(strokes) {
    return Array.isArray(strokes) && strokes.length <= 5000 && strokes.every(s =>
      s && ['paint', 'erase'].includes(s.mode) && (s.shape===undefined||s.shape==='rect') && (s.shape!=='rect'||s.points?.length===2) && Number.isFinite(s.radius) && s.radius > 0 && s.radius <= 1 &&
      Array.isArray(s.points) && s.points.length > 0 && s.points.length <= 20000 &&
      s.points.every(p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(v) && v >= 0 && v <= 1)));
  }
  function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function strokeContains(stroke, x, y, width, height) {
    const points = stroke.points, radius = stroke.radius * Math.min(width, height);
    if(stroke.shape==='rect'){const [a,b]=points;return x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]);}
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)], b = points[i];
      if (distanceToSegment(x * width, y * height, a[0] * width, a[1] * height, b[0] * width, b[1] * height) <= radius) return true;
    }
    return false;
  }
  function contains(strokes, x, y, width, height) {
    // The most recent stroke at this point decides coverage in this action only.
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokeContains(strokes[i], x, y, width, height)) return strokes[i].mode === 'paint';
    }
    return false;
  }
  function hit(choices, x, y, width, height) {
    for (let i = choices.length - 1; i >= 0; i--) {
      if (contains(choices[i].zone || [], x, y, width, height)) return i;
    }
    return -1;
  }
  function drawStroke(ctx, stroke, width, height) {
    const radius = stroke.radius * Math.min(width, height);
    ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    if(stroke.shape==='rect'){const [a,b]=stroke.points;ctx.fillRect(Math.min(a[0],b[0])*width,Math.min(a[1],b[1])*height,Math.abs(a[0]-b[0])*width,Math.abs(a[1]-b[1])*height);return;}
    ctx.lineWidth = radius * 2;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    stroke.points.forEach((p, i) => i ? ctx.lineTo(p[0] * width, p[1] * height) : ctx.moveTo(p[0] * width, p[1] * height));
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.arc(p[0] * width, p[1] * height, radius, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.stroke();
  }
  function draw(canvas, choices, active = -1) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const layer = document.createElement('canvas');
    layer.width = w; layer.height = h;
    const lc = layer.getContext('2d');
    const inner=document.createElement('canvas');inner.width=w;inner.height=h;const ic=inner.getContext('2d');
    const thickness=Math.max(2,Math.round(w/(canvas.getBoundingClientRect?.().width||w)*2));
    choices.forEach((choice, i) => {
      if (!choice.zone?.length) return;
      lc.globalCompositeOperation='source-over';lc.clearRect(0, 0, w, h);
      lc.fillStyle = lc.strokeStyle = color(i);
      for (const stroke of choice.zone || []) drawStroke(lc, stroke, w, h);
      // Erode the completed mask, then subtract it: overlaps have no seams and erased holes have borders.
      ic.globalCompositeOperation='source-over';ic.clearRect(0,0,w,h);ic.drawImage(layer,0,0);ic.globalCompositeOperation='destination-in';
      for(const [dx,dy] of [[thickness,0],[-thickness,0],[0,thickness],[0,-thickness]])ic.drawImage(layer,dx,dy);
      ic.clearRect(0,0,w,thickness);ic.clearRect(0,h-thickness,w,thickness);ic.clearRect(0,0,thickness,h);ic.clearRect(w-thickness,0,thickness,h);
      lc.globalCompositeOperation='destination-out';lc.drawImage(inner,0,0);
      ctx.globalAlpha = active === -1 || i === active ? 1 : .5;
      ctx.drawImage(layer, 0, 0);
    });
    ctx.globalAlpha = 1;
  }
  const api = {color, validStrokes, contains, hit, draw};
  api.standaloneSource = () => `(${installQuestZones.toString()})(globalThis);`;
  if (typeof module !== 'undefined') module.exports = api;
  else root.QuestZones = api;
})(globalThis);
