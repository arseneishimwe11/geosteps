/**
 * Core data model for the floor blueprint, position state, and zone events.
 *
 * Everything positional lives in a venue-local 2D metric frame ("map frame"):
 *   - units are meters
 *   - +Y is "map north" (an arbitrary axis the admin picks, usually aligned
 *     with the building), +X is 90° clockwise from it
 *   - `calibration.headingOffsetDeg` records which compass bearing corresponds
 *     to walking in the +Y direction, so runtime compass headings can be
 *     rotated into the map frame.
 *
 * The blueprint is deliberately a single JSON document per venue. It is
 * produced once by the admin calibration walk and downloaded whole by the
 * tourist runtime.
 */

export type LanguageCode = string; // 'en' | 'fr' | 'rw' | 'sw' | 'de' | ... (BCP-47 primary subtag)

export interface Point {
  x: number;
  y: number;
}

export interface AudioAssetRef {
  /** URL, absolute or relative to the venue's asset base. */
  url: string;
  durationSec?: number;
  title?: string;
}

/**
 * Acoustic signature of a zone: the time-averaged distribution of ambient
 * audio energy across log-spaced frequency bands. Room-level only — see
 * ARCHITECTURE.md for the honest limitations.
 */
export interface AcousticFingerprint {
  version: 1;
  method: 'band-energy-v1';
  sampleRateHz: number;
  fftSize: number;
  bandCount: number;
  /** [minHz, maxHz] — bands are log-spaced between these edges. */
  bandsHz: [number, number];
  /** Normalized band-energy distribution (sums to 1), length === bandCount. */
  energies: number[];
  capturedAt?: string; // ISO 8601
  captureSeconds?: number;
}

export interface Zone {
  id: string;
  name: string;
  /** Simple polygon in map frame, >= 3 vertices, either winding. Zones should not overlap. */
  polygon: Point[];
  /** Per-language narration for this zone. At minimum the venue defaultLanguage should be present. */
  audio: Partial<Record<LanguageCode, AudioAssetRef>>;
  /** Optional ambient-audio signature recorded during admin calibration. */
  fingerprint?: AcousticFingerprint;
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
}

/**
 * A walkable corridor segment. The walkable area it contributes is the
 * "capsule" of all points within widthM/2 of the segment between its two
 * nodes. The union of all edge capsules is the venue's walkable space;
 * everything else is treated as wall.
 */
export interface GraphEdge {
  from: string;
  to: string;
  widthM: number;
}

export interface WalkableGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface StepDetectorConfig {
  /** Refractory period between detected steps. Caps cadence at ~1000/min ms. */
  minStepIntervalMs: number;
  /** EMA time constant for tracking gravity magnitude (high-pass filter). */
  gravityTimeConstantSec: number;
  /** EMA time constant for the adaptive amplitude estimate. */
  rmsTimeConstantSec: number;
  /** Absolute threshold floor (m/s²) so sensor noise at rest never counts as steps. */
  thresholdFloorMs2: number;
  /** Peak threshold = max(floor, gain * runningRms). */
  thresholdGain: number;
}

export interface GeofenceConfig {
  /** A zone candidate must stay the deepest zone this long before 'enter' fires. */
  enterDebounceMs: number;
  /** Position must be definitively outside the current zone this long before 'exit' fires. */
  exitDebounceMs: number;
  /**
   * Spatial hysteresis (m): entering requires being at least this deep inside
   * the polygon; exiting requires being at least this far outside it.
   * Positions within ±hysteresisM of the boundary change nothing.
   */
  hysteresisM: number;
}

/**
 * Configuration of the acoustic correction layer. The acoustic layer is a
 * CORRECTOR of dead reckoning, never an independent locator — the last four
 * fields enforce that: it may only choose among geometrically plausible
 * zones, and it may only act after several consecutive samples agree.
 */
export interface AcousticMatchConfig {
  /** Minimum cosine similarity against the best reference to accept a match. */
  minConfidence: number;
  /**
   * Best similarity must beat the second best by at least this much (when >1
   * candidate). Two candidates within this margin ⇒ no correction at all —
   * a missed correction is always preferable to a wrong one.
   */
  minMargin: number;
  /** Geometric gate: candidate radius = base + factor × current uncertainty (m). */
  candidateBaseRadiusM: number;
  candidateUncertaintyFactor: number;
  /** Temporal gate: consecutive agreeing samples required before ANY correction. */
  consecutiveAgreements: number;
  /** Samples further apart than this don't count as consecutive (streak resets). */
  maxStreakGapMs: number;
}

export interface BlueprintCalibration {
  /** Compass bearing (deg, clockwise from north) a visitor faces when walking toward map +Y. */
  headingOffsetDeg: number;
  /** Stride length (m) assumed per detected step until personalized. */
  defaultStrideM: number;
  stepDetector?: Partial<StepDetectorConfig>;
  geofence?: Partial<GeofenceConfig>;
  acoustic?: Partial<AcousticMatchConfig>;
}

export interface FloorBlueprint {
  schemaVersion: 1;
  venue: {
    id: string;
    name: string;
    languages: LanguageCode[];
    defaultLanguage: LanguageCode;
  };
  /** Where the entrance QR code stands — the position engine's starting point. */
  entry: {
    position: Point;
    note?: string;
  };
  zones: Zone[];
  graph: WalkableGraph;
  calibration: BlueprintCalibration;
}

// ---------------------------------------------------------------------------
// Runtime state & events
// ---------------------------------------------------------------------------

export type PositionSource =
  | 'initial'
  | 'dead-reckoning' // raw step integration, already inside walkable space
  | 'map-match' // step integration landed in a wall and was snapped back
  | 'acoustic-snap'; // re-anchored by a confident acoustic zone match

export interface PositionState {
  position: Point;
  /** Direction of travel, degrees clockwise from map +Y. */
  headingMapDeg: number;
  stepCount: number;
  distanceWalkedM: number;
  /** Honest radius (m) of where the visitor plausibly is. Grows with steps, shrinks on re-anchor. */
  uncertaintyM: number;
  source: PositionSource;
  timestampMs: number;
  /** Debounced zone containment — what the geofence engine currently believes. */
  currentZoneId: string | null;
}

export type ZoneEventType = 'enter' | 'exit';

export interface ZoneEvent {
  type: ZoneEventType;
  zoneId: string;
  timestampMs: number;
  position: Point;
}

/** One accelerometer reading (devicemotion accelerationIncludingGravity), m/s². */
export interface MotionSample {
  tMs: number;
  ax: number;
  ay: number;
  az: number;
}

export interface StepEvent {
  tMs: number;
  /** High-passed acceleration magnitude at the detected peak. */
  magnitude: number;
}

export interface AcousticMatch {
  zoneId: string;
  /** Cosine similarity against the matched zone's stored fingerprint, 0..1. */
  confidence: number;
  /** confidence minus the runner-up's similarity (== confidence when only one reference). */
  margin: number;
}

/** What the engine did with one acoustic sample. */
export type AcousticAction =
  | 'none' // no gated match (unknown sound, ambiguous twins, or empty candidate set)
  | 'streak-building' // confident match, but not enough consecutive agreement yet
  | 'confirmed-in-place' // streak complete, matched zone already contains the estimate
  | 'reanchored'; // streak complete, estimate moved to the matched zone

/**
 * Field-observability record emitted for EVERY acoustic sample, applied or
 * not. Unit tests against synthetic fixtures can't tell you how often this
 * layer fires in a real building — a pilot deployment logging these can.
 */
export interface AcousticSampleAudit {
  timestampMs: number;
  /** Geometric candidate set actually considered (never the full blueprint). */
  candidateZoneIds: string[];
  candidateRadiusM: number;
  /** Gated match within the candidate set, if any. */
  match: AcousticMatch | null;
  /** Similarity gap between the top two candidates (null when fewer than 2 scored). */
  marginToRunnerUp: number | null;
  /** Consecutive agreeing samples including this one (0 when no gated match). */
  streak: number;
  action: AcousticAction;
  positionBefore: Point;
  positionAfter: Point;
}
