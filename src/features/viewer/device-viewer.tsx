"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  RoundedBox,
  useGLTF,
} from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  Color,
  DoubleSide,
  Euler,
  FrontSide,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  Plane,
  PCFSoftShadowMap,
  Quaternion,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  deriveAssembledTransforms,
  deriveExplodedTransforms,
  type AssemblyManifest,
  type AssemblyPart,
  type GeometryAsset,
  type PbrMaterialProfile,
} from "@/domain/assembly";
import type { ComponentNode } from "@/domain/evidence/schema";
import { explodedPosition } from "@/domain/reconstruction/explode";

export type SceneMode = "bench" | "exploded" | "assembled";
export type CameraViewPreset = "isometric" | "front" | "top" | "side";

const WORKBENCH_Y = -1.34;
const SCENE_SCALE = 0.011;
const dragPlane = new Plane(new Vector3(0, 1, 0), -WORKBENCH_Y);

type PartSceneTransform = {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
};

type RenderGeometry = {
  dimensionsMm: readonly [number, number, number];
  primitive: "box" | "rounded_box" | "cylinder" | "sphere" | "plane";
  cornerRadiusMm?: number;
  offsetMm: readonly [number, number, number];
};

const DEFAULT_DIMENSIONS_MM = [70, 45, 5] as const;
const ZERO_OFFSET_MM = [0, 0, 0] as const;

const materialColors: Record<string, string> = {
  display: "#24333b",
  structure: "#a7adb0",
  electronics: "#367563",
  battery: "#767e82",
  camera: "#24292c",
  housing: "#d2d0c9",
};

const physicalOffsets: Record<string, readonly [number, number]> = {
  board: [-0.62, 0.32],
  battery: [0.32, -0.16],
  camera: [0.96, 0.64],
};

const DEMO_ASSEMBLY_ID = "framework-laptop-13-reference-assembly";
const keyboardKeys = Array.from({ length: 60 }, (_, index) => ({
  x: ((index % 12) - 5.5) * 0.19,
  y: 0.7 - Math.floor(index / 12) * 0.19,
}));
const boardComponents = [
  [-0.78, -0.18, 0.12, 0.1],
  [-0.57, -0.2, 0.16, 0.08],
  [-0.31, -0.19, 0.11, 0.11],
  [0.02, -0.2, 0.24, 0.07],
  [0.39, -0.18, 0.13, 0.1],
  [0.68, -0.17, 0.18, 0.08],
  [0.87, 0.18, 0.1, 0.13],
  [0.62, 0.2, 0.14, 0.09],
] as const;
const coverScrews = [
  [-1.43, -1.08],
  [1.43, -1.08],
  [-1.43, 1.08],
  [1.43, 1.08],
  [0, -1.08],
] as const;
const ventSlots = Array.from({ length: 15 }, (_, index) => (index - 7) * 0.14);
const fanBlades = Array.from({ length: 11 }, (_, index) => index);

function sceneTransformFromMatrix(
  worldMatrix: readonly number[],
): PartSceneTransform {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  new Matrix4().fromArray(worldMatrix).decompose(position, quaternion, scale);
  position.multiplyScalar(SCENE_SCALE);
  return { position, quaternion, scale };
}

function renderGeometryForPart(
  component: ComponentNode,
  assemblyPart?: AssemblyPart,
  geometryAsset?: GeometryAsset,
): RenderGeometry {
  if (assemblyPart?.geometry.kind === "parametric") {
    return {
      dimensionsMm: assemblyPart.geometry.dimensionsMm,
      primitive: assemblyPart.geometry.primitive,
      cornerRadiusMm: assemblyPart.geometry.cornerRadiusMm,
      offsetMm: ZERO_OFFSET_MM,
    };
  }

  if (assemblyPart?.geometry.kind === "asset" && geometryAsset?.boundsMm) {
    const { minMm, maxMm } = geometryAsset.boundsMm;
    return {
      dimensionsMm: [
        maxMm[0] - minMm[0],
        maxMm[1] - minMm[1],
        maxMm[2] - minMm[2],
      ],
      // Asset loading is intentionally conservative: until a format-specific
      // loader is validated, its documented bounds are shown as a proxy.
      primitive: "box",
      offsetMm: [
        (minMm[0] + maxMm[0]) / 2,
        (minMm[1] + maxMm[1]) / 2,
        (minMm[2] + maxMm[2]) / 2,
      ],
    };
  }

  const dimensionsMm =
    assemblyPart?.geometry.kind === "placeholder"
      ? assemblyPart.geometry.dimensionsMm
      : component.geometry.dimensionsMm;

  return {
    dimensionsMm: dimensionsMm ?? DEFAULT_DIMENSIONS_MM,
    primitive:
      component.geometry.primitive === "cylinder"
        ? "cylinder"
        : component.geometry.primitive === "plane"
          ? "plane"
          : "box",
    offsetMm: ZERO_OFFSET_MM,
  };
}

function WorkbenchSurface({ reducedGraphics }: { reducedGraphics: boolean }) {
  return (
    <group>
      <mesh position={[0, WORKBENCH_Y - 0.055, 0]} receiveShadow>
        <boxGeometry args={[18, 0.1, 18]} />
        <meshStandardMaterial
          color="#d8d5cd"
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>
      {!reducedGraphics && (
        <>
          <mesh
            position={[-4.7, WORKBENCH_Y + 0.015, -3.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.15, 0.18, 32]} />
            <meshBasicMaterial color="#e25a38" />
          </mesh>
          <mesh
            position={[4.7, WORKBENCH_Y + 0.015, 3.6]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.15, 0.18, 32]} />
            <meshBasicMaterial color="#e25a38" />
          </mesh>
        </>
      )}
    </group>
  );
}

function StudioLighting({ reducedGraphics }: { reducedGraphics: boolean }) {
  if (reducedGraphics) {
    return (
      <>
        <hemisphereLight args={["#fffdf5", "#8a877f", 1.55]} />
        <directionalLight
          position={[4, 7, 5]}
          color="#fffaf0"
          intensity={2.1}
        />
      </>
    );
  }

  return (
    <>
      <hemisphereLight args={["#fffdf5", "#77736c", 0.85]} />
      <directionalLight
        castShadow
        position={[4, 7, 5]}
        color="#fff8e8"
        intensity={2.15}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00008}
        shadow-normalBias={0.018}
        shadow-radius={3}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight
        position={[-4, 2, 3]}
        color="#b8d1db"
        intensity={0.65}
      />
      <Environment
        background={false}
        frames={1}
        resolution={512}
        environmentIntensity={0.86}
      >
        <Lightformer
          form="rect"
          color="#fff4df"
          intensity={5.2}
          position={[0, 6, 4]}
          scale={[5.5, 2.4, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          color="#d8eff7"
          intensity={3.1}
          position={[-5, 1.5, 1]}
          scale={[2.8, 4.5, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form="rect"
          color="#ffd6bd"
          intensity={2.35}
          position={[4, 2.5, -5]}
          scale={[3.4, 2.1, 1]}
          target={[0, 0, 0]}
        />
      </Environment>
    </>
  );
}

function PartSurfaceMaterial({
  profile,
  fallbackColor,
  accentColor,
  fallbackRoughness,
  fallbackMetalness,
  unknown,
  unknownOpacity,
  selected,
  reducedGraphics,
}: {
  profile?: PbrMaterialProfile;
  fallbackColor: string;
  accentColor?: string;
  fallbackRoughness: number;
  fallbackMetalness: number;
  unknown: boolean;
  unknownOpacity: number;
  selected: boolean;
  reducedGraphics: boolean;
}) {
  const color = useMemo(() => {
    if (accentColor) return accentColor;
    if (!profile) return fallbackColor;
    return new Color().setRGB(...profile.baseColor);
  }, [accentColor, fallbackColor, profile]);
  const emissive = useMemo(() => {
    if (!profile?.emissiveColor) return new Color(0, 0, 0);
    return new Color().setRGB(...profile.emissiveColor);
  }, [profile]);
  const normalScale = useMemo(
    () =>
      profile?.normalScale
        ? new Vector2(profile.normalScale[0], profile.normalScale[1])
        : new Vector2(1, 1),
    [profile],
  );
  const profileOpacity = profile?.opacity ?? 1;
  const opacity = Math.min(profileOpacity, unknown ? unknownOpacity : 1);
  const transmission = profile?.transmission ?? 0;
  const transparent = opacity < 1 || transmission > 0;
  const common = {
    color,
    roughness: profile?.roughness ?? fallbackRoughness,
    metalness: profile?.metalness ?? fallbackMetalness,
    emissive,
    emissiveIntensity: profile?.emissiveIntensity ?? 0,
    normalScale,
    opacity,
    transparent,
    depthWrite: !transparent,
    side: profile?.doubleSided ? DoubleSide : FrontSide,
    wireframe: unknown && !selected,
  };

  if (reducedGraphics) {
    return <meshStandardMaterial {...common} />;
  }

  return (
    <meshPhysicalMaterial
      {...common}
      clearcoat={profile?.clearcoat ?? 0}
      clearcoatRoughness={profile?.clearcoatRoughness ?? 0}
      transmission={transmission}
      ior={profile?.ior ?? 1.5}
    />
  );
}

function PartDetails({
  component,
  depth,
  enabled,
}: {
  component: ComponentNode;
  depth: number;
  enabled: boolean;
}) {
  // Decorative details belong only to the curated reference demo. Live
  // evidence-derived components never gain imagined internals.
  if (!enabled) return null;

  if (component.id === "board") {
    return (
      <group position={[0, 0, depth / 2 + 0.018]}>
        <mesh position={[-0.31, 0.08, 0.025]}>
          <boxGeometry args={[0.3, 0.28, 0.05]} />
          <meshStandardMaterial color="#172328" roughness={0.55} />
        </mesh>
        <mesh position={[0.3, 0.11, 0.022]}>
          <boxGeometry args={[0.52, 0.18, 0.044]} />
          <meshStandardMaterial
            color="#1b2427"
            metalness={0.35}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[-0.02, 0.27, 0.04]} rotation={[0, 0, -0.08]}>
          <boxGeometry args={[1.22, 0.075, 0.055]} />
          <meshStandardMaterial
            color="#b87333"
            metalness={0.78}
            roughness={0.3}
          />
        </mesh>
        {boardComponents.map(([x, y, width, height], index) => (
          <mesh key={index} position={[x, y, 0.018]}>
            <boxGeometry args={[width, height, 0.036]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? "#c2a25e" : "#293237"}
              metalness={index % 3 === 0 ? 0.58 : 0.22}
              roughness={0.5}
            />
          </mesh>
        ))}
        {[-0.92, -0.7, 0.72, 0.92].map((x) => (
          <mesh key={x} position={[x, 0.36, 0.035]}>
            <boxGeometry args={[0.15, 0.08, 0.07]} />
            <meshStandardMaterial
              color="#aeb8b9"
              metalness={0.82}
              roughness={0.28}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (component.id === "screen") {
    return (
      <group position={[0, 0, depth / 2 + 0.012]}>
        <mesh>
          <planeGeometry args={[2.75, 1.78]} />
          <meshPhysicalMaterial
            color="#142a31"
            metalness={0.12}
            roughness={0.14}
            clearcoat={0.8}
            clearcoatRoughness={0.18}
          />
        </mesh>
        <mesh position={[0, 0.94, 0.009]}>
          <circleGeometry args={[0.025, 20]} />
          <meshStandardMaterial color="#0a0f11" metalness={0.5} />
        </mesh>
        <mesh position={[0, -0.97, 0.009]}>
          <boxGeometry args={[0.24, 0.018, 0.01]} />
          <meshStandardMaterial color="#9ea8a9" metalness={0.6} />
        </mesh>
      </group>
    );
  }

  if (component.id === "input-cover") {
    return (
      <group position={[0, 0, depth / 2 + 0.012]}>
        <mesh position={[0, 0.34, 0]}>
          <planeGeometry args={[2.5, 1.15]} />
          <meshStandardMaterial color="#20272a" roughness={0.72} />
        </mesh>
        {keyboardKeys.map((key, index) => (
          <mesh key={index} position={[key.x, key.y, 0.008]}>
            <boxGeometry args={[0.16, 0.135, 0.022]} />
            <meshStandardMaterial color="#30383b" roughness={0.68} />
          </mesh>
        ))}
        <mesh position={[0, -0.57, 0.004]}>
          <planeGeometry args={[1.14, 0.64]} />
          <meshStandardMaterial
            color="#bfc2bf"
            metalness={0.42}
            roughness={0.38}
          />
        </mesh>
      </group>
    );
  }

  if (component.id === "battery") {
    return (
      <group position={[0, 0, depth / 2 + 0.012]}>
        {[-0.82, 0, 0.82].map((x) => (
          <mesh key={x} position={[x, 0, 0.008]}>
            <boxGeometry args={[0.74, 0.84, 0.018]} />
            <meshStandardMaterial
              color="#485156"
              metalness={0.52}
              roughness={0.42}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.02, 0.025]}>
          <planeGeometry args={[0.72, 0.42]} />
          <meshStandardMaterial color="#d7dad7" roughness={0.78} />
        </mesh>
        {[0.09, 0, -0.09].map((y) => (
          <mesh key={y} position={[0, y, 0.032]}>
            <boxGeometry args={[0.48, 0.012, 0.008]} />
            <meshStandardMaterial color="#798184" />
          </mesh>
        ))}
        <mesh position={[1.24, 0.22, 0.035]}>
          <boxGeometry args={[0.16, 0.22, 0.07]} />
          <meshStandardMaterial color="#c2a457" metalness={0.64} />
        </mesh>
      </group>
    );
  }

  if (component.id === "speakers") {
    return (
      <group position={[0, 0, depth / 2 + 0.016]}>
        {[-1.13, 1.13].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.42, 0.25, 0.08]} />
              <meshStandardMaterial color="#202629" roughness={0.62} />
            </mesh>
            {[-0.1, 0, 0.1].map((offset) => (
              <mesh key={offset} position={[offset, 0, 0.045]}>
                <circleGeometry args={[0.035, 14]} />
                <meshStandardMaterial color="#778083" />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0, 0.012]}>
          <boxGeometry args={[1.85, 0.035, 0.024]} />
          <meshStandardMaterial color="#343c3f" />
        </mesh>
      </group>
    );
  }

  if (component.id === "bottom-cover") {
    return (
      <group position={[0, 0, depth / 2 + 0.012]}>
        {ventSlots.map((x) => (
          <mesh key={x} position={[x, 0.78, 0]}>
            <boxGeometry args={[0.075, 0.42, 0.018]} />
            <meshStandardMaterial color="#50585a" roughness={0.72} />
          </mesh>
        ))}
        {coverScrews.map(([x, y]) => (
          <mesh key={`${x}:${y}`} position={[x, y, 0.012]}>
            <circleGeometry args={[0.035, 16]} />
            <meshStandardMaterial
              color="#697174"
              metalness={0.72}
              roughness={0.32}
            />
          </mesh>
        ))}
        <mesh position={[0, -0.32, 0.008]}>
          <planeGeometry args={[0.78, 0.46]} />
          <meshStandardMaterial color="#b4b7b4" roughness={0.7} />
        </mesh>
      </group>
    );
  }

  return null;
}

function FanDetails({ enabled, depth }: { enabled: boolean; depth: number }) {
  if (!enabled) return null;
  return (
    <group position={[0, 0, depth / 2 + 0.012]}>
      <mesh>
        <ringGeometry args={[0.22, 0.34, 32]} />
        <meshStandardMaterial color="#20272a" metalness={0.35} />
      </mesh>
      {fanBlades.map((index) => {
        const angle = (index / fanBlades.length) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, 0.012]}
            rotation={[0, 0, angle + 0.55]}
          >
            <boxGeometry args={[0.23, 0.065, 0.022]} />
            <meshStandardMaterial color="#3b4548" roughness={0.48} />
          </mesh>
        );
      })}
      <mesh position={[0, 0, 0.026]}>
        <circleGeometry args={[0.09, 24]} />
        <meshStandardMaterial color="#9ba4a5" metalness={0.55} />
      </mesh>
    </group>
  );
}

function AssetPartMesh({
  asset,
  reducedGraphics,
}: {
  asset: GeometryAsset;
  reducedGraphics: boolean;
}) {
  const gltf = useGLTF(asset.uri);
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = !reducedGraphics;
        object.receiveShadow = !reducedGraphics;
      }
    });
    return clone;
  }, [gltf.scene, reducedGraphics]);

  return (
    <primitive
      object={scene}
      scale={asset.millimetresPerAssetUnit * SCENE_SCALE}
    />
  );
}

type DragState = {
  pointerId: number;
  captureTarget: Element | null;
  offsetX: number;
  offsetZ: number;
};

function Part({
  component,
  assemblyPart,
  geometryAsset,
  materialProfile,
  assemblyTransform,
  reducedGraphics,
  index,
  count,
  explode,
  mode,
  arrangeKey,
  benchTarget,
  selected,
  isolated,
  warning,
  referenceDetails,
  onSelect,
  onHoverChange,
  onDragChange,
}: {
  component: ComponentNode;
  assemblyPart?: AssemblyPart;
  geometryAsset?: GeometryAsset;
  materialProfile?: PbrMaterialProfile;
  assemblyTransform?: PartSceneTransform;
  reducedGraphics: boolean;
  index: number;
  count: number;
  explode: number;
  mode: SceneMode;
  arrangeKey: number;
  benchTarget: Vector3;
  selected: boolean;
  isolated: boolean;
  warning: boolean;
  referenceDetails: boolean;
  onSelect: (id: string) => void;
  onHoverChange: (hovered: boolean) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const group = useRef<Group>(null);
  const transitionStartedAt = useRef(0);
  const drag = useRef<DragState | null>(null);
  const dragPoint = useRef(new Vector3());
  const invalidate = useThree((state) => state.invalidate);
  const controls = useThree((state) => state.controls) as
    OrbitControlsImpl | undefined;
  const [hovered, setHovered] = useState(false);
  const [manualOffset, setManualOffset] = useState<readonly [number, number]>([
    0, 0,
  ]);
  const renderGeometry = renderGeometryForPart(
    component,
    assemblyPart,
    geometryAsset,
  );
  const [width, height, sourceDepth] = renderGeometry.dimensionsMm;
  const depth = Math.max(sourceDepth * SCENE_SCALE, 0.038);
  const sceneWidth = width * SCENE_SCALE;
  const sceneHeight = height * SCENE_SCALE;
  const hitWidth = Math.max(sceneWidth, 0.72);
  const hitHeight = Math.max(sceneHeight, 0.58);
  const hitDepth = Math.max(depth, 0.18);
  const isCylinder = renderGeometry.primitive === "cylinder";
  const renderableAsset =
    assemblyPart?.geometry.kind === "asset" &&
    geometryAsset &&
    (geometryAsset.format === "glb" || geometryAsset.format === "gltf")
      ? geometryAsset
      : null;
  const [physicalX, physicalY] = physicalOffsets[component.id] ?? [0, 0];
  const unknown =
    assemblyPart?.fidelity.level === "placeholder" ||
    component.geometry.kind === "placeholder";
  const exploded = explodedPosition(index, count, explode * 1.6);
  const bench = useMemo(
    () =>
      new Vector3(
        benchTarget.x,
        WORKBENCH_Y + depth / 2 + 0.035,
        benchTarget.z,
      ),
    [benchTarget.x, benchTarget.z, depth],
  );

  const targetPosition = useMemo(() => {
    if (mode === "bench") {
      return new Vector3(
        bench.x + manualOffset[0],
        bench.y,
        bench.z + manualOffset[1],
      );
    }
    if (assemblyTransform) {
      return assemblyTransform.position.clone();
    }
    if (mode === "assembled") {
      return new Vector3(physicalX, physicalY, index * 0.012);
    }
    return new Vector3(physicalX, physicalY, exploded[2]);
  }, [
    assemblyTransform,
    bench,
    exploded,
    index,
    manualOffset,
    mode,
    physicalX,
    physicalY,
  ]);

  const targetRotation = useMemo(() => {
    if (mode === "bench") return new Euler(-Math.PI / 2, 0, 0);
    if (assemblyTransform) {
      return new Euler().setFromQuaternion(assemblyTransform.quaternion);
    }
    return new Euler(-0.05, 0.06, 0.02);
  }, [assemblyTransform, mode]);
  const color = warning
    ? "#cf3f2f"
    : selected
      ? "#e25a38"
      : hovered
        ? "#ee7a5e"
        : (materialColors[component.category] ?? "#879095");

  useEffect(() => {
    transitionStartedAt.current = performance.now() / 1000;
    invalidate();
  }, [invalidate, mode]);

  useEffect(() => {
    setManualOffset([0, 0]);
    invalidate();
  }, [arrangeKey, invalidate]);

  useEffect(() => {
    if (mode === "bench" || !drag.current) return;

    const activeDrag = drag.current;
    if (activeDrag.captureTarget?.hasPointerCapture(activeDrag.pointerId)) {
      activeDrag.captureTarget.releasePointerCapture(activeDrag.pointerId);
    }
    drag.current = null;
    if (controls) controls.enabled = true;
    onDragChange(false);
    invalidate();
  }, [controls, invalidate, mode, onDragChange]);

  useEffect(
    () => () => {
      if (drag.current) onDragChange(false);
      if (controls) controls.enabled = true;
    },
    [controls, onDragChange],
  );

  useFrame((_, delta) => {
    const current = group.current;
    if (!current) return;

    const stagger = mode === "assembled" ? index * 0.11 : index * 0.025;
    if (performance.now() / 1000 - transitionStartedAt.current < stagger) {
      invalidate();
      return;
    }

    const speed = mode === "assembled" ? 4.8 : 7.5;
    const alpha = 1 - Math.exp(-speed * delta);
    current.position.lerp(targetPosition, alpha);
    current.rotation.x = MathUtils.damp(
      current.rotation.x,
      targetRotation.x,
      speed,
      delta,
    );
    current.rotation.y = MathUtils.damp(
      current.rotation.y,
      targetRotation.y,
      speed,
      delta,
    );
    current.rotation.z = MathUtils.damp(
      current.rotation.z,
      targetRotation.z,
      speed,
      delta,
    );

    const moving =
      current.position.distanceToSquared(targetPosition) > 0.000001 ||
      Math.abs(current.rotation.x - targetRotation.x) > 0.0005;
    if (moving || drag.current) invalidate();
  });

  function pointOnWorkbench(event: ThreeEvent<PointerEvent>) {
    return event.ray.intersectPlane(dragPlane, dragPoint.current);
  }

  function startDrag(event: ThreeEvent<PointerEvent>) {
    onSelect(component.id);
    const isPrimaryMove =
      event.isPrimary && (event.pointerType !== "mouse" || event.button === 0);
    if (mode !== "bench" || !isPrimaryMove) return;

    event.stopPropagation();

    const point = pointOnWorkbench(event);
    const current = group.current;
    if (!point || !current) return;

    // Fiber and OrbitControls listen to the same canvas pointer event. Prevent
    // OrbitControls from also entering its rotate state for this pointer; just
    // toggling `enabled` is too late when both handlers process pointerdown.
    event.nativeEvent.stopImmediatePropagation();
    event.nativeEvent.preventDefault();
    const target = event.nativeEvent.target;
    const captureTarget = target instanceof Element ? target : null;
    drag.current = {
      pointerId: event.pointerId,
      captureTarget,
      offsetX: current.position.x - point.x,
      offsetZ: current.position.z - point.z,
    };
    captureTarget?.setPointerCapture(event.pointerId);
    if (controls) controls.enabled = false;
    onDragChange(true);
    invalidate();
  }

  function movePart(event: ThreeEvent<PointerEvent>) {
    if (!drag.current || mode !== "bench") return;
    event.stopPropagation();
    const point = pointOnWorkbench(event);
    if (!point) return;

    const nextX = MathUtils.clamp(point.x + drag.current.offsetX, -7.5, 7.5);
    const nextZ = MathUtils.clamp(point.z + drag.current.offsetZ, -7.5, 7.5);
    setManualOffset([nextX - bench.x, nextZ - bench.z]);
    group.current?.position.set(nextX, bench.y, nextZ);
    invalidate();
  }

  function stopDrag(event: ThreeEvent<PointerEvent>) {
    const activeDrag = drag.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (activeDrag.captureTarget?.hasPointerCapture(activeDrag.pointerId)) {
      activeDrag.captureTarget.releasePointerCapture(activeDrag.pointerId);
    }
    drag.current = null;
    if (controls) controls.enabled = true;
    onDragChange(false);
    invalidate();
  }

  return (
    <group
      ref={group}
      position={targetPosition}
      rotation={[targetRotation.x, targetRotation.y, targetRotation.z]}
      scale={assemblyTransform?.scale}
      visible={!isolated || selected || warning}
      onPointerDown={startDrag}
      onPointerMove={movePart}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHovered(true);
        onHoverChange(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
        if (!drag.current) onHoverChange(false);
      }}
    >
      {mode === "bench" && (
        <mesh>
          <boxGeometry args={[hitWidth, hitHeight, hitDepth]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      )}
      {renderableAsset ? (
        <Suspense
          fallback={
            <RoundedBox
              args={[sceneWidth, sceneHeight, depth]}
              radius={Math.min(0.045, depth / 2.4)}
              smoothness={5}
            >
              <meshStandardMaterial
                color="#7f8b8f"
                roughness={0.72}
                wireframe
              />
            </RoundedBox>
          }
        >
          <AssetPartMesh
            asset={renderableAsset}
            reducedGraphics={reducedGraphics}
          />
        </Suspense>
      ) : isCylinder ? (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry
              args={[
                Math.max(sceneWidth / 2, 0.04),
                Math.max(sceneWidth / 2, 0.04),
                depth,
                48,
              ]}
            />
            <PartSurfaceMaterial
              profile={materialProfile}
              fallbackColor={color}
              fallbackRoughness={0.2}
              fallbackMetalness={0.55}
              unknown={unknown}
              unknownOpacity={0.68}
              selected={selected}
              reducedGraphics={reducedGraphics}
            />
          </mesh>
          {component.id === "fan" && (
            <FanDetails enabled={referenceDetails} depth={depth} />
          )}
          {component.category === "camera" && (
            <mesh position={[0, 0, depth / 2 + 0.004]}>
              <circleGeometry args={[Math.max(sceneWidth * 0.3, 0.025), 28]} />
              <meshStandardMaterial
                color="#101416"
                roughness={0.12}
                metalness={0.4}
              />
            </mesh>
          )}
        </>
      ) : (
        <RoundedBox
          args={[sceneWidth, sceneHeight, depth]}
          radius={Math.min(0.045, depth / 2.4)}
          smoothness={5}
          castShadow
          receiveShadow
        >
          <PartSurfaceMaterial
            profile={materialProfile}
            fallbackColor={color}
            fallbackRoughness={component.category === "display" ? 0.18 : 0.58}
            fallbackMetalness={component.category === "structure" ? 0.62 : 0.12}
            unknown={unknown}
            unknownOpacity={hovered ? 0.72 : 0.58}
            selected={selected}
            reducedGraphics={reducedGraphics}
          />
          <Edges
            scale={1.002}
            color={
              warning
                ? "#7f2118"
                : selected
                  ? "#8e2f1b"
                  : hovered
                    ? "#b84a31"
                    : "#7e8588"
            }
          />
          <PartDetails
            component={component}
            depth={depth}
            enabled={referenceDetails}
          />
        </RoundedBox>
      )}
    </group>
  );
}

function CameraControls({
  fitTarget,
  fitRadius,
  fitKey,
  resetKey,
  viewPreset,
  enabled,
}: {
  fitTarget: readonly [number, number, number];
  fitRadius: number;
  fitKey: string;
  resetKey: number;
  viewPreset: CameraViewPreset;
  enabled: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const minDistance = Math.max(0.45, fitRadius * 0.45);
  const maxDistance = Math.max(12, fitRadius * 9);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const target = new Vector3(...fitTarget);
    const perspectiveFov = "fov" in camera ? camera.fov : 44;
    const distance = Math.max(
      1.4,
      (fitRadius / Math.tan(MathUtils.degToRad(perspectiveFov) / 2)) * 1.35,
    );
    const direction =
      viewPreset === "front"
        ? new Vector3(0, 0.08, 1)
        : viewPreset === "top"
          ? new Vector3(0, 1, 0.3)
          : viewPreset === "side"
            ? new Vector3(1, 0.08, 0)
            : new Vector3(1, 0.78, 1.18);
    direction.normalize();
    orbit.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.near = Math.max(0.01, distance / 200);
    camera.far = Math.max(100, distance * 30);
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [camera, fitKey, fitRadius, fitTarget, invalidate, resetKey, viewPreset]);

  useEffect(() => {
    function navigateWithKeyboard(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "SUMMARY"].includes(
            target.tagName,
          ))
      ) {
        return;
      }

      const orbit = controls.current;
      if (!orbit || !enabled) return;

      const key = event.key.toLowerCase();
      const panStep = event.shiftKey ? 0.65 : 0.28;
      const zoomStep = event.shiftKey ? 1.1 : 0.55;
      const forward = orbit.target
        .clone()
        .sub(camera.position)
        .setY(0)
        .normalize();
      const right = forward.clone().cross(camera.up).normalize();
      const movement = new Vector3();
      let handled = true;

      if (key === "w" || key === "arrowup") {
        movement.addScaledVector(forward, panStep);
      } else if (key === "s" || key === "arrowdown") {
        movement.addScaledVector(forward, -panStep);
      } else if (key === "a" || key === "arrowleft") {
        movement.addScaledVector(right, -panStep);
      } else if (key === "d" || key === "arrowright") {
        movement.addScaledVector(right, panStep);
      } else if (key === "+" || key === "=") {
        const distance = camera.position.distanceTo(orbit.target);
        if (distance > minDistance) {
          camera.position.addScaledVector(
            orbit.target.clone().sub(camera.position).normalize(),
            Math.min(zoomStep, distance - minDistance),
          );
        }
      } else if (key === "-" || key === "_") {
        const distance = camera.position.distanceTo(orbit.target);
        if (distance < maxDistance) {
          camera.position.addScaledVector(
            camera.position.clone().sub(orbit.target).normalize(),
            Math.min(zoomStep, maxDistance - distance),
          );
        }
      } else if (key === "q" || key === "e") {
        const offset = camera.position.clone().sub(orbit.target);
        offset.applyAxisAngle(camera.up, key === "q" ? 0.09 : -0.09);
        camera.position.copy(orbit.target).add(offset);
      } else if (key === "0") {
        orbit.reset();
      } else {
        handled = false;
      }

      if (!handled) return;
      event.preventDefault();
      if (movement.lengthSq() > 0) {
        camera.position.add(movement);
        orbit.target.add(movement);
      }
      orbit.update();
      invalidate();
    }

    window.addEventListener("keydown", navigateWithKeyboard);
    return () => window.removeEventListener("keydown", navigateWithKeyboard);
  }, [camera, enabled, invalidate, maxDistance, minDistance]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.08}
      enablePan
      screenSpacePanning
      panSpeed={0.85}
      rotateSpeed={0.7}
      zoomSpeed={0.85}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.28}
      maxPolarAngle={1.48}
    />
  );
}

export function DeviceViewer({
  components,
  assembly,
  explode,
  mode,
  arrangeKey,
  selected,
  isolated,
  showGrid,
  reducedGraphics,
  resetKey,
  cameraView = "isometric",
  warningPartIds,
  interactive = true,
  onSelect,
  onReady,
}: {
  components: ComponentNode[];
  assembly?: AssemblyManifest | null;
  explode: number;
  mode: SceneMode;
  arrangeKey: number;
  selected: string | null;
  isolated: boolean;
  showGrid: boolean;
  reducedGraphics: boolean;
  resetKey: number;
  cameraView?: CameraViewPreset;
  warningPartIds?: readonly string[];
  /** Disable pointer, wheel and keyboard controls for scroll-led presentation views. */
  interactive?: boolean;
  onSelect: (id: string) => void;
  onReady?: () => void;
}) {
  const [partHovered, setPartHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const assemblyParts = useMemo(
    () => new Map(assembly?.parts.map((part) => [part.id, part]) ?? []),
    [assembly],
  );
  const geometryAssets = useMemo(
    () => new Map(assembly?.assets.map((asset) => [asset.id, asset]) ?? []),
    [assembly],
  );
  const materialProfiles = useMemo(
    () =>
      new Map(
        assembly?.materialProfiles.map((profile) => [profile.id, profile]) ??
          [],
      ),
    [assembly],
  );
  const renderGeometries = useMemo(
    () =>
      new Map(
        components.map((component) => {
          const assemblyPart = assemblyParts.get(component.id);
          const geometryAsset =
            assemblyPart?.geometry.kind === "asset"
              ? geometryAssets.get(assemblyPart.geometry.assetId)
              : undefined;
          return [
            component.id,
            renderGeometryForPart(component, assemblyPart, geometryAsset),
          ] as const;
        }),
      ),
    [assemblyParts, components, geometryAssets],
  );
  const benchTargets = useMemo(() => {
    const columns = Math.max(1, Math.ceil(Math.sqrt(components.length)));
    const rows = Math.max(1, Math.ceil(components.length / columns));
    const maxWidth = Math.max(
      1.2,
      ...components.map(
        (component) =>
          (renderGeometries.get(component.id)?.dimensionsMm[0] ?? 70) *
          SCENE_SCALE,
      ),
    );
    const maxHeight = Math.max(
      1,
      ...components.map(
        (component) =>
          (renderGeometries.get(component.id)?.dimensionsMm[1] ?? 45) *
          SCENE_SCALE,
      ),
    );
    const cellX = Math.max(1.55, maxWidth * 1.35);
    const cellZ = Math.max(1.35, maxHeight * 1.35);
    return new Map(
      components.map((component, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return [
          component.id,
          new Vector3(
            (column - (columns - 1) / 2) * cellX,
            WORKBENCH_Y,
            (row - (rows - 1) / 2) * cellZ,
          ),
        ] as const;
      }),
    );
  }, [components, renderGeometries]);
  const assemblyTransforms = useMemo(() => {
    if (!assembly || mode === "bench") return null;
    const transforms =
      mode === "exploded"
        ? deriveExplodedTransforms(assembly, explode)
        : deriveAssembledTransforms(assembly);
    return new Map(
      Array.from(transforms, ([partId, transform]) => [
        partId,
        sceneTransformFromMatrix(transform.worldMatrix),
      ]),
    );
  }, [assembly, explode, mode]);
  const cameraFit = useMemo(() => {
    const focusedIds = warningPartIds ?? [];
    if (isolated && focusedIds.length > 1) {
      const positions = focusedIds.map((id) =>
        mode === "bench"
          ? (benchTargets.get(id) ?? new Vector3())
          : (assemblyTransforms?.get(id)?.position ?? new Vector3()),
      );
      const target = positions
        .reduce((sum, position) => sum.add(position), new Vector3())
        .multiplyScalar(1 / positions.length);
      const radius = Math.max(
        0.9,
        ...positions.map((position) => position.distanceTo(target) + 0.65),
      );
      return {
        target: [target.x, target.y, target.z] as const,
        radius,
      };
    }
    if (selected && isolated) {
      const geometry = renderGeometries.get(selected);
      const target =
        mode === "bench"
          ? benchTargets.get(selected)
          : assemblyTransforms?.get(selected)?.position;
      const radius = Math.max(
        0.5,
        Math.max(...(geometry?.dimensionsMm ?? DEFAULT_DIMENSIONS_MM)) *
          SCENE_SCALE *
          0.75,
      );
      return {
        target: [target?.x ?? 0, target?.y ?? 0, target?.z ?? 0] as const,
        radius,
      };
    }

    if (mode === "bench") {
      const positions = [...benchTargets.values()];
      const maxX = Math.max(
        1,
        ...positions.map((position) => Math.abs(position.x)),
      );
      const maxZ = Math.max(
        1,
        ...positions.map((position) => Math.abs(position.z)),
      );
      return {
        target: [0, -0.45, 0] as const,
        radius: Math.max(2.1, Math.hypot(maxX, maxZ) + 0.82),
      };
    }

    if (assembly?.assemblyBoundsMm) {
      const { minMm, maxMm } = assembly.assemblyBoundsMm;
      const center = minMm.map(
        (value, axis) => ((value + maxMm[axis]) / 2) * SCENE_SCALE,
      ) as [number, number, number];
      const diagonal = Math.hypot(
        maxMm[0] - minMm[0],
        maxMm[1] - minMm[1],
        maxMm[2] - minMm[2],
      );
      return {
        target: center as readonly [number, number, number],
        radius: Math.max(
          1.1,
          diagonal * SCENE_SCALE * 0.55 * (mode === "exploded" ? 1.38 : 1),
        ),
      };
    }

    return { target: [0, 0, 0] as const, radius: 2.6 };
  }, [
    assembly?.assemblyBoundsMm,
    assemblyTransforms,
    benchTargets,
    isolated,
    mode,
    renderGeometries,
    selected,
    warningPartIds,
  ]);
  const warningIds = useMemo(
    () => new Set(warningPartIds ?? []),
    [warningPartIds],
  );

  return (
    <div
      className="spatial-viewer"
      aria-label={
        interactive
          ? "Interactive 3D device view"
          : "Scroll-controlled 3D device reconstruction"
      }
      aria-describedby={interactive ? "keyboard-navigation-hint" : undefined}
      tabIndex={interactive ? 0 : -1}
      onPointerDown={
        interactive ? (event) => event.currentTarget.focus() : undefined
      }
      style={interactive ? undefined : { pointerEvents: "none" }}
      data-hovered={partHovered || undefined}
      data-dragging={dragging || undefined}
    >
      <Canvas
        shadows={!reducedGraphics}
        dpr={reducedGraphics ? 1 : [1, 2]}
        frameloop="demand"
        performance={{ min: 0.6 }}
        camera={{ position: [5.9, 4.8, 8.6], fov: 44 }}
        onPointerMissed={interactive ? () => onSelect("") : undefined}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.shadowMap.type = PCFSoftShadowMap;
          onReady?.();
        }}
      >
        <color attach="background" args={["#e8e5de"]} />
        <StudioLighting reducedGraphics={reducedGraphics} />

        {components.map((component, index) => {
          const assemblyPart = assemblyParts.get(component.id);
          const geometryAsset =
            assemblyPart?.geometry.kind === "asset"
              ? geometryAssets.get(assemblyPart.geometry.assetId)
              : undefined;
          return (
            <Part
              key={component.id}
              component={component}
              assemblyPart={assemblyPart}
              geometryAsset={geometryAsset}
              materialProfile={
                assemblyPart?.materialProfileId
                  ? materialProfiles.get(assemblyPart.materialProfileId)
                  : undefined
              }
              assemblyTransform={assemblyTransforms?.get(component.id)}
              reducedGraphics={reducedGraphics}
              index={index}
              count={components.length}
              explode={explode}
              mode={mode}
              arrangeKey={arrangeKey}
              benchTarget={benchTargets.get(component.id) ?? new Vector3()}
              selected={selected === component.id}
              isolated={isolated}
              warning={warningIds.has(component.id)}
              referenceDetails={assembly?.id === DEMO_ASSEMBLY_ID}
              onSelect={onSelect}
              onHoverChange={setPartHovered}
              onDragChange={setDragging}
            />
          );
        })}

        <WorkbenchSurface reducedGraphics={reducedGraphics} />

        {showGrid && (
          <Grid
            position={[0, WORKBENCH_Y + 0.002, 0]}
            args={[18, 18]}
            cellSize={0.3}
            cellThickness={0.55}
            cellColor="#9d9990"
            sectionSize={1.5}
            sectionThickness={1}
            sectionColor="#6f6b64"
            fadeDistance={14}
            fadeStrength={1.1}
          />
        )}
        {!reducedGraphics && (
          <ContactShadows
            position={[0, WORKBENCH_Y + 0.006, 0]}
            opacity={0.27}
            scale={13}
            blur={2.25}
            far={6}
            resolution={512}
          />
        )}
        <CameraControls
          fitTarget={cameraFit.target}
          fitRadius={cameraFit.radius}
          fitKey={`${mode}:${arrangeKey}:${assembly?.id ?? "project"}:${isolated ? (selected ?? "none") : "all"}`}
          resetKey={resetKey}
          viewPreset={cameraView}
          enabled={interactive && !dragging}
        />
      </Canvas>
    </div>
  );
}
