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
  Color,
  DoubleSide,
  Euler,
  FrontSide,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  Plane,
  Quaternion,
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
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.00008}
      />
      <directionalLight
        position={[-4, 2, 3]}
        color="#b8d1db"
        intensity={0.65}
      />
      <Environment
        background={false}
        frames={1}
        resolution={256}
        environmentIntensity={0.78}
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
}: {
  component: ComponentNode;
  depth: number;
}) {
  // Decorative details belong only to the explicitly synthetic fixture. Live
  // evidence-derived components stay primitive and never gain imagined internals.
  if (component.id === "board") {
    return (
      <group position={[0, 0, depth / 2 + 0.018]}>
        <mesh position={[-0.18, 0.09, 0]}>
          <boxGeometry args={[0.22, 0.18, 0.025]} />
          <meshStandardMaterial color="#172328" roughness={0.55} />
        </mesh>
        <mesh position={[0.2, -0.12, 0]}>
          <boxGeometry args={[0.15, 0.12, 0.02]} />
          <meshStandardMaterial
            color="#9caeb1"
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0.29, 0.16, 0]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshStandardMaterial color="#c8a85c" metalness={0.55} />
        </mesh>
      </group>
    );
  }

  if (component.id === "screen") {
    return (
      <mesh position={[0, 0, depth / 2 + 0.012]}>
        <planeGeometry args={[2.48, 1.67]} />
        <meshPhysicalMaterial
          color="#304751"
          metalness={0.12}
          roughness={0.14}
          clearcoat={0.8}
          clearcoatRoughness={0.18}
        />
      </mesh>
    );
  }

  return null;
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

  useEffect(
    () => () => {
      if (controls) controls.enabled = true;
    },
    [controls],
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
    event.stopPropagation();
    onSelect(component.id);
    if (mode !== "bench") return;

    const point = pointOnWorkbench(event);
    const current = group.current;
    if (!point || !current) return;

    drag.current = {
      pointerId: event.pointerId,
      offsetX: current.position.x - point.x,
      offsetZ: current.position.z - point.z,
    };
    const target = event.nativeEvent.target;
    if (target instanceof Element) target.setPointerCapture(event.pointerId);
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
    if (!drag.current) return;
    event.stopPropagation();
    const target = event.nativeEvent.target;
    if (
      target instanceof Element &&
      target.hasPointerCapture(drag.current.pointerId)
    ) {
      target.releasePointerCapture(drag.current.pointerId);
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
              smoothness={3}
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
                28,
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
          smoothness={3}
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
          <PartDetails component={component} depth={depth} />
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
  enabled,
}: {
  fitTarget: readonly [number, number, number];
  fitRadius: number;
  fitKey: string;
  resetKey: number;
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
    const direction = new Vector3(1, 0.78, 1.18).normalize();
    orbit.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.near = Math.max(0.01, distance / 200);
    camera.far = Math.max(100, distance * 30);
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [camera, fitKey, fitRadius, fitTarget, invalidate, resetKey]);

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
        radius: Math.max(2.1, Math.hypot(maxX, maxZ) + 1.15),
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
          diagonal * SCENE_SCALE * 0.55 * (mode === "exploded" ? 1.6 : 1),
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
        dpr={reducedGraphics ? 1 : [1, 1.5]}
        frameloop="demand"
        performance={{ min: 0.6 }}
        camera={{ position: [5.9, 4.8, 8.6], fov: 44 }}
        onPointerMissed={interactive ? () => onSelect("") : undefined}
        onCreated={onReady}
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
            opacity={0.2}
            scale={13}
            blur={1.8}
            far={6}
          />
        )}
        <CameraControls
          fitTarget={cameraFit.target}
          fitRadius={cameraFit.radius}
          fitKey={`${mode}:${arrangeKey}:${assembly?.id ?? "project"}:${isolated ? (selected ?? "none") : "all"}`}
          resetKey={resetKey}
          enabled={interactive && !dragging}
        />
      </Canvas>
    </div>
  );
}
