export const META_MODELS = {
  inventory: "muse-spark-1.3",
  inventoryContributor: "muse-spark-1.3-contributor",
  segmentation: "sam-3.1",
} as const;

export const META_MODEL_LABELS = {
  inventory: "Muse Spark 1.3",
  segmentation: "SAM 3.1",
} as const;

export const MIN_USER_PHOTOS = 3;
export const MAX_USER_PHOTOS = 16;
export const MAX_SOURCE_IMAGES = 32;
export const MAX_VISUAL_INPUTS = 48;
export const MAX_INVENTORY_PARTS = 24;
export const MAX_GEOMETRY_VISUALS = 32;

export const ALLOWED_INVENTORY_MODELS = new Set<string>([
  META_MODELS.inventory,
  META_MODELS.inventoryContributor,
]);
