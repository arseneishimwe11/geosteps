/**
 * Public API of the geosteps position engine.
 *
 * The frozen surface consumed by the tourist UI, the admin calibration tool,
 * and the tests. See HANDOFF.md for the API contract and acceptance criteria.
 */
export * from './types';
export {
  norm360,
  pointInPolygon,
  distanceToPolygonBoundary,
  interiorDepth,
  polygonCentroid,
  projectOnSegment,
} from './geometry';
export { HeadingSmoother, compassToMapBearingDeg, mapBearingToVector } from './heading';
export { StepDetector, DEFAULT_STEP_DETECTOR_CONFIG } from './stepDetector';
export { MapMatcher, type MapMatchResult } from './mapMatching';
export { GeofenceEngine, DEFAULT_GEOFENCE_CONFIG } from './geofence';
export {
  computeFingerprint,
  matchFingerprint,
  scoreFingerprints,
  gateScores,
  cosineSimilarity,
  DEFAULT_ACOUSTIC_MATCH_CONFIG,
  DEFAULT_FINGERPRINT_OPTIONS,
  type FingerprintOptions,
  type FingerprintScore,
} from './acoustic/fingerprint';
export { PositionEngine, type PositionEngineConfig } from './positionEngine';
export {
  AudioDirector,
  DEFAULT_AUDIO_DIRECTOR_CONFIG,
  type AudioBackend,
  type AudioTrackHandle,
  type AudioDirectorConfig,
  type AudioDirectorState,
} from './audio/audioDirector';
export {
  detectCapabilities,
  requestMotionPermissions,
  startMotionStream,
  startHeadingStream,
  type Capability,
  type CapabilityReport,
  type CapabilityStatus,
  type BrowserEnv,
  type HeadingReading,
} from './platform/sensors';
export {
  WakeLockManager,
  type WakeLockState,
  type WakeLockEnv,
  type WakeLockSentinelLike,
} from './platform/wakeLock';
export { validateBlueprint, type BlueprintValidation } from './blueprint';
