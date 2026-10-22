/* =====================================================================
   Post-processing: bloom (bright-pass + separable blur at 1/4 res),
   then a cinematic composite — tone mapping, per-chapter grade,
   chromatic aberration, digital glitch, lens rain, film grain,
   vignette, letterbox and fades.
   ===================================================================== */
AG.SHADERS.quadVert = AG.SHADERS.header + `
in vec3 aPosition; in vec2 aTexCoord;
out vec2 vUv;
void main(){ vUv = aTexCoord; gl_Position = vec4(aPosition.xy, 0.0, 1.0); }
`;

AG.SHADERS.bright = {
  vert: AG.SHADERS.quadVert,
  frag: AG.SHADERS.header + `
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
void main(){
  vec3 c = vec3(0.0);
  c += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  c = clamp(c, 0.0, 64.0);
  if (any(isnan(c))) c = vec3(0.0);
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(uThreshold, uThreshold + 0.6, l);
  outColor = vec4(c * k, 1.0);
}
`
};

AG.SHADERS.blur = {
  vert: AG.SHADERS.quadVert,
  frag: AG.SHADERS.header + `
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc; uniform vec2 uDir;
void main(){
  vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
  c += texture(tSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(tSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}
`
};

AG.SHADERS.composite = {
  vert: AG.SHADERS.quadVert,
  frag: AG.SHADERS.header + `
in vec2 vUv; out vec4 outColor;
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBloom2;
uniform vec2  uRes;
uniform float uTime, uBloom, uExposure, uGlitch, uFade, uLetterbox, uGrain, uVignette;
uniform float uLens, uRainScreen, uFlash, uSat, uAberr;
uniform vec3  uLift, uGain;
uniform float uFreeze;
uniform float uSpeed, uWhite;

float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

/* Raindrops on the lens: a few drops that cling and slide. */
vec2 lensDrops(vec2 uv, float t, out float mask){
  vec2 n = vec2(0.0); mask = 0.0;
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  for (int L = 0; L < 2; L++){
    float sc = L == 0 ? 16.0 : 28.0;
    vec2 p = uv * aspect * sc;
    p.y += t * (L == 0 ? 0.05 : 0.12);
    vec2 id = floor(p); vec2 f = fract(p) - 0.5;
    vec2 r = h22(id + float(L) * 17.0);
    if (r.x > uLens) continue;
    vec2 c = (r - 0.5) * 0.6;
    c.y -= fract(t * (0.04 + r.y * 0.08) + r.x) * 0.0;
    vec2 dv = f - c; dv.y *= 1.3;
    float rad = 0.05 + r.y * 0.09;
    float m = smoothstep(rad, rad * 0.6, length(dv));
    n += dv * m * 1.2; mask = max(mask, m * smoothstep(rad, rad * 0.8, length(dv)) * (1.0 - smoothstep(rad * 0.5, rad * 0.8, length(dv))));
  }
  return n * 0.05;
}

void main(){
  vec2 uv = vUv;
  float t = uTime;
  // ---- digital interference: block displacement ----
  float gl = uGlitch;
  if (gl > 0.001){
    float rowH = floor(uv.y * (14.0 + 30.0 * h12(vec2(floor(t * 20.0), 1.0))));
    float g = step(1.0 - gl * 0.6, h12(vec2(rowH, floor(t * 24.0))));
    uv.x += (h12(vec2(rowH, floor(t * 31.0))) - 0.5) * 0.12 * g * gl;
  }
  float lm = 0.0;
  vec2 drop = vec2(0.0);
  if (uLens > 0.001) drop = lensDrops(uv, t, lm);
  uv += drop;
  // ---- chromatic aberration (radial + glitch) ----
  vec2 dc = uv - 0.5;
  float ab = uAberr * (0.002 + dot(dc, dc) * 0.012) + gl * 0.01;
  vec3 col;
  col.r = texture(tScene, uv + dc * ab * 2.0 + vec2(gl * 0.004, 0.0)).r;
  col.g = texture(tScene, uv).g;
  col.b = texture(tScene, uv - dc * ab * 2.0).b;
  vec3 bloom = texture(tBloom, uv).rgb + texture(tBloom2, uv).rgb * 0.8;
  col += bloom * uBloom;
  // lens drops catch and blur light
  col += texture(tBloom, uv).rgb * lm * 0.25; // a thin bright rim on each drop
  // ---- far rain as screen-space streaks ----
  if (uRainScreen > 0.001){
    vec2 ruv = vec2(uv.x * uRes.x / uRes.y, uv.y);
    float r = 0.0;
    for (int i = 0; i < 3; i++){
      float fi = float(i);
      vec2 s = vec2(80.0 + fi * 60.0, 2.5 + fi);
      vec2 q = ruv * s + vec2(ruv.y * 0.3 * s.x * 0.02, t * (6.0 + fi * 3.0));
      vec2 id = floor(q); vec2 f = fract(q);
      float hh = h12(id + fi * 31.0);
      r += step(0.86, hh) * smoothstep(0.4, 0.0, abs(f.x - 0.5)) * smoothstep(0.0, 0.3, f.y) * smoothstep(1.0, 0.5, f.y) * (0.4 - fi * 0.1);
    }
    col += vec3(0.5, 0.6, 0.85) * r * uRainScreen * 0.05;
  }
  col += vec3(0.6, 0.7, 1.0) * uFlash * 0.12;
  // ---- speed: radial zoom blur + luminous streak lines ----
  if (uSpeed > 0.01){
    vec2 c2 = vUv - 0.5;
    vec3 zb = vec3(0.0);
    for (int i = 1; i <= 6; i++){ zb += texture(tScene, uv - c2 * float(i) * 0.012 * uSpeed).rgb; }
    float edgeW = smoothstep(0.08, 0.55, length(c2));
    col = mix(col, zb / 6.0 + bloom * uBloom * 0.5, edgeW * uSpeed * 0.75);
    float ang = atan(c2.y, c2.x);
    float lane = floor(ang * 60.0);
    float lh = h12(vec2(lane, 3.0));
    float run = fract(length(c2) * 2.2 - t * (2.5 + lh * 3.0) + lh);
    float line = step(0.82, lh) * smoothstep(0.0, 0.08, run) * smoothstep(0.35, 0.1, run) * smoothstep(0.12, 0.5, length(c2));
    col += mix(vec3(1.0, 0.45, 0.85), vec3(0.45, 0.9, 1.0), lh) * line * uSpeed * 0.35;
  }
  // ---- inside the luminous cloud ----
  {
    // a drifting pink / violet / cyan veil, white only around the centre (where she is)
    vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
    float f1 = 0.5 + 0.5 * sin(q.x * 3.1 + q.y * 1.3 + t * 0.35);
    float f2 = 0.5 + 0.5 * sin(q.y * 3.7 - q.x * 1.9 + 2.0 - t * 0.27);
    vec3 veil = mix(vec3(1.0, 0.3, 0.75), vec3(0.58, 0.36, 1.0), f1);
    veil = mix(veil, vec3(0.3, 0.88, 1.0), smoothstep(0.5, 0.95, f2) * 0.8);
    veil = mix(veil, vec3(1.0, 0.94, 0.98), smoothstep(0.55, 0.0, length(q)) * 0.55);
    col = mix(col, veil * (0.75 + 0.35 * bloom), uWhite * 0.5);
  }
  // ---- tone map & grade ----
  col *= uExposure;
  col = aces(col);
  col = pow(max(col, vec3(0.0)), vec3(0.95));
  col = col * uGain + uLift * (1.0 - col);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uSat);
  // ---- vignette, grain, letterbox, fade ----
  vec2 vv = vUv - 0.5;
  col *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(vv * vec2(1.1, 1.0)));
  float grain = h12(vUv * uRes + fract(t * 13.7) * 100.0) - 0.5;
  col += grain * uGrain;
  float bar = uLetterbox * 0.5 * (1.0 - (uRes.x / uRes.y) / 2.39);
  bar = max(bar, 0.0);
  if (vUv.y < bar || vUv.y > 1.0 - bar) col *= 0.0;
  col *= 1.0 - uFade;
  // frozen frame (paused): a subtle cold desaturation
  col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(0.9, 0.95, 1.05), uFreeze * 0.35);
  outColor = vec4(col, 1.0);
}
`
};
