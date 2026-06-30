import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ALLOWED_DATA_FILES = new Set([
  "hotel_aspect_summary.json",
  "index.json",
  "rouge_hasos.json",
  "rouge_space.json",
  "space_4method.json",
  "space_method_demo.json",
  "space_summary_methods.json",
  "sweep.json",
]);

export type SpaceEntityIndex = {
  entity_id: string;
  entity_name: string;
  split: string;
};

function dataDir() {
  return path.join(process.cwd(), "public", "data");
}

export async function listDataFiles() {
  const files = await readdir(dataDir());
  return files.filter((file) => ALLOWED_DATA_FILES.has(file)).sort();
}

export async function loadDataFile<T = unknown>(filename: string): Promise<T> {
  if (!ALLOWED_DATA_FILES.has(filename)) {
    throw new Error(`Unknown data file: ${filename}`);
  }
  const raw = await readFile(path.join(dataDir(), filename), "utf8");
  return JSON.parse(raw) as T;
}

export async function loadSpaceData() {
  return loadDataFile<Record<string, any>>("space_4method.json");
}

export async function loadSummaryMethods() {
  return loadDataFile<Record<string, any>>("space_summary_methods.json");
}

export async function findEntity(entityId: string) {
  const data = await loadSpaceData();
  const entities = Array.isArray(data.entities) ? data.entities : [];
  return entities.find((entity) => String(entity.entity_id) === entityId);
}

export async function searchEntities(query: string, limit: number): Promise<SpaceEntityIndex[]> {
  const data = await loadSpaceData();
  const normalized = query.trim().toLowerCase();
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const matches: SpaceEntityIndex[] = [];

  for (const entity of entities) {
    const location = (entity.gold?.aspects?.location ?? []).join(" ");
    const haystack = [
      entity.entity_id,
      entity.entity_name,
      entity.split,
      location,
    ]
      .join(" ")
      .toLowerCase();

    if (!normalized || haystack.includes(normalized)) {
      matches.push({
        entity_id: String(entity.entity_id ?? ""),
        entity_name: String(entity.entity_name ?? ""),
        split: String(entity.split ?? ""),
      });
    }

    if (matches.length >= limit) break;
  }

  return matches;
}

