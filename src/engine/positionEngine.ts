import { matchFingerprint } from './acoustic/fingerprint';
import { GeofenceEngine } from './geofence';
import { pointInPolygon, polygonCentroid } from './geometry';
import { compassToMapBearingDeg, HeadingSmoother, mapBearingToVector } from './heading';
import { MapMatcher } from './mapMatching';
import { StepDetector } from './stepDetector';
import type {
  AcousticFingerprint,
  AcousticMatch,
  FloorBlueprint,
  MotionSample,
  Point,
  PositionSource,
  PositionState,
  ZoneEvent,
} from './types';

export interface PositionEngineConfig {
  /** Stride length (m); defaults to the blueprint's calibration value. */
  strideM?: number;
  /** Uncertainty added per integrated step (m). */
  uncertaintyPerStepM?: number;
  initialUncertaintyM?: number;
  maxUncertaintyM?: number;
  /** Uncertainty assigned right after an acoustic re-anchor (room-level, not meter-level). */
  acousticSnapUncertaintyM?: number;
  /** Compass smoothing factor in (0, 1]; 1 disables smoothing (used by deterministic tests). */
  headingSmoothingAlpha?: number;
}

type PositionListener = (s: PositionState) => void;
type ZoneListener = (e: ZoneEvent) => void;

/**
 * The single authority on "where is the visitor".
 *
 * Inputs (all pushed by the platform layer or by simulations):
 *  - accelerometer samples  -> step detection -> dead-reckoning integration
 *  - compass headings       -> smoothed, rotated into the map frame
 *  - ambient audio samples  -> acoustic matching -> optional re-anchor
 *  - clock ticks            -> geofence evaluation while standing still
 *
 * Outputs: PositionState updates and debounced ZoneEvents. Nothing else in
 * the system computes position; the UI and the audio director only consume
 * what this engine reports.
 */
export class PositionEngine {
  private readonly stride: number;
  private readonly uncertaintyPerStep: number;
  private readonly maxUncertainty: number;
  private readonly snapUncertainty: number;

  private readonly smoother: HeadingSmoother;
  private readonly detector: StepDetector;
  private readonly matcher: MapMatcher;
  private readonly geofence: GeofenceEngine;

  private pos: Point;
  private headingMapDeg = 0;
  private hasHeading = false;
  private stepCount = 0;
  private distanceWalked = 0;
  private uncertainty: number;
  private source: PositionSource = 'initial';
  private lastTimestamp = 0;
  private currentZone: string | null = null;

  private positionListeners: PositionListener[] = [];
  private zoneListeners: ZoneListener[] = [];

  constructor(
    private readonly blueprint: FloorBlueprint,
    cfg?: PositionEngineConfig,
  ) {
    this.stride = cfg?.strideM ?? blueprint.calibration.defaultStrideM;
    this.uncertaintyPerStep = cfg?.uncertaintyPerStepM ?? 0.08;
    this.uncertainty = cfg?.initialUncertaintyM ?? 1.0;
    this.maxUncertainty = cfg?.maxUncertaintyM ?? 12;
    this.snapUncertainty = cfg?.acousticSnapUncertaintyM ?? 3.0;

    this.smoother = new HeadingSmoother(cfg?.headingSmoothingAlpha ?? 0.3);
    this.detector = new StepDetector(blueprint.calibration.stepDetector);
    this.matcher = new MapMatcher(blueprint.graph);
    this.geofence = new GeofenceEngine(blueprint.zones, blueprint.calibration.geofence);
    this.pos = { ...blueprint.entry.position };
  }

  onPosition(cb: PositionListener): () => void {
    this.positionListeners.push(cb);
    return () => {
      this.positionListeners = this.positionListeners.filter((l) => l !== cb);
    };
  }

  onZoneEvent(cb: ZoneListener): () => void {
    this.zoneListeners.push(cb);
    return () => {
      this.zoneListeners = this.zoneListeners.filter((l) => l !== cb);
    };
  }

  getState(): PositionState {
    return {
      position: { ...this.pos },
      headingMapDeg: this.headingMapDeg,
      stepCount: this.stepCount,
      distanceWalkedM: this.distanceWalked,
      uncertaintyM: this.uncertainty,
      source: this.source,
      timestampMs: this.lastTimestamp,
      currentZoneId: this.currentZone,
    };
  }

  /** Feed a smoothed-at-source or raw compass heading (deg CW from north). */
  handleHeading(compassDeg: number, tMs: number): void {
    const smoothed = this.smoother.update(compassDeg);
    this.headingMapDeg = compassToMapBearingDeg(smoothed, this.blueprint.calibration.headingOffsetDeg);
    this.hasHeading = true;
    this.lastTimestamp = Math.max(this.lastTimestamp, tMs);
  }

  /** Feed one accelerometer sample; integrates a step when the detector confirms one. */
  handleMotionSample(sample: MotionSample): void {
    const step = this.detector.onSample(sample);
    if (step) this.stepOnce(step.tMs);
  }

  /**
   * Integrate exactly one step at the current heading. Public so simulated
   * walks (tests) and a future manual-assist mode can drive the engine
   * without synthesizing accelerometer waveforms.
   */
  stepOnce(tMs: number): void {
    if (!this.hasHeading) return; // no heading yet — refuse to guess a direction
    const v = mapBearingToVector(this.headingMapDeg);
    const raw = { x: this.pos.x + this.stride * v.x, y: this.pos.y + this.stride * v.y };
    const m = this.matcher.match(raw);
    this.pos = m.position;
    this.stepCount++;
    this.distanceWalked += this.stride;
    this.uncertainty = Math.min(this.maxUncertainty, this.uncertainty + this.uncertaintyPerStep);
    this.source = m.snapped ? 'map-match' : 'dead-reckoning';
    this.lastTimestamp = tMs;
    this.emitPosition();
    this.evaluateZones(tMs);
  }

  /** Periodic clock tick so the geofence debounce advances while standing still. */
  tick(tMs: number): void {
    this.lastTimestamp = Math.max(this.lastTimestamp, tMs);
    this.evaluateZones(tMs);
  }

  /**
   * Feed a runtime ambient-audio fingerprint. On a confident match against a
   * zone the engine doesn't already believe it is in, re-anchor to that
   * zone's centroid (map-matched onto the walkable graph). On a match that
   * agrees with the current estimate, just tighten the uncertainty. On no
   * confident match: do nothing at all — dead reckoning carries on.
   */
  handleAcousticSample(sample: AcousticFingerprint, tMs: number): AcousticMatch | null {
    const refs = this.blueprint.zones
      .filter((z) => z.fingerprint)
      .map((z) => ({ zoneId: z.id, fingerprint: z.fingerprint! }));
    const match = matchFingerprint(sample, refs, this.blueprint.calibration.acoustic);
    if (!match) return null;

    const zone = this.blueprint.zones.find((z) => z.id === match.zoneId)!;
    this.lastTimestamp = tMs;
    if (pointInPolygon(this.pos, zone.polygon)) {
      // Confirmation: the estimate already agrees — shrink uncertainty, don't move.
      this.uncertainty = Math.min(this.uncertainty, this.snapUncertainty);
      this.source = 'acoustic-snap';
      this.emitPosition();
    } else {
      const centroid = polygonCentroid(zone.polygon);
      this.pos = this.matcher.match(centroid).position;
      this.uncertainty = this.snapUncertainty;
      this.source = 'acoustic-snap';
      this.emitPosition();
      this.evaluateZones(tMs);
    }
    return match;
  }

  private evaluateZones(tMs: number): void {
    const events = this.geofence.update(this.pos, tMs);
    for (const ev of events) {
      this.currentZone = this.geofence.currentZoneId;
      for (const l of this.zoneListeners) l(ev);
    }
    if (events.length > 0) this.emitPosition();
  }

  private emitPosition(): void {
    this.currentZone = this.geofence.currentZoneId;
    const state = this.getState();
    for (const l of this.positionListeners) l(state);
  }
}
