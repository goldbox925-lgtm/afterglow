/* =====================================================================
   Effect shaders: flying traffic, 3D rain, sky dome.
   ===================================================================== */

/* ---------- Flying traffic: lanes animated entirely on the GPU ------- */
AG.SHADERS.traffic = {
  vert: AG.SHADERS.header + AG.SHADERS.common + `
in vec3 aPosition; in vec3 aNormal; in vec2 aTexCoord; in vec4 aVertexColor;
uniform mat4 uView; uniform mat4 uProj; uniform float uTraffic;
out vec2 vUv; out float vCol; out vec3 vWorld; out float vFade;
void main(){
  vec4 d = aVertexColor; // phase, speed, colour, threshold
  float L = length(aNormal);
  float s = fract(d.r + uTime * d.g * 26.0 / L);
  vec3 p = aPosition + aNormal * s;
  p.y += sin(uTime * 0.7 + d.r * 40.0) * 0.6;
  float present = step(d.a, uTraffic);
  vec4 vp = uView * vec4(p, 1.0);
  float size = present * 1.3;
  vec3 dirV = normalize((uView * vec4(aNormal, 0.0)).xyz);
  vec2 dir2 = normalize(dirV.xy + 1e-4);
  vec2 perp = vec2(-dir2.y, dir2.x);
  vp.xy += (dir2 * aTexCoord.x * 2.6 + perp * aTexCoord.y * 0.9) * size;
  vUv = aTexCoord; vCol = d.b; vWorld = p;
  vFade = smoothstep(0.0, 0.03, s) * smoothstep(1.0, 0.97, s);
  gl_Position = uProj * vp;
}
`,
  frag: AG.SHADERS.header + AG.SHADERS.common + AG.SHADERS.fog + `
in vec2 vUv; in float vCol; in vec3 vWorld; in float vFade;
out vec4 outColor;
void main(){
  float r = length(vUv * vec2(1.0, 1.0));
  float g = exp(-r * r * 3.5);
  vec3 c = vCol < 0.25 ? vec3(1.0, 0.92, 0.8) : (vCol < 0.75 ? vec3(1.0, 0.12, 0.2) : vec3(0.3, 0.9, 1.0));
  vec3 col = c * g * 2.2 * vFade;
  col *= 1.0 - fogAmount(vWorld) * 0.85;
  outColor = vec4(col, 1.0);
}
`
};

/* ---------- Rain: thousands of streaks wrapped around the camera ------ */
AG.SHADERS.rain = {
  vert: AG.SHADERS.header + AG.SHADERS.common + AG.SHADERS.lights + `
in vec3 aPosition; in vec3 aNormal; in vec2 aTexCoord; in vec4 aVertexColor;
uniform mat4 uView; uniform mat4 uProj;
uniform float uRain, uWind, uBox;
uniform vec3 uVel;
uniform vec3 uAmbSky;
out vec2 vUv; out float vAlpha; out vec3 vLight;
void main(){
  vec4 d = aVertexColor;            // hash, speed, length, -
  float B = uBox;
  vec3 c = aPosition * B;          // seeded position inside unit box
  float speed = 14.0 + d.g * 9.0;
  c.y -= uTime * speed;
  c.x += uTime * uWind * 4.0;
  vec3 rel = mod(c - uCamPos + B * 0.5, B) - B * 0.5;
  vec3 p = uCamPos + rel;
  vec3 rv = vec3(uWind * 4.0, -speed, 0.0) - uVel;
  float rl = length(rv);
  float len = (0.5 + d.b * 0.9) * (0.6 + 0.4 * uRain) * max(1.0, rl / 18.0);
  vec3 dir = rv / max(rl, 1e-3);
  vec3 wp = p + dir * len * aTexCoord.y;
  vec4 vp = uView * vec4(wp, 1.0);
  vec3 dv = (uView * vec4(dir, 0.0)).xyz;
  vec2 side = normalize(vec2(-dv.y, dv.x) + 1e-5);
  float dist = length(rel);
  float w = 0.006 + dist * 0.0012;
  vp.xy += side * aTexCoord.x * w;
  float present = step(d.r, uRain);
  vAlpha = present * smoothstep(0.4, 2.0, dist) * smoothstep(B * 0.5, B * 0.3, dist);
  vUv = aTexCoord;
  vLight = uAmbSky * 1.6 + pointLights(wp, normalize(uCamPos - wp), normalize(uCamPos - wp), 8.0, 0.0, 1.0) * 0.5;
  gl_Position = uProj * vp;
}
`,
  frag: AG.SHADERS.header + `
in vec2 vUv; in float vAlpha; in vec3 vLight;
out vec4 outColor;
void main(){
  float a = (1.0 - abs(vUv.x)) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.6, vUv.y) * vAlpha;
  outColor = vec4(vLight * a * 0.55, 1.0);
}
`
};

/* ---------- Sky dome ------------------------------------------------- */
AG.SHADERS.sky = {
  vert: AG.SHADERS.header + `
in vec3 aPosition;
uniform mat4 uView; uniform mat4 uProj; uniform vec3 uCamPos;
out vec3 vDir;
void main(){
  vDir = aPosition;
  vec4 vp = uView * vec4(uCamPos + aPosition * 3000.0, 1.0);
  gl_Position = uProj * vp;
  gl_Position.z = gl_Position.w * 0.99999;
}
`,
  frag: AG.SHADERS.header + AG.SHADERS.common + `
in vec3 vDir; out vec4 outColor;
uniform vec3 uZenith, uHorizon, uCityGlow;
uniform float uFlash, uDawn, uCloud, uFlashX, uSun;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, h));
  col += uCityGlow * exp(-max(h, 0.0) * 9.0) * smoothstep(-0.2, 0.0, h);
  // dawn: a seam of warm light low in the east (+x, slightly ahead)
  vec3 dawnDir = normalize(vec3(0.55, 0.05, -0.83));
  float dd = max(dot(d, dawnDir), 0.0);
  col += uDawn * (vec3(1.0, 0.55, 0.32) * pow(dd, 10.0) * 0.8 + vec3(0.9, 0.35, 0.55) * exp(-max(h, 0.0) * 6.0) * 0.18);
  // the sun itself, rising: a hot disc, a wide warm bloom, cyan-violet upper sky
  col += uSun * (vec3(1.0, 0.92, 0.82) * smoothstep(0.99935, 0.99965, dd) * 6.0 + vec3(1.0, 0.6, 0.45) * pow(dd, 120.0) * 1.2 + vec3(1.0, 0.42, 0.6) * pow(dd, 18.0) * 0.35);
  col += uSun * vec3(0.18, 0.35, 0.6) * smoothstep(0.1, 0.8, h) * 0.6;
  // clouds: two layers of drifting fbm, lit from below by the city
  vec2 uv = d.xz / max(h + 0.12, 0.05);
  float c1 = fbm2(uv * 1.3 + vec2(uTime * 0.012, uTime * 0.004));
  float c2 = fbm2(uv * 3.1 - vec2(uTime * 0.02, 0.0) + 4.0);
  float clouds = smoothstep(0.42, 0.85, c1 * 0.7 + c2 * 0.45) * smoothstep(-0.02, 0.2, h) * uCloud;
  vec3 cloudCol = mix(uHorizon * 0.9 + uCityGlow * 0.5, uZenith * 1.6, smoothstep(0.0, 0.6, h));
  // lightning illuminates clouds from inside
  float fa = (atan(d.x, -d.z) - uFlashX) * 1.4;
  float fl = uFlash * (0.4 + 1.6 * exp(-fa * fa));
  cloudCol += vec3(0.55, 0.62, 0.9) * fl * (0.5 + c2);
  col = mix(col, cloudCol, clouds * 0.85);
  col += vec3(0.4, 0.45, 0.7) * uFlash * 0.25 * smoothstep(0.0, 0.5, h);
  outColor = vec4(col, 1.0);
}
`
};
