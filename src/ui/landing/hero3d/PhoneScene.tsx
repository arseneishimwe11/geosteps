'use client';

/**
 * The one 3D element on the page: the hero device, rendered from a real
 * scanned handset ("Apple iPhone 15 Pro Max Black" by polyman, CC BY 4.0,
 * debranded — see docs/landing-implementation-plan.md and the footer
 * colophon). The display glass is blacked out in the material and the live
 * GuideScreen DOM is projected onto it, so the screen content stays real
 * HTML — selectable, animated by the same keyframes as the CSS fallback.
 *
 * Everything loads lazily and only after HeroDevice's capability gate
 * passes; nothing here touches the network beyond /models and /draco.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GuideScreen } from '../HeroPhone';

const MODEL_URL = '/models/phone.glb';
const DRACO_PATH = '/draco/';

/**
 * The model is authored at real-world metres (0.16 m tall). Drei's Html
 * `transform` maps world units 1:1 onto CSS px before the perspective
 * divide, so a metres-scale scene puts the CSS3D plane thousands of times
 * larger than the canvas and Chromium silently refuses to rasterise it.
 * Scaling the whole scene up keeps the intermediate layer ~13k px — well
 * inside compositor limits — without changing the image.
 */
const SCALE = 150;
/** Screen-surface geometry measured from the model (metres, pre-SCALE). */
const SCREEN = { width: 0.071275, height: 0.15403, z: -0.0061563 };
/** DOM overlay resolution: CSS px mapped onto the glass. */
const SCREEN_PX = { width: 300, height: 648 };
const SCREEN_MESH = 'xXDHkMplTIDAXLN';

/** Neutral studio reflections, generated locally — no HDR fetch. */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    return () => {
      scene.environment = null;
      env.texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Device({ onReady }: { onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL, DRACO_PATH);

  useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name === SCREEN_MESH) {
        // AMOLED off: the DOM overlay is the only light the screen emits.
        (o as THREE.Mesh).material = new THREE.MeshBasicMaterial({ color: 0x000000 });
      }
    });
  }, [scene]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    // slow gallery sway + pointer-follow, both gentle enough to keep the
    // DOM screen legible at all times
    const targetY = Math.PI + Math.sin(t * 0.32) * 0.07 + state.pointer.x * 0.16;
    const targetX = Math.sin(t * 0.23) * 0.03 - state.pointer.y * 0.1;
    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.045;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.045;
    group.current.position.y = Math.sin(t * 0.6) * 0.0022 * SCALE;
  });

  return (
    /* model's screen faces -z; flip the device so it faces the camera */
    <group ref={group} rotation={[0, Math.PI, 0]}>
      <primitive object={scene} scale={SCALE} />
      <Html
        transform
        // with transform mode drei folds distanceFactor into the CSS matrix
        // as 400/df; 400 makes it exactly 1, so `scale` below is plain
        // world-units-per-CSS-px (screen width / DOM width)
        distanceFactor={400}
        position={[0, 0, SCREEN.z * SCALE]}
        rotation={[0, Math.PI, 0]}
        scale={(SCREEN.width * SCALE) / SCREEN_PX.width}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{ width: SCREEN_PX.width, height: SCREEN_PX.height }}
          className="overflow-hidden rounded-[40px]"
        >
          <GuideScreen className="rounded-[40px]" />
        </div>
      </Html>
    </group>
  );
}

export default function PhoneScene({ onReady, paused = false }: { onReady: () => void; paused?: boolean }) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ fov: 25, near: 3, far: 300, position: [0, 0, 0.42 * SCALE] }}
      style={{ background: 'transparent' }}
      frameloop={paused ? 'never' : 'always'}
      aria-hidden
    >
      <StudioEnvironment />
      {/* the lantern: one warm brass key from the upper left */}
      <pointLight position={[-0.25 * SCALE, 0.3 * SCALE, 0.35 * SCALE]} intensity={0.9} color="#d2a24c" decay={0} />
      <Suspense fallback={null}>
        <Device onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL, DRACO_PATH);
