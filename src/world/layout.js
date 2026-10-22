// Floor plan of the (abstracted) MAMŰ basement, in metres.
// x = east, z = south, y = up. Every room is an axis-aligned rectangle; walls are
// generated from these rectangles, doorways are gaps in them.

export const CEILING = 2.8;
export const EYE = 1.62;

export const ROOMS = [
  {
    id: 'r1',
    name: 'Room 1',
    subtitle: 'Hydroponics & prints',
    x0: 0, x1: 10, z0: 0, z1: 7,
    // Default spawn: foot of the stairs, looking into the room.
    spawn: { x: 5.0, z: 6.35, look: { x: 0, z: 3.2 } },
  },
  {
    id: 'r2',
    name: 'Room 2',
    subtitle: 'Screens & bar',
    x0: 0, x1: 6.5, z0: -5, z1: -0.3,
    spawn: { x: 3.0, z: -1.2, look: { x: 1.2, z: -5 } },
  },
  {
    id: 'r3',
    name: 'Room 3',
    subtitle: 'Gallery & projection',
    x0: 6.8, x1: 26, z0: -5, z1: -0.6,
    spawn: { x: 7.8, z: -2.9, look: { x: 26, z: -2.8 } },
  },
];

// Wall materials (keys resolved in materials.js).
// Each wall: a straight segment a -> b, the room it faces into decides the normal.
// `face`: 'N' wall sits at z0 and faces +z, 'S' at z1 faces -z, 'W' at x0 faces +x, 'E' at x1 faces -x.
// `gaps`: openings measured in world coordinates along the wall axis, with a top height.
// `spans`: optional material overrides along the wall axis.
export const WALLS = [
  // ---------- Room 1 (white painted brick) ----------
  { room: 'r1', face: 'N', mat: 'whiteBrick', gaps: [{ from: 2.3, to: 3.7, top: 2.15 }] },
  { room: 'r1', face: 'S', mat: 'whiteBrick' },
  { room: 'r1', face: 'W', mat: 'whiteBrick' },
  { room: 'r1', face: 'E', mat: 'whiteBrick' },
  // ---------- Room 2 (warm yellow brick) ----------
  { room: 'r2', face: 'N', mat: 'warmBrick' },
  { room: 'r2', face: 'S', mat: 'warmBrick', gaps: [{ from: 2.3, to: 3.7, top: 2.15 }] },
  { room: 'r2', face: 'W', mat: 'warmBrick' },
  { room: 'r2', face: 'E', mat: 'warmBrick', gaps: [{ from: -4.4, to: -1.9, top: 2.3 }] },
  // ---------- Room 3 (long & narrow: white gallery, then dark projection room) ----------
  {
    room: 'r3', face: 'N', mat: 'greyBrick',
    spans: [{ from: 15.6, to: 26, mat: 'darkBrick' }],
  },
  {
    room: 'r3', face: 'S', mat: 'whiteBrick',
    spans: [{ from: 15.6, to: 26, mat: 'darkBrick' }],
  },
  { room: 'r3', face: 'W', mat: 'whiteBrick', gaps: [{ from: -4.4, to: -1.9, top: 2.3 }] },
  { room: 'r3', face: 'E', mat: 'darkBrick' },
];

// Internal partition in Room 3 (white "pillar" wall with a curtained doorway).
export const PARTITION = {
  x0: 15.6, x1: 15.85, z0: -5, z1: -0.6,
  gap: { from: -3.4, to: -2.2, top: 2.2 },
  matWest: 'whitePlaster', matEast: 'darkBrick',
};

// Doorway reveals (wall thickness between rooms) — also used for collision.
export const REVEALS = [
  // Room 1 <-> Room 2, wall between z=-0.3 and z=0
  { axis: 'z', at0: -0.3, at1: 0, from: 2.3, to: 3.7, top: 2.15, mat: 'whiteBrick' },
  // Room 2 <-> Room 3, wall between x=6.5 and x=6.8
  { axis: 'x', at0: 6.5, at1: 6.8, from: -4.4, to: -1.9, top: 2.3, mat: 'whiteBrick' },
  // Partition doorway in Room 3
  { axis: 'x', at0: PARTITION.x0, at1: PARTITION.x1, from: PARTITION.gap.from, to: PARTITION.gap.to, top: PARTITION.gap.top, mat: 'whitePlaster' },
];

// Solid obstacles (axis-aligned boxes on the floor) the visitor collides with.
// Filled in by props.js as furniture is placed.
export const OBSTACLES = [];

export function roomAt(x, z) {
  for (const r of ROOMS) {
    if (x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05) {
      if (r.id === 'r3') return x < PARTITION.x0 ? { ...r, zone: 'white' } : { ...r, zone: 'dark' };
      return r;
    }
  }
  return null;
}

export function roomById(id) {
  return ROOMS.find((r) => r.id === id);
}

// Returns the wall placement frame for hanging something on a room wall.
// `along` is the world coordinate along the wall (x for N/S walls, z for E/W walls).
export function wallFrame(roomId, face, along, inset = 0.02) {
  const r = roomById(roomId);
  switch (face) {
    case 'N': return { x: along, z: r.z0 + inset, rotY: 0, nx: 0, nz: 1 };
    case 'S': return { x: along, z: r.z1 - inset, rotY: Math.PI, nx: 0, nz: -1 };
    case 'W': return { x: r.x0 + inset, z: along, rotY: Math.PI / 2, nx: 1, nz: 0 };
    case 'E': return { x: r.x1 - inset, z: along, rotY: -Math.PI / 2, nx: -1, nz: 0 };
    case 'PW': return { x: PARTITION.x0 - inset, z: along, rotY: -Math.PI / 2, nx: -1, nz: 0 };
    case 'PE': return { x: PARTITION.x1 + inset, z: along, rotY: Math.PI / 2, nx: 1, nz: 0 };
    default: throw new Error(`Unknown wall face ${face}`);
  }
}
