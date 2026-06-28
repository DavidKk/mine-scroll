import type { Vec3 } from '../shared.ts';
import type { FlatShardShape } from './shard-shapes.ts';

export interface SolidMesh {
  verts: Vec3[];
  faces: Array<[number, number, number]>;
}

function loopCentroid2(line: Vec3[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of line) {
    x += p.x;
    y += p.y;
  }
  const n = Math.max(1, line.length);
  return { x: x / n, y: y / n };
}

function appendSolidMesh(base: SolidMesh, extra: SolidMesh): void {
  const offset = base.verts.length;
  base.verts.push(...extra.verts);
  for (const face of extra.faces) {
    base.faces.push([face[0] + offset, face[1] + offset, face[2] + offset]);
  }
}

function closedFrameEdges(verts: Vec3[]): Array<[Vec3, Vec3]> {
  if (verts.length < 3) return [];
  const edges: Array<[Vec3, Vec3]> = [];
  for (let i = 0; i < verts.length; i += 1) {
    edges.push([verts[i]!, verts[(i + 1) % verts.length]!]);
  }
  return edges;
}

function frameBarHalfWidth(half: number, edgeCount: number): number {
  if (edgeCount <= 4) return half * 0.58;
  if (edgeCount <= 8) return half * 0.48;
  return half * 0.36;
}

function buildFrameSolidMesh(verts: Vec3[], half: number): SolidMesh {
  const barW = frameBarHalfWidth(half, verts.length);
  const mesh: SolidMesh = { verts: [], faces: [] };
  for (const [a, b] of closedFrameEdges(verts)) {
    appendSolidMesh(mesh, buildBarSolidMesh(a, b, half, barW));
  }
  return mesh;
}

/** Closed loop → solid prism with bulged side strips (rounded extrusion profile). */
function buildLoopSolidMesh(line: Vec3[], halfDepth: number): SolidMesh {
  const n = line.length;
  if (n < 3 || halfDepth <= 0) return { verts: [], faces: [] };

  const verts: Vec3[] = [];
  const faces: Array<[number, number, number]> = [];
  const front: number[] = [];
  const back: number[] = [];

  for (const p of line) {
    front.push(verts.length);
    verts.push({ x: p.x, y: p.y, z: p.z + halfDepth });
  }
  for (const p of line) {
    back.push(verts.length);
    verts.push({ x: p.x, y: p.y, z: p.z - halfDepth });
  }

  const c2 = loopCentroid2(line);
  const zMid = line[0]?.z ?? 0;
  const fi = verts.length;
  verts.push({ x: c2.x, y: c2.y, z: zMid + halfDepth });
  const bi = verts.length;
  verts.push({ x: c2.x, y: c2.y, z: zMid - halfDepth });

  for (let i = 0; i < n; i += 1) {
    faces.push([fi, front[i]!, front[(i + 1) % n]!]);
  }
  for (let i = 0; i < n; i += 1) {
    faces.push([bi, back[(i + 1) % n]!, back[i]!]);
  }

  const bulge = halfDepth * 0.46;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const a = front[i]!;
    const b = front[j]!;
    const c = back[j]!;
    const d = back[i]!;
    const va = verts[a]!;
    const vb = verts[b]!;
    const vc = verts[c]!;
    const vd = verts[d]!;
    const mx = (va.x + vb.x + vc.x + vd.x) * 0.25;
    const my = (va.y + vb.y + vc.y + vd.y) * 0.25;
    let ox = mx - c2.x;
    let oy = my - c2.y;
    const olen = Math.hypot(ox, oy) || 1;
    ox /= olen;
    oy /= olen;
    const bulgeZ = (va.z + vb.z + vc.z + vd.z) * 0.25;
    const mi = verts.length;
    verts.push({
      x: mx + ox * bulge,
      y: my + oy * bulge,
      z: bulgeZ,
    });
    faces.push([a, b, mi], [b, c, mi], [c, d, mi], [d, a, mi]);
  }

  return { verts, faces };
}

/** Thick bar along segment — used for × diagonals. */
function buildBarSolidMesh(a: Vec3, b: Vec3, halfZ: number, halfWidth: number): SolidMesh {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * halfWidth;
  const py = (dx / len) * halfWidth;
  const az = a.z;
  const bz = b.z;

  const verts: Vec3[] = [
    { x: a.x + px, y: a.y + py, z: az + halfZ },
    { x: b.x + px, y: b.y + py, z: bz + halfZ },
    { x: b.x - px, y: b.y - py, z: bz + halfZ },
    { x: a.x - px, y: a.y - py, z: az + halfZ },
    { x: a.x + px, y: a.y + py, z: az - halfZ },
    { x: b.x + px, y: b.y + py, z: bz - halfZ },
    { x: b.x - px, y: b.y - py, z: bz - halfZ },
    { x: a.x - px, y: a.y - py, z: az - halfZ },
  ];
  const faces: Array<[number, number, number]> = [
    [0, 1, 2],
    [0, 2, 3],
    [4, 6, 5],
    [4, 7, 6],
    [0, 4, 5],
    [0, 5, 1],
    [1, 5, 6],
    [1, 6, 2],
    [2, 6, 7],
    [2, 7, 3],
    [3, 7, 4],
    [3, 4, 0],
  ];
  return { verts, faces };
}

/** Open / closed strokes → side walls (+ caps when closed). */
function buildStrokeSolidMesh(
  polylines: Vec3[][],
  closed: boolean[],
  halfDepth: number,
): SolidMesh {
  const mesh: SolidMesh = { verts: [], faces: [] };
  if (halfDepth <= 0) return mesh;

  for (let li = 0; li < polylines.length; li += 1) {
    const line = polylines[li]!;
    const isClosed = closed[li] ?? false;
    const n = line.length;
    if (n < 2) continue;

    if (isClosed && n >= 3) {
      appendSolidMesh(mesh, buildLoopSolidMesh(line, halfDepth));
      continue;
    }

    const front: number[] = [];
    const back: number[] = [];
    for (const p of line) {
      front.push(mesh.verts.length);
      mesh.verts.push({ x: p.x, y: p.y, z: p.z + halfDepth });
    }
    for (const p of line) {
      back.push(mesh.verts.length);
      mesh.verts.push({ x: p.x, y: p.y, z: p.z - halfDepth });
    }

    for (let i = 0; i < n - 1; i += 1) {
      const a = front[i]!;
      const b = front[i + 1]!;
      const c = back[i + 1]!;
      const d = back[i]!;
      mesh.faces.push([a, b, c], [a, c, d]);
    }

    if (n >= 2) {
      mesh.faces.push([front[0]!, back[0]!, front[1]!], [back[0]!, back[1]!, front[1]!]);
      const ln = n - 1;
      mesh.faces.push(
        [front[ln]!, front[ln + 1]!, back[ln + 1]!],
        [front[ln]!, back[ln + 1]!, back[ln]!],
      );
    }
  }

  return mesh;
}

export function buildShapeSolidMesh(shape: FlatShardShape): SolidMesh | null {
  const half = shape.extrudeHalf ?? 0;
  if (half <= 0) return null;

  if (shape.template === 'ps-cross') {
    const corners = shape.polylines[0];
    if (!corners || corners.length < 4) return null;
    const barW = half * 0.62;
    const mesh: SolidMesh = { verts: [], faces: [] };
    appendSolidMesh(mesh, buildBarSolidMesh(corners[0]!, corners[2]!, half, barW));
    appendSolidMesh(mesh, buildBarSolidMesh(corners[1]!, corners[3]!, half, barW));
    return mesh;
  }

  if (shape.template === 'ps-frame') {
    const verts = shape.polylines[0];
    if (!verts || verts.length < 3) return null;
    return buildFrameSolidMesh(verts, half);
  }

  return buildStrokeSolidMesh(shape.polylines, shape.closed, half);
}

function buildExtrudedWire(
  polylines: Vec3[][],
  closed: boolean[],
  halfDepth: number,
): { verts: Vec3[]; segments: Array<[number, number]> } {
  const verts: Vec3[] = [];
  const segments: Array<[number, number]> = [];

  for (let li = 0; li < polylines.length; li += 1) {
    const line = polylines[li]!;
    const isClosed = closed[li] ?? false;
    const n = line.length;
    if (n < 2) continue;

    const f0 = verts.length;
    for (const p of line) verts.push({ x: p.x, y: p.y, z: p.z + halfDepth });
    const b0 = verts.length;
    for (const p of line) verts.push({ x: p.x, y: p.y, z: p.z - halfDepth });

    for (let i = 0; i < n - 1; i += 1) {
      segments.push([f0 + i, f0 + i + 1], [b0 + i, b0 + i + 1], [f0 + i, b0 + i]);
    }
    if (isClosed) {
      segments.push([f0 + n - 1, f0], [b0 + n - 1, b0], [f0 + n - 1, b0 + n - 1]);
    } else {
      segments.push([f0 + n - 1, b0 + n - 1]);
    }
  }

  return { verts, segments };
}

/** Build extruded wire for any glyph — × uses two diagonal bars, loops stay closed. */
export function buildShapeExtrudedWire(
  shape: FlatShardShape,
): { verts: Vec3[]; segments: Array<[number, number]> } | null {
  const half = shape.extrudeHalf ?? 0;
  if (half <= 0) return null;

  if (shape.template === 'ps-cross') {
    const corners = shape.polylines[0];
    if (!corners || corners.length < 4) return null;
    return buildExtrudedWire(
      [
        [corners[0]!, corners[2]!],
        [corners[1]!, corners[3]!],
      ],
      [false, false],
      half,
    );
  }

  if (shape.template === 'ps-frame') {
    const verts = shape.polylines[0];
    if (!verts || verts.length < 3) return null;
    const edges = closedFrameEdges(verts);
    return buildExtrudedWire(
      edges.map(([a, b]) => [a, b]),
      edges.map(() => false),
      half,
    );
  }

  return buildExtrudedWire(shape.polylines, shape.closed, half);
}
