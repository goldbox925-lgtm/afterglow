/* =====================================================================
   Character shaders.
   · CHARACTER: a transparent PNG on a plane in the 3D world. The plane is
     slightly larger than the subject so a soft aura can be drawn OUTSIDE
     her silhouette from the image's own alpha. Scene light tints her;
     the image's glowing fabric keeps its own light. Pose changes dissolve
     through a glowing noise edge. Fog applies like everything else.
     uMode 0 = image · 1 = contact shadow · 2 = soft aura sprite
   · PARTICLES: GPU-animated billboards (positions computed per frame in
     the vertex shader — one draw call each):
     uKind 0 = light trail behind her (follows her recent path)
           1 = sparks of the aura while she levitates / flies
           2 = the luminous cloud (pink, violet, cyan, white)
   ===================================================================== */
AG.SHADERS.character = {
  vert: AG.SHADERS.header + `
in vec3 aPosition; in vec2 aTexCoord;
uniform mat4 uView; uniform mat4 uProj;
uniform vec3 uCenter, uRight, uUp;
out vec2 vUv; out vec3 vWorld;
void main(){
  vec3 wp = uCenter + uRight * aPosition.x * 0.5 + uUp * aPosition.y * 0.5;
  vUv = aTexCoord; vWorld = wp;
  gl_Position = uProj * uView * vec4(wp, 1.0);
}
`,
  frag: AG.SHADERS.header + AG.SHADERS.common + AG.SHADERS.fog + `
in vec2 vUv; in vec3 vWorld;
out vec4 outColor;
uniform sampler2D tTex;
uniform vec4  uUvRect;          // image-space rect the plane covers (u0, v0 top, u1, v1 bottom)
uniform vec2  uHalo;            // halo sampling radius in image uv
uniform float uMode, uAlpha, uDissolve, uAura, uFlash, uEmissiveKeep;
uniform vec3  uLightMul, uRimCol, uAuraCol;

float aAt(vec2 iuv){
  if (iuv.x < 0.0 || iuv.x > 1.0 || iuv.y < 0.0 || iuv.y > 1.0) return 0.0;
  return texture(tTex, iuv).a;
}

void main(){
  if (uMode > 0.5 && uMode < 1.5){
    // contact shadow on the roof
    float r = length(vUv * 2.0 - 1.0);
    // a soft wide falloff + a tight dark core where her body meets the concrete
    float a = ((1.0 - smoothstep(0.15, 1.0, r)) * 0.5 + (1.0 - smoothstep(0.0, 0.45, r)) * 0.32) * uAlpha;
    a = min(a, 0.85);
    outColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  if (uMode > 1.5){
    // soft aura sprite behind her
    float r = length(vUv * 2.0 - 1.0);
    float g = exp(-r * r * 3.2) * uAura * uAlpha;
    vec3 c = mix(uAuraCol, vec3(1.0), exp(-r * r * 14.0) * 0.6);
    outColor = vec4(c * g * (1.0 - fogAmount(vWorld) * 0.7), g * 0.35);
    return;
  }
  vec2 iuv = vec2(mix(uUvRect.x, uUvRect.z, vUv.x), mix(uUvRect.w, uUvRect.y, vUv.y));
  bool inside = iuv.x >= 0.0 && iuv.x <= 1.0 && iuv.y >= 0.0 && iuv.y <= 1.0;
  vec4 tx = inside ? texture(tTex, iuv) : vec4(0.0);
  // halo from the image's own alpha: far ring = aura, near ring = rim
  float far = 0.0, near = 0.0;
  for (int i = 0; i < 8; i++){
    float a = float(i) * 0.785398;
    vec2 d = vec2(cos(a), sin(a));
    far  += aAt(iuv + d * uHalo);
    near += aAt(iuv + d * uHalo * 0.25);
  }
  far /= 8.0; near /= 8.0;
  // light: the scene tints her; the glowing holographic fabric keeps its own light
  // p5 uploads textures premultiplied: recover straight colour
  vec3 rgb = tx.a > 0.004 ? tx.rgb / tx.a : vec3(0.0);
  float mx = max(max(rgb.r, rgb.g), rgb.b), mn = min(min(rgb.r, rgb.g), rgb.b);
  float emissive = smoothstep(0.45, 0.95, mx) * smoothstep(0.15, 0.5, mx - mn);
  vec3 lit = rgb * uLightMul;
  vec3 col = mix(lit, rgb * 1.15, emissive * uEmissiveKeep);
  float rim = tx.a * (1.0 - near) ;
  col += uRimCol * rim * 1.6;
  col += uFlash * vec3(1.0, 0.85, 0.95) * tx.a;
  // pose change: a glowing noise edge reshapes her
  float n = vnoise(vec3(vUv * vec2(26.0, 38.0), 3.0)) * 0.7 + vnoise(vec3(vUv * 90.0, 7.0)) * 0.3;
  float keep = smoothstep(uDissolve - 0.03, uDissolve + 0.03, n);
  float edge = exp(-abs(n - uDissolve) * 38.0) * step(0.001, uDissolve) * step(uDissolve, 0.999);
  float a = tx.a * keep * uAlpha;
  col = applyFog(col, vWorld);
  vec3 halo = uAuraCol * far * (1.0 - tx.a) * uAura;
  vec3 edgeGlow = mix(uAuraCol, vec3(1.0), 0.5) * edge * tx.a * 2.0;
  float fogK = 1.0 - fogAmount(vWorld) * 0.8;
  // premultiplied: image + additive aura/edge light
  vec3 pm = col * a + (halo * 0.9 + edgeGlow) * uAlpha * fogK;
  float outA = clamp(a + far * (1.0 - tx.a) * uAura * 0.25 * uAlpha, 0.0, 1.0);
  if (outA < 0.002 && dot(pm, pm) < 1e-6) discard;
  outColor = vec4(pm, outA);
}
`
};

AG.SHADERS.particles = {
  vert: AG.SHADERS.header + AG.SHADERS.common + `
in vec3 aPosition; in vec2 aTexCoord; in vec4 aVertexColor;
uniform mat4 uView; uniform mat4 uProj;
uniform float uKind, uAmount, uSpeed;
uniform vec3 uTrail[24];
uniform vec3 uCharPos;
uniform vec3 uCloudC, uCloudR;
uniform vec3 uBeaconPos, uBeaconRight, uBeaconUp;
uniform float uBeacon, uBeaconHint;
out vec2 vUv; out vec3 vCol; out float vA; out vec3 vWorld;
vec3 pick(float h){
  if (h < 0.3) return vec3(1.0, 0.32, 0.78);
  if (h < 0.55) return vec3(0.62, 0.38, 1.0);
  if (h < 0.8) return vec3(0.3, 0.92, 1.0);
  return vec3(1.0, 0.95, 1.0);
}
void main(){
  vec3 s = aPosition; vec4 q = aVertexColor;
  vec3 p; float size; float a;
  if (uKind < 0.5){
    float age = fract(s.x + uTime * (0.55 + q.z * 0.6));
    float fi = age * 22.0; int i = int(floor(fi));
    p = mix(uTrail[i], uTrail[i + 1], fract(fi));
    vec3 j = (vec3(hash11(s.y * 91.0), hash11(s.z * 57.0), hash11(s.x * 33.0)) - 0.5) * 2.0;
    p += j * (0.12 + age * (0.8 + 1.8 * uSpeed));
    p.y -= age * age * 0.6;
    size = (0.035 + 0.16 * age * (0.4 + q.y)) * (1.0 + uSpeed);
    a = pow(1.0 - age, 1.6) * uAmount;
  } else if (uKind < 1.5){
    float life = fract(q.w + uTime * (0.25 + q.z * 0.3));
    vec3 dir = normalize(s - 0.5 + 1e-3);
    float r = 0.35 + s.x * 1.0;
    p = uCharPos + dir * r * (0.7 + 0.5 * life) + vec3(0.0, life * 1.6 - 0.7, 0.0);
    size = 0.018 + 0.04 * q.y;
    a = sin(life * PI) * uAmount;
  } else if (uKind > 2.5){
    // THE PULSE: a window that is still alive (3 = the window on the facade,
    // 4 = its halo, never smaller than ~1% of the view, 5 = the hint light shaft)
    float beat = pow(0.5 + 0.5 * sin(uTime * 3.4), 6.0) + 0.6 * pow(0.5 + 0.5 * sin(uTime * 3.4 - 0.9), 10.0);
    float dc = length(uBeaconPos - uCamPos);
    if (uKind < 3.5){
      p = uBeaconPos + uBeaconRight * aTexCoord.x * 0.95 + uBeaconUp * aTexCoord.y * 1.25;
      size = 0.0; a = uBeacon * (0.75 + 0.6 * beat);
    } else if (uKind < 4.5){
      p = uBeaconPos + uBeaconRight * 0.0;
      size = max(3.5 + 4.0 * beat + 3.0 * uBeaconHint, dc * (0.010 + 0.004 * uBeaconHint));
      a = uBeacon * (0.35 + 0.65 * beat) * (0.7 + 0.25 * uBeaconHint);
    } else {
      p = uBeaconPos + vec3(0.0, (aTexCoord.y + 1.0) * 70.0, 0.0);
      size = 0.0; a = uBeacon * smoothstep(3.0, 4.0, uBeaconHint) * (0.25 + 0.2 * beat) * (1.0 - (aTexCoord.y + 1.0) * 0.5);
    }
    vec4 vpB = uView * vec4(p, 1.0);
    if (uKind > 3.5 && uKind < 4.5) vpB.xy += aTexCoord * size;
    if (uKind > 4.5) vpB.x += aTexCoord.x * max(1.6, dc * 0.004);
    vUv = aTexCoord; vCol = vec3(1.0, 0.78, 0.9); vA = a; vWorld = p;
    gl_Position = uProj * vpB;
    return;
  } else {
    vec3 l = s * 2.0 - 1.0;
    float rr = length(l);
    float ang = uTime * 0.035 / (0.35 + length(l.xz));
    float c = cos(ang), sn = sin(ang);
    l.xz = mat2(c, -sn, sn, c) * l.xz;
    l.y += sin(uTime * 0.2 + q.w * 6.28) * 0.04;
    p = uCloudC + l * uCloudR;
    size = 14.0 + q.y * 46.0;
    float dc = length(p - uCamPos);
    a = 0.075 * uAmount * step(rr, 1.0) * (1.0 - rr * rr) * smoothstep(size * 0.25, size * 1.4, dc);
    // colour by POSITION, not per sprite: neighbouring sprites share a hue, so the overlap
    // reads as drifting pink / violet / cyan regions instead of summing to white
    float f1 = 0.5 + 0.5 * sin(l.x * 2.3 + l.y * 1.7 + uTime * 0.08);
    float f2 = 0.5 + 0.5 * sin(l.z * 2.1 - l.y * 2.6 + 1.7 - uTime * 0.06);
    vec3 cc = mix(vec3(1.0, 0.22, 0.72), vec3(0.55, 0.3, 1.0), f1);
    cc = mix(cc, vec3(0.2, 0.85, 1.0), smoothstep(0.55, 0.9, f2));
    cc = mix(cc, vec3(1.0, 0.92, 0.98), smoothstep(0.45, 0.0, rr) * 0.6);
    vCol = cc;
    // thinner when the camera is inside, so colour survives tone mapping
    float inside = 1.0 - smoothstep(0.75, 1.05, length((uCamPos - uCloudC) / uCloudR));
    a *= mix(1.0, 0.42, inside);
  }
  vec4 vp = uView * vec4(p, 1.0);
  vp.xy += aTexCoord * size;
  vUv = aTexCoord; if (uKind < 1.5) vCol = pick(q.x); vA = a; vWorld = p;
  gl_Position = uProj * vp;
}
`,
  frag: AG.SHADERS.header + AG.SHADERS.common + AG.SHADERS.fog + `
in vec2 vUv; in vec3 vCol; in float vA; in vec3 vWorld;
out vec4 outColor;
uniform float uKind;
void main(){
  if (uKind > 2.5){
    vec3 bc;
    if (uKind < 3.5){ float m = max(abs(vUv.x), abs(vUv.y)); float g = smoothstep(1.0, 0.7, m); bc = vCol * g * vA * 3.2 + vec3(1.0) * smoothstep(0.6, 0.0, m) * vA * 1.5; }
    else if (uKind < 4.5){ float r = dot(vUv, vUv); if (r > 1.0) discard; bc = vCol * exp(-r * 3.0) * vA * 1.6 + vec3(1.0, 0.92, 0.96) * exp(-r * 40.0) * vA * 2.0; }
    else { bc = vCol * exp(-vUv.x * vUv.x * 4.0) * vA; }
    bc *= 1.0 - fogAmount(vWorld) * 0.45;
    outColor = vec4(bc, 1.0);
    return;
  }
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float g = uKind > 1.5 ? exp(-r2 * 2.6) : exp(-r2 * 4.0) + 0.6 * exp(-r2 * 30.0);
  vec3 col = vCol * g * vA * (uKind > 1.5 ? 1.0 : 2.2);
  col *= 1.0 - fogAmount(vWorld) * (uKind > 1.5 ? 0.35 : 0.8);
  outColor = vec4(col, 1.0);
}
`
};
