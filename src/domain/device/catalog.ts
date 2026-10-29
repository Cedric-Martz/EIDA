export type DeviceCatalogEntry = {
  id: string;
  manufacturer: string;
  model: string;
  category: string;
};

// A deliberately small local starter catalog. It improves data entry without
// presenting the suggestions as evidence or requiring a network request.
export const DEVICE_CATALOG: readonly DeviceCatalogEntry[] = [
  {
    id: "samsung-galaxy-tab-4-sm-t530",
    manufacturer: "Samsung",
    model: "Galaxy Tab 4 10.1 SM-T530",
    category: "Tablet",
  },
  {
    id: "samsung-galaxy-a32-sm-a326b",
    manufacturer: "Samsung",
    model: "Galaxy A32 5G SM-A326B/DS",
    category: "Phone",
  },
  {
    id: "apple-iphone-15",
    manufacturer: "Apple",
    model: "iPhone 15",
    category: "Phone",
  },
  {
    id: "apple-iphone-14",
    manufacturer: "Apple",
    model: "iPhone 14",
    category: "Phone",
  },
  {
    id: "apple-ipad-10",
    manufacturer: "Apple",
    model: "iPad (10th generation)",
    category: "Tablet",
  },
  {
    id: "apple-macbook-air-m2-2022",
    manufacturer: "Apple",
    model: "MacBook Air (M2, 2022)",
    category: "Laptop",
  },
  {
    id: "google-pixel-8",
    manufacturer: "Google",
    model: "Pixel 8",
    category: "Phone",
  },
  {
    id: "fairphone-5",
    manufacturer: "Fairphone",
    model: "Fairphone 5",
    category: "Phone",
  },
  {
    id: "framework-laptop-13",
    manufacturer: "Framework",
    model: "Laptop 13",
    category: "Laptop",
  },
  {
    id: "dell-xps-13",
    manufacturer: "Dell",
    model: "XPS 13",
    category: "Laptop",
  },
  {
    id: "lenovo-thinkpad-t14",
    manufacturer: "Lenovo",
    model: "ThinkPad T14",
    category: "Laptop",
  },
  {
    id: "nintendo-switch-oled",
    manufacturer: "Nintendo",
    model: "Switch OLED",
    category: "Game console",
  },
  {
    id: "sony-playstation-5",
    manufacturer: "Sony",
    model: "PlayStation 5",
    category: "Game console",
  },
  {
    id: "microsoft-xbox-series-x",
    manufacturer: "Microsoft",
    model: "Xbox Series X",
    category: "Game console",
  },
  {
    id: "valve-steam-deck-oled",
    manufacturer: "Valve",
    model: "Steam Deck OLED",
    category: "Handheld computer",
  },
  {
    id: "raspberry-pi-5",
    manufacturer: "Raspberry Pi",
    model: "Raspberry Pi 5",
    category: "Single-board computer",
  },
];

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchDeviceCatalog(query: string, limit = 6) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return DEVICE_CATALOG.slice(0, limit);
  const tokens = normalizedQuery.split(" ");

  return DEVICE_CATALOG.map((entry, index) => {
    const manufacturer = normalize(entry.manufacturer);
    const model = normalize(entry.model);
    const category = normalize(entry.category);
    const label = `${manufacturer} ${model}`;
    if (!tokens.every((token) => `${label} ${category}`.includes(token))) {
      return null;
    }

    let score = index / 1000;
    if (label === normalizedQuery) score -= 100;
    if (model === normalizedQuery) score -= 80;
    if (label.startsWith(normalizedQuery)) score -= 50;
    if (model.startsWith(normalizedQuery)) score -= 40;
    if (manufacturer.startsWith(normalizedQuery)) score -= 20;
    return { entry, score };
  })
    .filter(
      (result): result is { entry: DeviceCatalogEntry; score: number } =>
        result !== null,
    )
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((result) => result.entry);
}
