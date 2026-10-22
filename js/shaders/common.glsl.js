/* =====================================================================
   Shared GLSL (ES 3.00 / WebGL2). Included at the top of every shader.
   Shaders live in .glsl.js files (GLSL inside JS template strings) so
   they load with plain <script> tags: no fetch(), no CORS issues, works
   identically on localhost and GitHub Pages.
   ===================================================================== */
window.AG = window.AG || {};
AG.SHADERS = AG.SHADERS || {};

AG.SHADERS.header = `#version 300 es
precision highp float;
precision highp int;
`;

AG.SHADERS.common = `
#define PI 3.14159265
uniform vec3  uCamPos;
uniform float uTime;

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }

float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 157.0 + 113.0 * i.z;
  return mix(mix(mix(hash11(n), hash11(n + 1.0), f.x), mix(hash11(n + 157.0), hash11(n + 158.0), f.x), f.y),
             mix(mix(hash11(n + 113.0), hash11(n + 114.0), f.x), mix(hash11(n + 270.0), hash11(n + 271.0), f.x), f.y), f.z);
}
float vnoise2(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

/* Palette: electric cyan, blue, neon magenta, violet, amber. */
vec3 neonHue(float h){
  h = fract(h);
  if (h < 0.30) return vec3(0.12, 0.92, 1.00);
  if (h < 0.45) return vec3(0.20, 0.42, 1.00);
  if (h < 0.75) return vec3(1.00, 0.14, 0.60);
  if (h < 0.90) return vec3(0.62, 0.26, 1.00);
  return vec3(1.00, 0.56, 0.22);
}
`;

/* Fog with exponential height falloff: streets drown in haze, crowns
   rise above it. Colour leans to the city's glow near the ground. */
AG.SHADERS.fog = `
uniform float uFogDensity;
uniform float uFogFalloff;
uniform vec3  uFogLow;
uniform vec3  uFogHigh;
float fogAmount(vec3 wp){
  vec3 rd = wp - uCamPos; float dist = length(rd); rd /= max(dist, 1e-4);
  float k = rd.y * uFogFalloff;
  float term = abs(k) < 1e-5 ? dist : (1.0 - exp(-dist * k)) / k;
  float f = uFogDensity * exp(-uCamPos.y * uFogFalloff) * term;
  return clamp(1.0 - exp(-max(f, 0.0)), 0.0, 1.0);
}
vec3 fogColor(vec3 wp){
  vec3 rd = normalize(wp - uCamPos);
  return mix(uFogLow, uFogHigh, smoothstep(-0.25, 0.45, rd.y));
}
vec3 applyFog(vec3 col, vec3 wp){ return mix(col, fogColor(wp), fogAmount(wp)); }
`;

/* A handful of moving point lights shared by the rooftop, the figure
   and nearby rain (the fallen sign, a hologram spill, lightning...). */
AG.SHADERS.lights = `
uniform vec3 uLightPos[4];
uniform vec3 uLightCol[4];
vec3 pointLights(vec3 wp, vec3 N, vec3 V, float shininess, float specAmt, float wrap){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++){
    vec3 Lv = uLightPos[i] - wp; float d2 = dot(Lv, Lv); vec3 L = Lv * inversesqrt(max(d2, 1e-4));
    float att = 1.0 / (1.0 + d2 * 0.35);
    float diff = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), shininess) * specAmt;
    acc += uLightCol[i] * att * (diff + spec);
  }
  return acc;
}
`;

/* Restoration FIELD (AG.Restoration): a top-down image of the whole city.
   L = max(r,g,b) = how much light the viewer has brought back here,
   rgb / L = the colour of that light. Persistent: it only ever grows. */
AG.SHADERS.field = `
uniform sampler2D tField;
uniform vec3 uFieldBox;     // x0, z0, size (metres)
vec4 fieldAt(vec3 p){
  vec2 uv = (p.xz - uFieldBox.xy) / uFieldBox.z;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(1.0, 1.0, 1.0, 0.0);
  vec3 c = texture(tField, uv).rgb;
  float L = max(c.r, max(c.g, c.b));
  return vec4(L > 0.004 ? c / L : vec3(1.0), L);
}
`;

/* Travelling restoration FRONTS (the 8 most recent growing sources).
   xyz = centre, w = current radius; colour rgb + a = front intensity. */
AG.SHADERS.spots = `
#define NSPOT 8
uniform vec4 uSpot[NSPOT];
uniform vec4 uSpotC[NSPOT];
float spotLocal(vec3 p, out vec3 col, out float front, out vec3 frontCol){
  float best = 0.0; col = vec3(0.0); front = 0.0; frontCol = vec3(1.0);
  for (int i = 0; i < NSPOT; i++){
    vec4 s = uSpot[i];
    if (s.w <= 0.0) continue;
    float d = length(vec2(length(p.xz - s.xz), (p.y - s.y) * 0.35));
    float a = 1.0 - smoothstep(s.w * 0.82, s.w, d);
    if (a > best){ best = a; col = uSpotC[i].rgb; }
    float f = uSpotC[i].a * exp(-abs(d - s.w) / 3.2);
    if (f > front){ front = f; frontCol = uSpotC[i].rgb; }
  }
  return best;
}
`;
