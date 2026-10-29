// Groene damp die rustig opstijgt (WebGL). Scrollen geeft extra beweging.
// Valt terug op de stilstaande afbeelding als WebGL niet beschikbaar is.
(() => {
  const host = document.getElementById('bg');
  if (!host) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.id = 'vapor';
  const gl = cv.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) { host.classList.add('static'); return; }
  host.appendChild(cv);
  host.classList.add('live');

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision mediump float;
uniform vec2 res; uniform float t; uniform float off; uniform float boost;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int k=0;k<5;k++){ v+=a*n(p); p=m*p; a*=.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = vec2(uv.x * res.x / res.y * 3.0, uv.y * 1.8);   // verticaal uitgerekt: slierten die opstijgen
  p.y -= t * .055 + off;                       // omhoog stijgen + mee met scrollen
  vec2 q = vec2(fbm(p + vec2(0., t*.02)), fbm(p + vec2(5.2, 1.3) - t*.015));
  vec2 r = vec2(fbm(p + 3.2*q + vec2(1.7, 9.2) + t*.035), fbm(p + 3.2*q + vec2(8.3, 2.8) - t*.03));
  float f = fbm(p + 3.4*r + vec2(0., -t*.02));
  float d = smoothstep(.44, .95, f) * (.5 + .8*length(q - .5));
  d *= mix(1.05, .55, uv.y);                   // dichter onderin, ijler naar boven
  d = clamp(d * (1. + boost*.35), 0., 1.);
  vec3 dark = vec3(.015, .07, .025), mid = vec3(.05, .30, .09), hi = vec3(.20, .55, .22);
  vec3 c = mix(dark, mid, d); c = mix(c, hi, smoothstep(.62, 1., d));
  gl_FragColor = vec4(c * smoothstep(0., .25, d + .05), 1.);
}`;
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); host.classList.remove('live'); host.classList.add('static'); return; }
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const uRes = U('res'), uT = U('t'), uOff = U('off'), uBoost = U('boost');

  // lage resolutie: damp is toch zacht, en het spaart de accu
  const SCALE = 0.33;
  function size() {
    const w = Math.max(64, Math.round(innerWidth * SCALE)), h = Math.max(64, Math.round(innerHeight * SCALE));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uRes, w, h);
  }
  addEventListener('resize', size); size();

  // scrollen: verschuiving + tijdelijke versnelling
  let lastY = scrollY, vel = 0, off = 0, time = Math.random() * 100;
  addEventListener('scroll', () => { const y = scrollY; vel += Math.abs(y - lastY); lastY = y; }, { passive: true });

  let prev = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { prev = now; return; }
    const dt = Math.min(.1, (now - prev) / 1000); prev = now;
    acc += dt; if (acc < 1 / 30) return;            // max 30 beelden per seconde
    const step = acc; acc = 0;
    const boost = Math.min(4, vel / 60); vel *= Math.pow(.04, step);   // uitdempen
    time += step * (reduce ? 0 : (1 + boost * 1.6));
    off += ((scrollY * .0011) - off) * Math.min(1, step * 4);          // zacht meeschuiven
    gl.uniform1f(uT, time); gl.uniform1f(uOff, off); gl.uniform1f(uBoost, boost);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  requestAnimationFrame(frame);
})();
