"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  ContactShadows,
  Edges,
  Grid,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import { Group, MathUtils, Plane, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ComponentNode } from "@/domain/evidence/schema";
import { explodedPosition } from "@/domain/reconstruction/explode";

export type SceneMode = "bench" | "exploded" | "assembled";

const WORKBENCH_Y = -1.34;
const SCENE_SCALE = 0.011;
const dragPlane = new Plane(new Vector3(0, 1, 0), -WORKBENCH_Y);

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

function benchPosition(index: number, depth: number): Vector3 {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return new Vector3(
    (column - 1) * 2.35,
    WORKBENCH_Y + depth / 2 + 0.035,
    (row - 0.5) * 2.35,
  );
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

function PartDetails({
  component,
  depth,
}: {
  component: ComponentNode;
  depth: number;
}) {
  if (component.category === "electronics") {
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

  if (component.category === "display") {
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

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetZ: number;
};

function Part({
  component,
  index,
  count,
  explode,
  mode,
  arrangeKey,
  selected,
  isolated,
  onSelect,
  onHoverChange,
  onDragChange,
}: {
  component: ComponentNode;
  index: number;
  count: number;
  explode: number;
  mode: SceneMode;
  arrangeKey: number;
  selected: boolean;
  isolated: boolean;
  onSelect: (id: string) => void;
  onHoverChange: (hovered: boolean) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const group = useRef<Group>(null);
  const transitionStartedAt = useRef(0);
  const drag = useRef<DragState | null>(null);
  const dragPoint = useRef(new Vector3());
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const [manualOffset, setManualOffset] = useState<readonly [number, number]>([
    0, 0,
  ]);
  const [width, height, sourceDepth] = component.geometry.dimensionsMm ?? [
    70, 45, 5,
  ];
  const depth = Math.max(sourceDepth * SCENE_SCALE, 0.038);
  const [physicalX, physicalY] = physicalOffsets[component.id] ?? [0, 0];
  const unknown = component.geometry.kind === "placeholder";
  const exploded = explodedPosition(index, count, explode * 1.6);
  const bench = useMemo(() => benchPosition(index, depth), [depth, index]);

  const targetPosition = useMemo(() => {
    if (mode === "bench") {
      return new Vector3(
        bench.x + manualOffset[0],
        bench.y,
        bench.z + manualOffset[1],
      );
    }
    if (mode === "assembled") {
      return new Vector3(physicalX, physicalY, index * 0.012);
    }
    return new Vector3(physicalX, physicalY, exploded[2]);
  }, [bench, exploded, index, manualOffset, mode, physicalX, physicalY]);

  const targetRotation = mode === "bench" ? -Math.PI / 2 : -0.05;
  const color = selected
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
      targetRotation,
      speed,
      delta,
    );
    current.rotation.y = MathUtils.damp(
      current.rotation.y,
      mode === "bench" ? 0 : 0.06,
      speed,
      delta,
    );
    current.rotation.z = MathUtils.damp(
      current.rotation.z,
      mode === "bench" ? 0 : 0.02,
      speed,
      delta,
    );

    const moving =
      current.position.distanceToSquared(targetPosition) > 0.000001 ||
      Math.abs(current.rotation.x - targetRotation) > 0.0005;
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
    onDragChange(true);
  }

  function movePart(event: ThreeEvent<PointerEvent>) {
    if (!drag.current || mode !== "bench") return;
    event.stopPropagation();
    const point = pointOnWorkbench(event);
    if (!point) return;

    setManualOffset([
      point.x + drag.current.offsetX - bench.x,
      point.z + drag.current.offsetZ - bench.z,
    ]);
    invalidate();
  }

  function stopDrag(event: ThreeEvent<PointerEvent>) {
    if (!drag.current) return;
    event.stopPropagation();
    const target = event.nativeEvent.target;
    if (target instanceof Element) {
      target.releasePointerCapture(drag.current.pointerId);
    }
    drag.current = null;
    onDragChange(false);
  }

  return (
    <group
      ref={group}
      position={targetPosition}
      rotation={[
        targetRotation,
        mode === "bench" ? 0 : 0.06,
        mode === "bench" ? 0 : 0.02,
      ]}
      visible={!isolated || selected}
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
      {component.category === "camera" ? (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.115, 0.15, depth, 28]} />
            <meshStandardMaterial
              color={color}
              roughness={0.2}
              metalness={0.55}
              transparent={unknown}
              opacity={unknown ? 0.68 : 1}
            />
          </mesh>
          <mesh position={[0, 0, depth / 2 + 0.004]}>
            <circleGeometry args={[0.072, 28]} />
            <meshStandardMaterial
              color="#101416"
              roughness={0.12}
              metalness={0.4}
            />
          </mesh>
        </>
      ) : (
        <RoundedBox
          args={[width * SCENE_SCALE, height * SCENE_SCALE, depth]}
          radius={Math.min(0.045, depth / 2.4)}
          smoothness={3}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={color}
            roughness={component.category === "display" ? 0.18 : 0.58}
            metalness={component.category === "structure" ? 0.62 : 0.12}
            transparent={unknown}
            opacity={unknown ? (hovered ? 0.72 : 0.58) : 1}
            wireframe={unknown && !selected}
          />
          <Edges
            scale={1.002}
            color={selected ? "#8e2f1b" : hovered ? "#b84a31" : "#7e8588"}
          />
          <PartDetails component={component} depth={depth} />
        </RoundedBox>
      )}
    </group>
  );
}

function CameraControls({
  selected,
  mode,
  resetKey,
  enabled,
}: {
  selected: string | null;
  mode: SceneMode;
  resetKey: number;
  enabled: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    controls.current?.reset();
  }, [mode, resetKey]);

  useEffect(() => {
    if (mode === "bench") {
      controls.current?.target.set(0, -0.35, 0);
    } else {
      const [x, y] = selected ? (physicalOffsets[selected] ?? [0, 0]) : [0, 0];
      controls.current?.target.set(x * 0.22, y * 0.22, 0);
    }
    controls.current?.update();
  }, [mode, selected]);

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
        if (distance > 4.2) {
          camera.position.addScaledVector(
            orbit.target.clone().sub(camera.position).normalize(),
            Math.min(zoomStep, distance - 4.2),
          );
        }
      } else if (key === "-" || key === "_") {
        const distance = camera.position.distanceTo(orbit.target);
        if (distance < 14) {
          camera.position.addScaledVector(
            camera.position.clone().sub(orbit.target).normalize(),
            Math.min(zoomStep, 14 - distance),
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
  }, [camera, enabled, invalidate]);

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
      minDistance={4.2}
      maxDistance={14}
      minPolarAngle={0.28}
      maxPolarAngle={1.48}
    />
  );
}

export function DeviceViewer({
  components,
  explode,
  mode,
  arrangeKey,
  selected,
  isolated,
  showGrid,
  reducedGraphics,
  resetKey,
  onSelect,
  onReady,
}: {
  components: ComponentNode[];
  explode: number;
  mode: SceneMode;
  arrangeKey: number;
  selected: string | null;
  isolated: boolean;
  showGrid: boolean;
  reducedGraphics: boolean;
  resetKey: number;
  onSelect: (id: string) => void;
  onReady?: () => void;
}) {
  const [partHovered, setPartHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className="spatial-viewer"
      aria-label="Interactive 3D device view"
      aria-describedby="keyboard-navigation-hint"
      tabIndex={0}
      onPointerDown={(event) => event.currentTarget.focus()}
      data-hovered={partHovered || undefined}
      data-dragging={dragging || undefined}
    >
      <Canvas
        shadows={!reducedGraphics}
        dpr={reducedGraphics ? 1 : [1, 1.5]}
        frameloop="demand"
        performance={{ min: 0.6 }}
        camera={{ position: [5.9, 4.8, 8.6], fov: 44 }}
        onPointerMissed={() => onSelect("")}
        onCreated={onReady}
      >
        <color attach="background" args={["#e8e5de"]} />
        <hemisphereLight args={["#fffdf5", "#8a877f", 1.8]} />
        <directionalLight
          castShadow={!reducedGraphics}
          position={[4, 7, 5]}
          color="#fffaf0"
          intensity={2.4}
          shadow-mapSize={reducedGraphics ? [256, 256] : [1024, 1024]}
        />
        <directionalLight
          position={[-4, 2, 3]}
          color="#b6c4c7"
          intensity={0.75}
        />

        {components.map((component, index) => (
          <Part
            key={component.id}
            component={component}
            index={index}
            count={components.length}
            explode={explode}
            mode={mode}
            arrangeKey={arrangeKey}
            selected={selected === component.id}
            isolated={isolated}
            onSelect={onSelect}
            onHoverChange={setPartHovered}
            onDragChange={setDragging}
          />
        ))}

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
          selected={selected}
          mode={mode}
          resetKey={resetKey}
          enabled={!dragging}
        />
      </Canvas>
    </div>
  );
}
