/* =====================================================================
   GeometryBuilder
   Accumulates thousands of primitives into a few large p5.Geometry
   meshes so the whole city renders in a handful of draw calls.

   Every vertex carries:
     position (metres, world space)   normal
     uv       (per-face 0..1 or data) colour (4 floats of *data*)
   The "colour" channel is not a colour: shaders read it as packed
   per-vertex data (material id, building hash, fragment id, distance
   from the protagonist ...). See docs/ARCHITECTURE.md for the layout.
   ===================================================================== */
window.AG = window.AG || {};

AG.GeometryBuilder = class GeometryBuilder {
  constructor(name, maxVerts = 60000) {
    this.name = name;
    this.maxVerts = maxVerts;     // < 65535 so 16-bit indices always work
    this.chunks = [];
    this.data = [0, 0, 0, 0];     // current packed vertex data
    this._newChunk();
  }

  _newChunk() {
    this.cur = { pos: [], nrm: [], uv: [], col: [], idx: [], n: 0 };
    this.chunks.push(this.cur);
  }
  _ensure(n) { if (this.cur.n + n > this.maxVerts) this._newChunk(); }

  _v(p, n, u, v) {
    const c = this.cur;
    c.pos.push(p[0], p[1], p[2]);
    c.nrm.push(n[0], n[1], n[2]);
    c.uv.push(u, v);
    const d = this.data;
    c.col.push(d[0], d[1], d[2], d[3]);
    return c.n++;
  }

  get vertexCount() { return this.chunks.reduce((s, c) => s + c.n, 0); }

  /* Quad p0..p3 counter-clockwise, flat normal n, uv rect. */
  quad(p0, p1, p2, p3, n, uv) {
    this._ensure(4);
    uv = uv || [0, 0, 1, 1];
    const a = this._v(p0, n, uv[0], uv[1]);
    const b = this._v(p1, n, uv[2], uv[1]);
    const c = this._v(p2, n, uv[2], uv[3]);
    const d = this._v(p3, n, uv[0], uv[3]);
    this.cur.idx.push(a, b, c, a, c, d);
  }

  tri(p0, p1, p2, n, uvs) {
    this._ensure(3);
    uvs = uvs || [0, 0, 1, 0, 0.5, 1];
    const a = this._v(p0, n, uvs[0], uvs[1]);
    const b = this._v(p1, n, uvs[2], uvs[3]);
    const c = this._v(p2, n, uvs[4], uvs[5]);
    this.cur.idx.push(a, b, c);
  }

  /* Oriented box: centre c, half extents h, basis vectors ax/ay/az. */
  obox(c, h, ax, ay, az, opts) {
    const skipBottom = opts && opts.skipBottom;
    const V = AG.U.v3;
    const X = V.scale(ax, h[0]), Y = V.scale(ay, h[1]), Z = V.scale(az, h[2]);
    const P = (sx, sy, sz) => [
      c[0] + X[0] * sx + Y[0] * sy + Z[0] * sz,
      c[1] + X[1] * sx + Y[1] * sy + Z[1] * sz,
      c[2] + X[2] * sx + Y[2] * sy + Z[2] * sz
    ];
    const nx = ax, ny = ay, nz = az, mx = V.scale(ax, -1), my = V.scale(ay, -1), mz = V.scale(az, -1);
    // +X
    this.quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), nx);
    // -X
    this.quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), mx);
    // +Z
    this.quad(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), nz);
    // -Z
    this.quad(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), mz);
    // +Y
    this.quad(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1), ny);
    // -Y
    if (!skipBottom) this.quad(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), my);
  }

  /* Axis-aligned box from base: (x, y0, z) is the centre of the bottom face. */
  box(x, y0, z, w, h, d, opts) {
    this.obox([x, y0 + h / 2, z], [w / 2, h / 2, d / 2], [1, 0, 0], [0, 1, 0], [0, 0, 1], opts || { skipBottom: true });
  }

  /* Box rotated around Y by angle a. */
  boxY(x, y0, z, w, h, d, a, opts) {
    const c = Math.cos(a), s = Math.sin(a);
    this.obox([x, y0 + h / 2, z], [w / 2, h / 2, d / 2], [c, 0, -s], [0, 1, 0], [s, 0, c], opts);
  }

  /* Vertical n-gon prism (octagonal towers, tanks, pillars). */
  prism(x, y0, z, r, h, sides, rot, opts) {
    rot = rot || 0;
    const top = !(opts && opts.noTop);
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]);
    }
    for (let i = 0; i < sides; i++) {
      const p = pts[i], q = pts[(i + 1) % sides];
      const mx = (p[0] + q[0]) / 2 - x, mz = (p[1] + q[1]) / 2 - z;
      const l = Math.hypot(mx, mz) || 1;
      const n = [mx / l, 0, mz / l];
      this.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y0 + h, p[1]], [q[0], y0 + h, q[1]], n);
    }
    if (top) {
      for (let i = 0; i < sides; i++) {
        const p = pts[i], q = pts[(i + 1) % sides];
        this.tri([x, y0 + h, z], [q[0], y0 + h, q[1]], [p[0], y0 + h, p[1]], [0, 1, 0],
          [0.5, 0.5, 0.5 + 0.5 * Math.cos((i + 1) / sides * 6.283), 0.5 + 0.5 * Math.sin((i + 1) / sides * 6.283),
           0.5 + 0.5 * Math.cos(i / sides * 6.283), 0.5 + 0.5 * Math.sin(i / sides * 6.283)]);
      }
    }
  }

  /* Open cone/cylinder along an arbitrary axis (used for light beams).
     uv.x = angle 0..1, uv.y = 0 at base -> 1 at tip. */
  cone(base, dir, len, r0, r1, sides) {
    const V = AG.U.v3;
    const d = V.norm(dir);
    let t = Math.abs(d[1]) < 0.9 ? V.norm(V.cross(d, [0, 1, 0])) : V.norm(V.cross(d, [1, 0, 0]));
    const b = V.cross(d, t);
    const tip = V.add(base, V.scale(d, len));
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const o0 = V.add(V.scale(t, Math.cos(a0)), V.scale(b, Math.sin(a0)));
      const o1 = V.add(V.scale(t, Math.cos(a1)), V.scale(b, Math.sin(a1)));
      this._ensure(4);
      const i0 = this._v(V.add(base, V.scale(o0, r0)), o0, i / sides, 0);
      const i1 = this._v(V.add(base, V.scale(o1, r0)), o1, (i + 1) / sides, 0);
      const i2 = this._v(V.add(tip, V.scale(o1, r1)), o1, (i + 1) / sides, 1);
      const i3 = this._v(V.add(tip, V.scale(o0, r1)), o0, i / sides, 1);
      this.cur.idx.push(i0, i1, i2, i0, i2, i3);
    }
  }

  /* Raw vertex access for special meshes (rain, traffic, figure). */
  rawVertex(p, n, u, v, d) {
    const c = this.cur;
    c.pos.push(p[0], p[1], p[2]); c.nrm.push(n[0], n[1], n[2]); c.uv.push(u, v);
    c.col.push(d[0], d[1], d[2], d[3]);
    return c.n++;
  }
  rawTri(a, b, c) { this.cur.idx.push(a, b, c); }

  /* Convert to p5.Geometry objects (one per chunk). */
  build(p) {
    const out = [];
    this.chunks.forEach((c, ci) => {
      if (!c.n) return;
      const g = new p5.Geometry(1, 1);
      const verts = new Array(c.n), norms = new Array(c.n);
      for (let i = 0; i < c.n; i++) {
        verts[i] = { x: c.pos[i * 3], y: c.pos[i * 3 + 1], z: c.pos[i * 3 + 2] };
        norms[i] = { x: c.nrm[i * 3], y: c.nrm[i * 3 + 1], z: c.nrm[i * 3 + 2] };
      }
      g.vertices = verts;
      g.vertexNormals = norms;
      g.uvs = c.uv;
      g.vertexColors = c.col;
      const faces = new Array(c.idx.length / 3);
      for (let i = 0; i < faces.length; i++) faces[i] = [c.idx[i * 3], c.idx[i * 3 + 1], c.idx[i * 3 + 2]];
      g.faces = faces;
      g.gid = this.name + '-' + ci + '-' + Math.random().toString(36).slice(2, 8);
      out.push(g);
    });
    return out;
  }
};
