import type { Plan } from "../planner/types";

/**
 * Minimal FIT workout encoder (file_id, workout and workout_step messages).
 * Each kilometre becomes a distance step with a pace range, which Garmin
 * watches read from GARMIN/NewFiles.
 */

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc(bytes: Uint8Array, crc = 0): number {
  for (const byte of bytes) {
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[byte & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc;
}

type BaseType = "enum" | "uint16" | "uint32" | "uint32z" | "string";
const BASE: Record<BaseType, { id: number; size: number }> = {
  enum: { id: 0x00, size: 1 },
  uint16: { id: 0x84, size: 2 },
  uint32: { id: 0x86, size: 4 },
  uint32z: { id: 0x8c, size: 4 },
  string: { id: 0x07, size: 0 },
};

interface FieldDef {
  num: number;
  type: BaseType;
  /** Byte size for strings. */
  size?: number;
}

class Writer {
  private bytes: number[] = [];
  u8(v: number) { this.bytes.push(v & 0xff); }
  u16(v: number) { this.u8(v); this.u8(v >> 8); }
  u32(v: number) { this.u16(v & 0xffff); this.u16(Math.floor(v / 0x10000)); }
  str(v: string, size: number) {
    const encoded = new TextEncoder().encode(v).slice(0, size - 1);
    encoded.forEach((b) => this.u8(b));
    for (let i = encoded.length; i < size; i++) this.u8(0);
  }
  get length() { return this.bytes.length; }
  toArray() { return Uint8Array.from(this.bytes); }
}

function fieldSize(f: FieldDef) {
  return f.type === "string" ? (f.size ?? 16) : BASE[f.type].size;
}

function define(w: Writer, local: number, global: number, fields: FieldDef[]) {
  w.u8(0x40 | local);
  w.u8(0); // reserved
  w.u8(0); // little endian
  w.u16(global);
  w.u8(fields.length);
  for (const f of fields) {
    w.u8(f.num);
    w.u8(fieldSize(f));
    w.u8(BASE[f.type].id);
  }
}

function data(w: Writer, local: number, fields: FieldDef[], values: (number | string)[]) {
  w.u8(local);
  fields.forEach((f, i) => {
    const v = values[i];
    if (f.type === "string") w.str(String(v), fieldSize(f));
    else if (f.type === "enum") w.u8(Number(v));
    else if (f.type === "uint16") w.u16(Number(v));
    else w.u32(Number(v));
  });
}

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const SPORT_RUNNING = 1;
const FILE_WORKOUT = 5;
const DURATION_DISTANCE = 1;
const TARGET_SPEED = 0;
const INTENSITY_ACTIVE = 0;

export interface FitOptions {
  /** Plus or minus seconds per km around the target pace. */
  toleranceSec?: number;
  /** Creation time; pass a fixed date for reproducible output. */
  createdAt?: Date;
  name?: string;
}

const speedMms = (secPerKm: number) => Math.round((1000 / secPerKm) * 1000);

export function buildFitWorkout(plan: Plan, options: FitOptions = {}): Uint8Array {
  const tolerance = options.toleranceSec ?? 8;
  const created = options.createdAt ?? new Date();
  const name = options.name ?? plan.name;

  const body = new Writer();

  const fileId: FieldDef[] = [
    { num: 0, type: "enum" },
    { num: 1, type: "uint16" },
    { num: 2, type: "uint16" },
    { num: 3, type: "uint32z" },
    { num: 4, type: "uint32" },
  ];
  define(body, 0, 0, fileId);
  data(body, 0, fileId, [
    FILE_WORKOUT,
    255, // development manufacturer
    0,
    1,
    Math.floor((created.getTime() - FIT_EPOCH_MS) / 1000),
  ]);

  const workout: FieldDef[] = [
    { num: 4, type: "enum" },
    { num: 6, type: "uint16" },
    { num: 8, type: "string", size: 24 },
  ];
  define(body, 1, 26, workout);
  data(body, 1, workout, [SPORT_RUNNING, plan.splits.length, name]);

  const step: FieldDef[] = [
    { num: 254, type: "uint16" },
    { num: 0, type: "string", size: 16 },
    { num: 1, type: "enum" },
    { num: 2, type: "uint32" },
    { num: 3, type: "enum" },
    { num: 4, type: "uint32" },
    { num: 5, type: "uint32" },
    { num: 6, type: "uint32" },
    { num: 7, type: "enum" },
  ];
  define(body, 2, 27, step);
  plan.splits.forEach((s, i) => {
    const label = s.tag === "hold" && s.avgGrade >= 1.2 ? `Km ${s.km} uphill` : `Km ${s.km}`;
    data(body, 2, step, [
      i,
      label,
      DURATION_DISTANCE,
      Math.round(s.lengthKm * 1000 * 100), // centimetres
      TARGET_SPEED,
      0, // 0 means use the custom range below
      speedMms(s.paceSecPerKm + tolerance), // slow edge
      speedMms(s.paceSecPerKm - tolerance), // fast edge
      INTENSITY_ACTIVE,
    ]);
  });

  const records = body.toArray();
  const header = new Writer();
  header.u8(14);
  header.u8(0x20); // protocol 2.0
  header.u16(2132); // profile 21.32
  header.u32(records.length);
  ".FIT".split("").forEach((c) => header.u8(c.charCodeAt(0)));
  const headerBytes = header.toArray(); // 12 bytes, the header CRC follows
  const headerCrc = fitCrc(headerBytes);

  const out = new Uint8Array(14 + records.length + 2);
  out.set(headerBytes, 0);
  out[12] = headerCrc & 0xff;
  out[13] = headerCrc >> 8;
  out.set(records, 14);
  const fileCrc = fitCrc(out.subarray(0, 14 + records.length));
  out[out.length - 2] = fileCrc & 0xff;
  out[out.length - 1] = fileCrc >> 8;
  return out;
}
