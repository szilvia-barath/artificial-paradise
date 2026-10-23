// Floor plan of the MAMŰ basement, in metres, traced from the exhibition's own room
// sheet (the plan printed next to the works list, photographed in DSC_0049) at
// 0.026 m per plan pixel, then checked against the photos: the Room 1 panorama
// (camera solved from the corner bearings), brick courses, floor tiles and the
// canvas sizes on the works list. Cross-check with OpenStreetMap: the gallery is in
// the basement of Damjanich utca 39, a corner building whose wing along Murányi utca
// is 26.5 m from the street front to the back; this basement measures about 26.5 m from
// the outer face of Room 1's west wall to the outer face of Room 4's end wall.
// +x (Room 1 -> Room 4) points to bearing 146° (south-east); Room 1's window wall
// faces Damjanich utca.
//
// Room 1 is the exception: its walls come from the panorama measurement (see BLOCKS).
//
// x = right on the plan, z = down on the plan, y = up ("north/south/east/west" in this
// code mean plan directions, not compass ones). The origin is Room 1's north wall, 0.35 m
// west of its west wall face.
//
//   Room 1 (stairs, paintings, Paradise Factory) → Room 2 (videos, bar) →
//   Room 3 (prints) | Room 4 (Let it Flow), 3 and 4 being one long room split only
//   by two short wall stubs.

export const EYE = 1.62;

// Room 1's size is PROVISIONAL until the owner's tape measurements arrive: change W and D
// here and the walls, stairs, bench, windows and Paradise Factory follow. The panorama
// measurement gave 4.5 x 6.55 m; the owner remembers the room larger.
export const R1 = { W: 5.0, D: 7.0, east: 4.85, recess: 5.4 };
R1.west = R1.east - R1.W;

export const ROOMS = [
  {
    id: 'r1',
    x0: R1.west, x1: R1.east, z0: 0, z1: R1.D,
    ceiling: 3.0,
    // Foot of the stairs, facing the way you walk off them: Human as Error VI ahead,
    // Wrong Data Landscape Dresden on the left.
    spawn: { x: R1.east - 2.2, z: 1.0, look: { x: R1.east, z: 2.3 } },
  },
  {
    id: 'r2',
    x0: 5.85, x1: 9.7, z0: 1.73, z1: 5.94,
    ceiling: 2.75,
    spawn: { x: 6.6, z: 4.25, look: { x: 8.2, z: 1.73 } },
  },
  {
    id: 'r3',
    x0: 10.05, x1: 15.45, z0: 1.73, z1: 5.94,
    ceiling: 2.75,
    spawn: { x: 10.7, z: 3.4, look: { x: 15.4, z: 3.9 } },
  },
  {
    id: 'r4',
    x0: 15.75, x1: 25.67, z0: 1.73, z1: 5.94,
    ceiling: 2.9,
    spawn: { x: 16.6, z: 3.9, look: { x: 25.67, z: 3.8 } },
  },
];

export const CEILING = 3.0; // tallest room (used for shafts / light rigs)

// Opening heights
const DOOR = 2.1;
const ARCH = 2.15;

// ---------------------------------------------------------------- solid blocks
// Every wall is a solid axis-aligned block. `mat` is the default material; `faces`
// overrides one side: px = face looking east (+x), nx = west, pz = south, nz = north.
// Blocks lower than 1.2 m still collide (counters, half walls); y0 > 1.2 (lintels) don't.
const T = 0.4; // outer wall thickness

export const BLOCKS = [
  // ---------- Room 1 ----------
  // Layout from the 360° panorama (camera solved from the corners, the four canvases of
  // known size and the floor line); overall size from R1 above.
  // west wall (street side), with the opening the stairs climb through
  { x0: R1.west - T, x1: R1.west, z0: 1.95, z1: R1.D + T, y1: 3.0, mat: 'whiteBrick' },
  { x0: R1.west - T, x1: R1.west, z0: -T, z1: 0, y1: 3.0, mat: 'whiteBrick' },
  // north wall
  { x0: R1.west - T, x1: R1.east, z0: -T, z1: 0, y1: 3.0, mat: 'whiteBrick' },
  // south wall
  { x0: R1.west - T, x1: R1.east, z0: R1.D, z1: R1.D + T, y1: 3.0, mat: 'whiteBrick' },
  // Room 1 | Room 2 wall: 1 m thick piers north (Human as Error VI) and south (text,
  // radiator); between them a 55 cm recess holding the doorway and two plinths
  // (DSC_0019–0023 and the panorama), doorway z 3.70–4.55
  { x0: R1.east, x1: 5.85, z0: -T, z1: 3.2, y1: 3.0, mat: 'whiteBrick', faces: { px: 'warmBrick' } },
  { x0: R1.recess, x1: 5.85, z0: 3.2, z1: 3.7, y1: 3.0, mat: 'whiteBrick', faces: { px: 'warmBrick' } },
  { x0: R1.recess, x1: 5.85, z0: 3.7, z1: 4.55, y0: DOOR, y1: 3.0, mat: 'whiteBrick', reveal: 'warmBrick' },
  { x0: R1.recess, x1: 5.85, z0: 4.55, z1: 5.0, y1: 3.0, mat: 'whiteBrick', faces: { px: 'warmBrick' } },
  { x0: R1.east, x1: 5.85, z0: 5.0, z1: R1.D + T, y1: 3.0, mat: 'whiteBrick', faces: { px: 'warmBrick' } },

  // ---------- Room 2 ----------
  // north: wall in front of the storage alcove (not accessible), gated opening x 8.65–9.70
  { x0: 5.85, x1: 8.65, z0: 1.5, z1: 1.73, y1: 2.75, mat: 'warmBrick' },
  { x0: 8.65, x1: 9.7, z0: 1.5, z1: 1.73, y0: DOOR, y1: 2.75, mat: 'warmBrick' },
  // storage alcove shell (only glimpsed through the gate)
  { x0: 5.85, x1: 10.05, z0: -T, z1: 0, y1: 2.75, mat: 'darkBrick' },
  // south: wall with the (closed) door to the toilets
  { x0: 5.85, x1: 7.4, z0: 5.94, z1: 6.34, y1: 2.75, mat: 'warmBrick' },
  // bar: low brick counter (you see over it from the Room 1 doorway, DSC_0021),
  // a brick pillar at its back corner and the back wall
  { x0: 7.7, x1: 9.7, z0: 4.85, z1: 5.3, y1: 1.0, mat: 'warmBrick' },
  { x0: 7.42, x1: 7.7, z0: 5.45, z1: 5.94, y1: 2.75, mat: 'warmBrick' },
  { x0: 7.35, x1: 9.7, z0: 5.94, z1: 6.34, y1: 2.75, mat: 'warmBrick' },
  // Room 2 | Room 3 wall: pillar, doorway z 2.60–4.20, bar pass-through z 4.20–4.90, wall
  { x0: 9.7, x1: 10.05, z0: -T, z1: 2.6, y1: 2.75, mat: 'warmBrick', faces: { px: 'whiteBrick' } },
  { x0: 9.7, x1: 10.05, z0: 2.6, z1: 4.2, y0: ARCH, y1: 2.75, mat: 'whiteBrick', reveal: 'whiteBrick' },
  { x0: 9.7, x1: 10.05, z0: 4.2, z1: 4.9, y1: 1.0, mat: 'whiteBrick', faces: { nx: 'warmBrick' } },
  { x0: 9.7, x1: 10.05, z0: 4.2, z1: 4.9, y0: ARCH, y1: 2.75, mat: 'whiteBrick', faces: { nx: 'warmBrick' } },
  { x0: 9.7, x1: 10.05, z0: 4.9, z1: 6.34, y1: 2.75, mat: 'whiteBrick', faces: { nx: 'warmBrick' } },

  // ---------- Room 3 + Room 4 (one long room) ----------
  // north wall: painted grey brick in Room 3, black brick in Room 4
  { x0: 10.05, x1: 13.3, z0: 1.33, z1: 1.73, y1: 2.9, mat: 'greyBrick' },
  // bricked-up opening right of Wiena Wrong Landscape II, recessed 14 cm (DSC_0088–0093)
  { x0: 13.3, x1: 14.9, z0: 1.33, z1: 1.73, y1: 1.25, mat: 'greyBrick' },
  { x0: 13.3, x1: 14.9, z0: 1.33, z1: 1.59, y0: 1.25, y1: 2.9, mat: 'greyBrick', faces: { pz: 'greyBrickShade' } },
  { x0: 14.9, x1: 15.45, z0: 1.33, z1: 1.73, y1: 2.9, mat: 'greyBrick' },
  { x0: 15.45, x1: 25.67 + T, z0: 1.33, z1: 1.73, y1: 2.9, mat: 'darkBrick' },
  // south wall: white brick
  { x0: 10.05, x1: 14.35, z0: 5.94, z1: 6.34, y1: 2.9, mat: 'whiteBrick' },
  { x0: 15.75, x1: 25.67 + T, z0: 5.94, z1: 6.34, y1: 2.9, mat: 'dimBrick' },
  // closet block beside the south stub (#14 hangs on its west face)
  { x0: 14.35, x1: 15.45, z0: 4.82, z1: 6.34, y1: 2.9, mat: 'plaster' },
  // the two side stubs between Room 3 and Room 4, plus the header above the opening
  { x0: 15.45, x1: 15.75, z0: 1.73, z1: 2.98, y1: 2.9, mat: 'plaster' },
  { x0: 15.45, x1: 15.75, z0: 4.82, z1: 6.34, y1: 2.9, mat: 'plaster' },
  { x0: 15.45, x1: 15.75, z0: 2.98, z1: 4.82, y0: 2.45, y1: 2.9, mat: 'plaster' },
  // projection wall (east end)
  { x0: 25.67, x1: 25.67 + T, z0: 1.33, z1: 6.34, y1: 2.9, mat: 'dimBrick', faces: { nx: 'projWall' } },
];

// Floors and ceilings (rectangles); doorway soffits come from the lintel blocks.
// Room 1's ceiling has the stairwell opening.
export const STAIRWELL = { x0: R1.west, x1: R1.west + 1.4, z0: 0, z1: 1.95 };
export const R1_WEST_OUTER = R1.west - T; // outer face of Room 1's west wall (the stair shaft starts here)
export const FLOORS = [
  { x0: R1.west - 0.1, x1: 5.6, z0: -0.1, z1: R1.D + 0.1, mat: 'floor' },
  { x0: 5.4, x1: 9.85, z0: 1.6, z1: 6.0, mat: 'floor' },
  { x0: 9.7, x1: 15.6, z0: 1.6, z1: 6.0, mat: 'floor' },
  { x0: 15.6, x1: 25.7, z0: 1.6, z1: 6.0, mat: 'floorDark' },
  { x0: 5.85, x1: 9.7, z0: 0, z1: 1.5, mat: 'darkFloor', y: 0.002 },
];
export const CEILINGS = [
  { x0: R1.west, x1: R1.east, z0: 0, z1: R1.D, y: 3.0, mat: 'ceiling', hole: STAIRWELL },
  { x0: R1.east, x1: R1.recess, z0: 3.2, z1: 5.0, y: 3.0, mat: 'ceiling' },
  { x0: 5.85, x1: 9.7, z0: 1.73, z1: 5.94, y: 2.75, mat: 'planks' },
  { x0: 5.85, x1: 9.7, z0: 0, z1: 1.5, y: 2.4, mat: 'darkCeiling' },
  { x0: 10.05, x1: 15.45, z0: 1.73, z1: 5.94, y: 2.75, mat: 'ceiling' },
  // Room 4's ceiling is a run of shallow brick vaults (built in architecture.js)
];

// Solid obstacles (axis-aligned boxes on the floor) the visitor collides with.
// Filled in by props.js as furniture is placed.
export const OBSTACLES = [];

export function roomAt(x, z) {
  for (const r of ROOMS) {
    if (x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05) return r;
  }
  return null;
}

export function roomById(id) {
  return ROOMS.find((r) => r.id === id);
}

// Placement frame for something hung on a wall plane.
// face: the direction the wall surface looks ('+x', '-x', '+z', '-z'); at: the wall
// plane coordinate; along: the coordinate along the wall.
export function wallFrame(face, at, along, inset = 0.02) {
  switch (face) {
    case '+z': return { x: along, z: at + inset, rotY: 0, nx: 0, nz: 1 };
    case '-z': return { x: along, z: at - inset, rotY: Math.PI, nx: 0, nz: -1 };
    case '+x': return { x: at + inset, z: along, rotY: Math.PI / 2, nx: 1, nz: 0 };
    case '-x': return { x: at - inset, z: along, rotY: -Math.PI / 2, nx: -1, nz: 0 };
    default: throw new Error(`Unknown wall face ${face}`);
  }
}
