#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import occtImport from "occt-import-js";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error(
    "Usage: node scripts/convert-step-to-glb.mjs input.step output.glb",
  );
  process.exit(1);
}

function pad4(length) {
  return (length + 3) & ~3;
}

function numericBounds(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < values.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], values[index + axis]);
      max[axis] = Math.max(max[axis], values[index + axis]);
    }
  }
  return { min, max };
}

function addChunk(chunks, value) {
  const source = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  const padded = Buffer.alloc(pad4(source.length));
  source.copy(padded);
  const byteOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  chunks.push(padded);
  return { byteOffset, byteLength: source.length };
}

async function main() {
  const occt = await occtImport();
  const result = occt.ReadStepFile(fs.readFileSync(inputPath), {
    linearUnit: "millimeter",
    linearDeflectionType: "absolute_value",
    linearDeflection: 0.35,
    angularDeflection: 0.5,
  });
  if (!result.success || !Array.isArray(result.meshes)) {
    throw new Error(`OpenCascade could not triangulate ${inputPath}`);
  }

  const sourceBounds = result.meshes.reduce(
    (bounds, mesh) => {
      const current = numericBounds(mesh.attributes.position.array);
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis] = Math.min(bounds.min[axis], current.min[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], current.max[axis]);
      }
      return bounds;
    },
    {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    },
  );
  const center = sourceBounds.min.map(
    (minimum, axis) => (minimum + sourceBounds.max[axis]) / 2,
  );
  const sourceDimensions = sourceBounds.max.map(
    (maximum, axis) => maximum - sourceBounds.min[axis],
  );
  const axisOrder = [0, 1, 2].sort(
    (left, right) => sourceDimensions[right] - sourceDimensions[left],
  );

  function standardizedTriples(values, subtractCenter) {
    const standardized = new Float32Array(values.length);
    for (let index = 0; index < values.length; index += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        const sourceAxis = axisOrder[axis];
        standardized[index + axis] =
          values[index + sourceAxis] -
          (subtractCenter ? center[sourceAxis] : 0);
      }
    }
    return standardized;
  }

  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const meshes = [];
  const nodes = [];

  function addAccessor(value, target, componentType, type, bounds) {
    const chunk = addChunk(chunks, value);
    const bufferView = bufferViews.length;
    bufferViews.push({ buffer: 0, ...chunk, target });
    const accessor = accessors.length;
    accessors.push({
      bufferView,
      componentType,
      count: value.length / (type === "VEC3" ? 3 : 1),
      type,
      ...(bounds ? bounds : {}),
    });
    return accessor;
  }

  for (const [meshIndex, source] of result.meshes.entries()) {
    const positions = standardizedTriples(
      source.attributes.position.array,
      true,
    );
    const positionBounds = numericBounds(positions);
    const positionAccessor = addAccessor(
      positions,
      34962,
      5126,
      "VEC3",
      positionBounds,
    );
    const attributes = { POSITION: positionAccessor };
    if (source.attributes.normal?.array) {
      attributes.NORMAL = addAccessor(
        standardizedTriples(source.attributes.normal.array, false),
        34962,
        5126,
        "VEC3",
      );
    }

    const sourceIndices = source.index.array;
    let maxIndex = 0;
    for (const index of sourceIndices) maxIndex = Math.max(maxIndex, index);
    const indexValues =
      maxIndex <= 65_535
        ? Uint16Array.from(sourceIndices)
        : Uint32Array.from(sourceIndices);
    const indexAccessor = addAccessor(
      indexValues,
      34963,
      maxIndex <= 65_535 ? 5123 : 5125,
      "SCALAR",
    );
    const color = source.color ?? [0.48, 0.51, 0.52];
    const material = materials.length;
    materials.push({
      name: `${source.name || `part-${meshIndex}`} material`,
      pbrMetallicRoughness: {
        baseColorFactor: [color[0], color[1], color[2], 1],
        metallicFactor: 0.35,
        roughnessFactor: 0.48,
      },
      doubleSided: true,
    });
    const mesh = meshes.length;
    meshes.push({
      name: source.name || `STEP part ${meshIndex + 1}`,
      primitives: [{ attributes, indices: indexAccessor, material, mode: 4 }],
    });
    nodes.push({ name: source.name || `STEP part ${meshIndex + 1}`, mesh });
  }

  const binary = Buffer.concat(chunks);
  const document = {
    asset: { version: "2.0", generator: "EIDA OpenCascade STEP converter" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
  };
  const jsonSource = Buffer.from(JSON.stringify(document));
  const json = Buffer.alloc(pad4(jsonSource.length), 0x20);
  jsonSource.copy(json);
  const totalLength = 12 + 8 + json.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    Buffer.concat([header, jsonHeader, json, binaryHeader, binary]),
  );
  const dimensions = axisOrder.map((axis) => sourceDimensions[axis]);
  console.log(
    JSON.stringify(
      {
        input: inputPath,
        output: outputPath,
        meshCount: meshes.length,
        dimensionsMm: dimensions,
        byteSize: fs.statSync(outputPath).size,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
