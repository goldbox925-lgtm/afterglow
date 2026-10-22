/* =====================================================================
   Neon shader (additive): signs, edge strips, holographic ads, light
   beams, aircraft lights. Each element has a power threshold; as the
   restoration value sweeps outward from her rooftop, signs stutter
   through a neon warm-up flicker and then hold.
   ===================================================================== */
AG.SHADERS.neon = {
  vert: AG.SHADERS.header + AG.SHADERS.common + `
in vec3 aPosition; in vec3 aNormal; in vec2 aTexCoord; in vec4 aVertexColor;
uniform mat4 uView; uniform mat4 uProj;
uniform float uInstability, uGlitch;
out vec3 vWorld; out vec3 vNormal; out vec2 vUv; out vec4 vData;
void main(){
  vec3 p = aPosition; vec4 d = aVertexColor;
  float type = d.b;
  if (type > 0.65 && type < 0.75){
    // searchlight beam: slow sway, more with height
    float k = max(p.y - 100.0, 0.0) / 600.0;
    p.x += sin(uTime * 0.11 + d.r * 20.0) * 160.0 * k;
    p.z += cos(uTime * 0.09 + d.r * 13.0) * 160.0 * k;
  }
  if (d.a > 0.0){
    float hgt = max(p.y, 0.0);
    float n1 = vnoise(vec3(p.x * 0.012, p.y * 0.02 + uTime * 0.5, p.z * 0.012)) - 0.5;
    float n2 = vnoise(vec3(p.z * 0.012 + 7.0, p.y * 0.02 - uTime * 0.4, p.x * 0.012)) - 0.5;
    p.xz += vec2(n1, n2) * uInstability * hgt * 0.06;
  }
  vWorld = p; vNormal = aNormal; vUv = aTexCoord; vData = d;
  gl_Position = uProj * uView * vec4(p, 1.0);
}
`,
  frag: AG.SHADERS.header + AG.SHADERS.common + AG.SHADERS.fog + AG.SHADERS.spots + `
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in vec4 vData;
out vec4 outColor;
uniform sampler2D tAtlas;
uniform float uRestore, uSurvivor, uGlitch, uPulse, uSeam, uHoloPower, uBeamPower;
uniform float uHeroA, uHeroB, uHeroALetters, uSmallLight;
uniform vec3  uLightTint, uBands;
uniform vec3  uCharPos;
uniform float uCharGlow;

float sdHeart(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)), dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}

/* power: 0..1 with a neon warm-up stutter as the restoration wave passes */
float gL = 0.0;   // viewer-restored area at this fragment
float power(float hsh, float distN, float survRate){
  float rs = uRestore * 1.45;
  float onT = hsh * 0.45 + distN * 0.9;
  float x = rs - onT;
  float stut = step(0.45, hash11(floor(uTime * 22.0) + hsh * 91.0));
  float on = x > 0.09 ? 1.0 : (x > 0.0 ? stut * smoothstep(0.0, 0.09, x) + step(0.07, x) : 0.0);
  float surv = step(hsh, survRate);
  float sflick = surv * step(0.3, vnoise(vec3(uTime * 5.0, hsh * 40.0, 0.0))) * (0.5 + 0.5 * hash11(floor(uTime * 15.0) + hsh * 13.0));
  float onL = smoothstep(hsh * 0.5, hsh * 0.5 + 0.06, gL * 1.2);
  return max(max(clamp(on, 0.0, 1.0), sflick), onL);
}

vec3 holo(vec2 uv, float design, float hsh, vec3 hc, out float alpha){
  float t = uTime;
  // glitch tearing
  float row = floor(uv.y * 48.0);
  float tear = step(1.0 - (0.08 + uGlitch * 0.5 + (1.0 - uHoloPower) * 0.3), hash11(row + floor(t * 18.0) * 7.0 + hsh));
  uv.x += (hash11(row * 3.1 + floor(t * 18.0)) - 0.5) * 0.25 * tear;
  float scan = 0.75 + 0.25 * sin(uv.y * 420.0 + t * 8.0);
  float edge = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x) * smoothstep(0.0, 0.04, uv.y) * smoothstep(1.0, 0.96, uv.y);
  vec3 c = vec3(0.0); float a = 0.0;
  if (design < 0.5){
    // THE BROKEN HEART. Silence: two halves drift apart, flickering.
    // Reconnection: they close and the crack is filled with gold.
    vec2 p = (uv - vec2(0.5, 0.42)) * 2.6;
    float gap = 0.22 * (1.0 - uSeam);
    float sideS = sign(p.x + 0.0001);
    vec2 ph = p - vec2(sideS * gap, sideS * gap * 0.25);
    float crackX = 0.12 * sin(ph.y * 9.0) + 0.06 * sin(ph.y * 23.0);
    float beat = 1.0 + uPulse * 0.07;
    float dh = sdHeart(vec2(ph.x, ph.y + 0.55) / beat);
    float shape = smoothstep(0.02, -0.02, dh);
    float rim = smoothstep(0.05, 0.0, abs(dh)) ;
    float crack = smoothstep(0.035, 0.0, abs(ph.x - crackX));
    vec3 hcol = mix(vec3(1.0, 0.15, 0.55), vec3(1.0, 0.45, 0.6), uSeam);
    c = hcol * (shape * 0.35 + rim * 1.4) * (1.0 - crack * (1.0 - uSeam));
    c += vec3(1.0, 0.72, 0.35) * crack * shape * uSeam * 2.5;
    a = max(shape * 0.5, rim);
  } else if (design < 1.5){
    // equaliser bars driven by the soundtrack
    float bars = 18.0; float b = floor(uv.x * bars); float fx = fract(uv.x * bars);
    float band = b / bars;
    float lvl = band < 0.33 ? uBands.x : band < 0.66 ? uBands.y : uBands.z;
    float hgt = 0.15 + 0.7 * lvl * (0.55 + 0.45 * vnoise(vec3(b * 3.0, t * 2.5, hsh))) ;
    float on = step(uv.y, hgt) * step(0.15, fx) * step(fx, 0.85) * step(0.5, fract(uv.y * 40.0));
    c = hc * on * 1.4; a = on;
  } else if (design < 2.5){
    // concentric rings & a sweeping radar line
    vec2 p = uv - 0.5; p.x *= 0.7;
    float r = length(p);
    float rings = smoothstep(0.02, 0.0, abs(fract(r * 8.0 - t * 0.35) - 0.5) - 0.44);
    float ang = atan(p.y, p.x);
    float sweep = pow(fract((ang / 6.2832) + t * 0.12), 8.0);
    c = hc * (rings * 0.9 + sweep * 0.8) * smoothstep(0.5, 0.2, r); a = max(rings, sweep) * smoothstep(0.5, 0.2, r);
  } else {
    // falling glyph columns
    float cols = 10.0; float ci = floor(uv.x * cols);
    float sp = 0.15 + hash11(ci + hsh * 10.0) * 0.3;
    float y = uv.y + t * sp;
    float gi = floor(y * 22.0);
    vec2 gf = vec2(fract(uv.x * cols), fract(y * 22.0));
    float glyph = step(0.45, hash12(vec2(ci, gi) + floor(gf * 3.0) * 7.1)) * step(0.15, gf.x) * step(gf.x, 0.85) * step(0.1, gf.y) * step(gf.y, 0.9);
    float headF = pow(fract(-y * 0.6 + hash11(ci) * 3.0), 6.0);
    c = hc * glyph * (0.25 + headF * 1.8); a = glyph * (0.3 + headF);
  }
  alpha = a * edge;
  return c * scan * edge;
}

void main(){
  { vec3 c_; float f_; vec3 fc_; gL = spotLocal(vWorld, c_, f_, fc_); }
  vec4 d = vData;
  float type = d.b, hsh = d.r, distN = d.a;
  vec3 hc = neonHue(d.g);
  vec3 col = vec3(0.0);
  float fog = fogAmount(vWorld);

  if (type < 0.05){
    // ---- atlas sign ----
    vec4 tx = texture(tAtlas, vUv);
    float letter = floor(tx.b * 255.0 / 20.0 + 0.5);
    float pw = power(hsh, distN, uSurvivor * 1.6);
    float broken = step(hash11(letter * 7.3 + hsh * 31.0), 0.18 * (1.0 - uRestore));
    pw *= 1.0 - broken * step(0.3, hash11(floor(uTime * 9.0) + letter));
    vec3 c = mix(hc, uLightTint, 0.3 * step(0.5, pw) * step(hsh, 0.6));
    col = c * tx.g * 1.1 * pw + mix(c, vec3(1.0), 0.6) * tx.r * 2.4 * pw;
    col += vec3(0.05, 0.05, 0.07) * tx.r * (1.0 - pw); // dead glass tube catches a little light
  } else if (type < 0.125){
    // ---- the fallen LOVE sign beside her ----
    vec4 tx = texture(tAtlas, vUv);
    float letter = floor(tx.b * 255.0 / 20.0 + 0.5);
    float alive = step(letter, uHeroALetters + 0.5);
    float pw = uHeroA * alive;
    vec3 c = vec3(1.0, 0.12, 0.5);
    col = c * tx.g * 1.3 * pw + mix(c, vec3(1.0), 0.55) * tx.r * 2.8 * pw;
    col += vec3(0.06, 0.05, 0.07) * tx.r * (1.0 - pw);
  } else if (type < 0.2){
    // ---- the same sign, re-lit with new words ----
    vec4 tx = texture(tAtlas, vUv);
    vec3 c = vec3(1.0, 0.66, 0.32);
    col = c * tx.g * 1.3 * uHeroB + mix(c, vec3(1.0), 0.6) * tx.r * 2.6 * uHeroB;
  } else if (type < 0.4){
    // ---- edge strips ----
    float pw = power(hsh, distN, uSurvivor * 1.2);
    vec3 c = mix(hc, uLightTint, 0.3 * step(hsh, 0.5));
    col = c * 1.7 * pw;
  } else if (type < 0.6){
    // ---- holographic advertisements ----
    float design = floor(vUv.x);
    vec2 uv = vec2(fract(vUv.x), vUv.y);
    float a;
    vec3 h = holo(uv, design, hsh, hc, a);
    float flick = step(0.25, vnoise(vec3(uTime * 7.0, hsh * 30.0, 1.0)));
    float pw = mix(0.35 * flick + 0.15, 1.0, max(uHoloPower, gL));
    if (design < 0.5) pw = mix(0.55 * (0.5 + 0.5 * flick), 1.1, uSeam);
    col = h * pw * 1.2;
  } else if (type < 0.75){
    // ---- searchlight beams ----
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorld);
    float facing = pow(abs(dot(N, V)), 1.5);
    float along = pow(1.0 - vUv.y, 1.6);
    float on = smoothstep(hsh * 0.4 + 0.45, hsh * 0.4 + 0.6, uRestore) * uBeamPower;
    col = mix(vec3(0.55, 0.75, 1.0), hc, 0.4) * facing * along * on * 0.16;
    fog *= 0.35; // beams live *in* the fog
  } else if (type < 0.9){
    // ---- small practical lights (stair door) ----
    col = vec3(1.0, 0.72, 0.45) * uSmallLight * 2.0;
  } else {
    // ---- aircraft warning lights ----
    float blink = step(fract(uTime * 0.5 + hsh * 3.0), 0.12);
    float alive = max(step(hsh, 0.35 + uRestore), 0.0);
    col = vec3(1.0, 0.08, 0.05) * blink * alive * 4.0;
  }
  col *= 1.0 + exp(-length(vWorld - uCharPos) / 26.0) * uCharGlow * 2.5;
  col *= (1.0 - fog);
  outColor = vec4(col, 1.0);
}
`
};
