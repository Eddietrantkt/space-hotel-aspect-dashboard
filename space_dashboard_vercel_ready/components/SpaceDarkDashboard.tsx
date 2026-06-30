"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SpaceDarkDashboard.module.css";

const ASPECTS = ["building", "cleanliness", "food", "location", "rooms", "service"] as const;
const METHODS = ["m1", "m2", "m3", "m4"] as const;
const SUMMARY_MODES = ["compare", "method1", "m1", "m2", "m3", "m4"] as const;
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api";

type Aspect = (typeof ASPECTS)[number];
type Method = (typeof METHODS)[number];
type SummaryMode = (typeof SUMMARY_MODES)[number];

type RougeCell = {
  rouge1: number;
  rouge2: number;
  rougeL: number;
  n?: number;
};

type AspectCell = {
  overall?: string;
  positive?: string;
  negative?: string;
};

type SpaceEntity = {
  entity_id: string;
  entity_name: string;
  split: string;
  gold: {
    overall: string[];
    aspects: Partial<Record<Aspect, string[]>>;
  };
  methods: Record<
    Method,
    {
      overall: string;
      aspects: Partial<Record<Aspect, AspectCell>>;
    }
  >;
};

type SpaceData = {
  dataset: string;
  generated_at: string;
  aspects: Aspect[];
  methods: Method[];
  rouge: Record<
    Method,
    {
      method: string;
      by_split: Record<string, Record<string, RougeCell>>;
    }
  >;
  entities: SpaceEntity[];
};

type SummaryRow = {
  methodGroup: "method1" | "method2";
  method: string;
  entityId: string;
  aspect: string;
  sentiment: string;
  summaryType: string;
  summary: string;
  evidence: string;
};

type QualitativeExample = {
  entityId: string;
  aspect: Aspect;
  sentiment: string;
  method1Summary: string;
  method2Summary: string;
  note: string;
};

type SummaryData = {
  generatedAt: string;
  source: string;
  methodLabels: Record<string, string>;
  summaries: SummaryRow[];
  qualitativeExamples: QualitativeExample[];
};

const ASPECT_LABEL: Record<Aspect, string> = {
  building: "Building",
  cleanliness: "Cleanliness",
  food: "Food",
  location: "Location",
  rooms: "Rooms",
  service: "Service",
};

const ASPECT_DESC: Record<Aspect, string> = {
  building: "building condition, lobby, grounds and shared facilities",
  cleanliness: "clean rooms, bedding, public areas and housekeeping",
  food: "restaurant, breakfast, room service and dining quality",
  location: "walkability, nearby attractions and neighborhood context",
  rooms: "room comfort, beds, bathroom, noise and in-room quality",
  service: "staff helpfulness, reception and guest support",
};

const METHOD_LABEL: Record<Method, string> = {
  m1: "M1 Extractive",
  m2: "M2 Abstractive",
  m3: "M3 Keyword split",
  m4: "M4 BERT-ABSA",
};

const SUMMARY_MODE_LABEL: Record<SummaryMode, string> = {
  compare: "Compare",
  method1: "P1",
  m1: "P2 M1",
  m2: "P2 M2",
  m3: "P2 M3",
  m4: "P2 M4",
};

function fmt(value: number | undefined, digits = 3) {
  if (value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

async function fetchDashboardJson<T>(path: string): Promise<T> {
  const urls = API_BASE ? [`${API_BASE}${path}`, path] : [path];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function shortText(value: string | undefined, max = 130) {
  if (!value?.trim()) return "No text available.";
  return value.length > max ? `${value.slice(0, max).trim()}...` : value;
}

function methodAspectText(entity: SpaceEntity, method: Method, aspect: Aspect) {
  const cell = entity.methods[method]?.aspects?.[aspect];
  if (!cell) return "";
  if (cell.overall) return cell.overall;
  return [cell.positive, cell.negative].filter(Boolean).join(" ");
}

function aspectBest(data: SpaceData, aspect: Aspect) {
  let bestMethod: Method = "m1";
  let best: RougeCell | undefined;
  for (const method of METHODS) {
    const cell = data.rouge?.[method]?.by_split?.all?.[aspect];
    if (!best || (cell?.rouge1 ?? -1) > best.rouge1) {
      best = cell;
      bestMethod = method;
    }
  }
  return { method: bestMethod, cell: best };
}

function aspectCoverage(data: SpaceData, aspect: Aspect) {
  const goldRefs = data.entities.reduce(
    (sum, entity) => sum + (entity.gold.aspects[aspect]?.length ?? 0),
    0,
  );
  const outputs = data.entities.reduce((sum, entity) => {
    return (
      sum +
      METHODS.reduce((methodSum, method) => {
        return methodSum + (methodAspectText(entity, method, aspect).trim() ? 1 : 0);
      }, 0)
    );
  }, 0);
  const positive = data.entities.reduce((sum, entity) => {
    return sum + (entity.methods.m3.aspects[aspect]?.positive?.trim() ? 1 : 0);
  }, 0);
  const positiveRate = Math.round((positive / Math.max(data.entities.length, 1)) * 100);
  return { goldRefs, outputs, positiveRate };
}

function selectEvidence(data: SpaceData, aspect: Aspect) {
  const entity =
    data.entities.find((item) => item.gold.aspects[aspect]?.[0]?.trim()) ?? data.entities[0];
  return {
    entity,
    gold: entity?.gold.aspects[aspect]?.[0] ?? "",
  };
}

function findQualitativeExample(
  summaryData: SummaryData | null,
  entityId: string | undefined,
  aspect: Aspect,
) {
  if (!summaryData || !entityId) return undefined;
  return summaryData.qualitativeExamples.find(
    (example) => example.entityId === String(entityId) && example.aspect === aspect,
  );
}

function findMethod1Summary(summaryData: SummaryData | null, entityId: string | undefined) {
  if (!summaryData || !entityId) return undefined;
  return summaryData.summaries.find(
    (row) =>
      row.methodGroup === "method1" &&
      row.entityId === String(entityId) &&
      row.aspect === "global",
  );
}

function findMethod2Summaries(
  summaryData: SummaryData | null,
  entityId: string | undefined,
  aspect: Aspect,
  method: Method,
) {
  if (!summaryData || !entityId) return [];
  const rows = summaryData.summaries.filter(
    (row) =>
      row.methodGroup === "method2" &&
      row.entityId === String(entityId) &&
      row.aspect === aspect &&
      row.method === method,
  );
  return rows.sort((a, b) => {
    const rank = (sentiment: string) => ({ pos: 0, neg: 1, "": 2 })[sentiment] ?? 3;
    return rank(a.sentiment) - rank(b.sentiment);
  });
}

function findBestMethod2Summary(
  summaryData: SummaryData | null,
  entityId: string | undefined,
  aspect: Aspect,
) {
  for (const method of ["m4", "m3", "m2", "m1"] as const) {
    const [row] = findMethod2Summaries(summaryData, entityId, aspect, method);
    if (row) return row;
  }
  return undefined;
}

function computeRows(data: SpaceData) {
  return ASPECTS.map((aspect) => {
    const best = aspectBest(data, aspect);
    const coverage = aspectCoverage(data, aspect);
    const evidence = selectEvidence(data, aspect);
    return {
      aspect,
      bestMethod: best.method,
      score: best.cell?.rouge1,
      rouge2: best.cell?.rouge2,
      rougeL: best.cell?.rougeL,
      goldRefs: coverage.goldRefs,
      outputs: coverage.outputs,
      positiveRate: coverage.positiveRate,
      sampleHotel: evidence.entity?.entity_name ?? "No sample",
      evidence: evidence.gold,
    };
  });
}

export function SpaceDarkDashboard() {
  const [data, setData] = useState<SpaceData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedAspect, setSelectedAspect] = useState<Aspect>("location");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("compare");

  useEffect(() => {
    Promise.all([
      fetchDashboardJson<SpaceData>("/data/space_4method.json"),
      fetchDashboardJson<SummaryData>("/data/space_summary_methods.json"),
    ])
      .then(([spaceJson, summaryJson]) => {
        setData(spaceJson);
        setSummaryData(summaryJson);
        setSelectedEntityId(spaceJson.entities[0]?.entity_id ?? "");
      })
      .catch((err) => setError(String(err)));
  }, []);

  const rows = useMemo(() => (data ? computeRows(data) : []), [data]);
  const filteredEntities = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.entities;
    return data.entities.filter((entity) => {
      const location = entity.gold.aspects.location?.join(" ") ?? "";
      return [entity.entity_id, entity.entity_name, entity.split, location]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, query]);

  const selectedEntity =
    data?.entities.find((entity) => entity.entity_id === selectedEntityId) ??
    filteredEntities[0] ??
    data?.entities[0];
  const selectedRow = rows.find((row) => row.aspect === selectedAspect);
  const selectedRefs = selectedEntity?.gold.aspects[selectedAspect] ?? [];
  const selectedLocation =
    selectedEntity?.gold.aspects.location?.[0] ??
    selectedEntity?.gold.overall?.[0] ??
    "Location evidence is not available for this property.";
  const qualitativeExample = findQualitativeExample(
    summaryData,
    selectedEntity?.entity_id,
    selectedAspect,
  );
  const method1Summary = findMethod1Summary(summaryData, selectedEntity?.entity_id);
  const selectedMethod2Summaries =
    summaryMode !== "compare" && summaryMode !== "method1"
      ? findMethod2Summaries(summaryData, selectedEntity?.entity_id, selectedAspect, summaryMode)
      : [];
  const bestMethod2Summary = findBestMethod2Summary(
    summaryData,
    selectedEntity?.entity_id,
    selectedAspect,
  );
  const macro = data?.rouge?.m3?.by_split?.all?.MACRO;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.logoMark} aria-hidden="true">
            domain
          </span>
          <span>HotelInsight</span>
        </div>
        <p className={styles.brandSubline}>Architectural Analytics</p>
        <nav className={styles.nav}>
          <a>Dashboard</a>
          <a className={styles.navActive}>Analytics</a>
          <a>Portfolio</a>
        </nav>
        <div className={styles.profileCard}>
          <span className={styles.profileIcon}>person</span>
          <div>
            <strong>SPACE Review Lab</strong>
            <small>Asset QA workspace</small>
          </div>
        </div>
        <div className={styles.sideNote}>
          Dashboard built from SPACE gold references, method outputs, ROUGE metrics, and
          aspect-level evidence.
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <h1>Aspect Analytics</h1>
            <span>Real-time review synthesis</span>
          </div>
          <div className={styles.searchBox}>
            <span aria-hidden="true">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Hotel ID, name, split..."
            />
          </div>
          <div className={styles.topActions}>
            <button type="button" aria-label="Notifications">
              notifications
            </button>
            <button type="button" aria-label="Settings">
              settings
            </button>
          </div>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}
        {!data ? <div className={styles.loading}>Loading SPACE data...</div> : null}

        {data ? (
          <section className={styles.contentStack}>
            <section className={styles.stitchGrid}>
              <article className={`${styles.panel} ${styles.hotelHeroCard}`}>
                <div className={styles.mapVisual}>
                  <div className={styles.mapGrid} aria-hidden="true" />
                  <div className={styles.mapBadge}>
                    <span>location_on</span>
                    <strong>Evidence Map</strong>
                  </div>
                  <div className={styles.mapCopy}>
                    <h2>{selectedEntity?.entity_name ?? "Select a property"}</h2>
                    <p>{shortText(selectedLocation, 150)}</p>
                  </div>
                </div>
                <dl className={styles.hotelFacts}>
                  <div>
                    <dt>Entity</dt>
                    <dd>{selectedEntity?.entity_id ?? "--"}</dd>
                  </div>
                  <div>
                    <dt>Split</dt>
                    <dd>{selectedEntity?.split ?? "--"}</dd>
                  </div>
                  <div>
                    <dt>References</dt>
                    <dd>{selectedRefs.length}</dd>
                  </div>
                  <div>
                    <dt>Aspect</dt>
                    <dd>{ASPECT_LABEL[selectedAspect]}</dd>
                  </div>
                </dl>
              </article>

              <article className={`${styles.panel} ${styles.summaryHeroCard}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Summary comparison</h2>
                    <p>P1 gives the broader synthesis. P2 stays closer to evidence.</p>
                  </div>
                </div>
                <div className={styles.heroSummaryStack}>
                  <div>
                    <span>Method 1</span>
                    <p>
                      {shortText(
                        qualitativeExample?.method1Summary ?? method1Summary?.summary,
                        210,
                      )}
                    </p>
                  </div>
                  <div>
                    <span>Method 2</span>
                    <p>
                      {shortText(
                        qualitativeExample?.method2Summary ?? bestMethod2Summary?.summary,
                        190,
                      )}
                    </p>
                  </div>
                </div>
              </article>

              <article className={`${styles.panel} ${styles.scoreHeroCard}`}>
                <div className={styles.scoreTopline}>
                  <span>{ASPECT_LABEL[selectedAspect]}</span>
                  <strong>{fmt(selectedRow?.score, 2)}</strong>
                </div>
                <div className={styles.bigScore}>{fmt(macro?.rouge1)}</div>
                <p>M3 macro ROUGE-1 across SPACE. Selected aspect uses the best available method score.</p>
                <div className={styles.qualityBars}>
                  <div>
                    <span>ROUGE-1</span>
                    <i style={{ width: `${Math.min((selectedRow?.score ?? 0) * 220, 100)}%` }} />
                  </div>
                  <div>
                    <span>ROUGE-2</span>
                    <i style={{ width: `${Math.min((selectedRow?.rouge2 ?? 0) * 480, 100)}%` }} />
                  </div>
                  <div>
                    <span>ROUGE-L</span>
                    <i style={{ width: `${Math.min((selectedRow?.rougeL ?? 0) * 250, 100)}%` }} />
                  </div>
                </div>
              </article>
            </section>

            <section className={`${styles.panel} ${styles.aspectsPanel}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Aspect insights</h2>
                  <p>
                    Click an aspect card to open gold references, method outputs, ROUGE metrics,
                    and SPACE evidence.
                  </p>
                </div>
              </div>
              <div className={styles.cardGrid}>
                {rows.map((row) => (
                  <button
                    key={row.aspect}
                    type="button"
                    onClick={() => setSelectedAspect(row.aspect)}
                    className={`${styles.aspectCard} ${
                      row.aspect === selectedAspect ? styles.aspectCardActive : ""
                    }`}
                  >
                    <div className={styles.cardTop}>
                      <span>{ASPECT_LABEL[row.aspect]}</span>
                      <strong>{fmt(row.score, 2)}</strong>
                    </div>
                    <h3>{ASPECT_DESC[row.aspect]}</h3>
                    <div className={styles.metricRow}>
                      <span>
                        <strong>{row.positiveRate}%</strong>
                        positive
                      </span>
                      <span>
                        <strong>{row.goldRefs}</strong>
                        evidence
                      </span>
                      <span>
                        <strong>{METHODS.length}</strong>
                        methods
                      </span>
                    </div>
                    <div className={styles.clusterBox}>
                      <span>Top metric</span>
                      {row.bestMethod.toUpperCase()} / R1 {fmt(row.score)} / R2 {fmt(row.rouge2)}
                    </div>
                    <div className={styles.strengthBox}>
                      <span>Strength</span>
                      <p>{shortText(row.evidence, 64)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.detailGrid}>
              <div className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.kicker}>Property reader</p>
                    <h2>{selectedEntity?.entity_name ?? "Select a hotel"}</h2>
                    <p>
                      {selectedEntity
                        ? `Entity ${selectedEntity.entity_id} / ${selectedEntity.split} split`
                        : "No matching hotel."}
                    </p>
                  </div>
                </div>
                <div className={styles.entityList}>
                  {filteredEntities.slice(0, 14).map((entity) => (
                    <button
                      key={entity.entity_id}
                      type="button"
                      onClick={() => setSelectedEntityId(entity.entity_id)}
                      className={
                        entity.entity_id === selectedEntity?.entity_id ? styles.entityActive : ""
                      }
                    >
                      <strong>{entity.entity_name}</strong>
                      <span>
                        {entity.split} / {entity.entity_id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <p className={styles.kicker}>{ASPECT_LABEL[selectedAspect]}</p>
                    <h2>Evidence and method output</h2>
                    <p>
                      Human references are shown first. SPACE has location evidence as summary
                      text, not normalized geography metadata.
                    </p>
                  </div>
                </div>
                {selectedEntity ? (
                  <div className={styles.evidenceStack}>
                    <div className={styles.summaryCompareBox}>
                      <div className={styles.summaryCompareHead}>
                        <div>
                          <span>Summary method</span>
                          <strong>
                            {SUMMARY_MODE_LABEL[summaryMode]} / {ASPECT_LABEL[selectedAspect]}
                          </strong>
                        </div>
                        <div className={styles.methodPicker} aria-label="Choose summary method">
                          {SUMMARY_MODES.map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setSummaryMode(mode)}
                              className={mode === summaryMode ? styles.methodActive : ""}
                            >
                              {SUMMARY_MODE_LABEL[mode]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {summaryMode === "compare" ? (
                        <div className={styles.summaryGridTwo}>
                          <div className={styles.summaryMethodCard}>
                            <span>Method 1</span>
                            <p>
                              {qualitativeExample?.method1Summary ??
                                method1Summary?.summary ??
                                "No Method 1 summary is available for this entity in the compact data package."}
                            </p>
                          </div>
                          <div className={styles.summaryMethodCard}>
                            <span>Method 2</span>
                            <p>
                              {qualitativeExample?.method2Summary ??
                                bestMethod2Summary?.summary ??
                                "No Method 2 summary is available for this entity/aspect."}
                            </p>
                            {bestMethod2Summary && !qualitativeExample ? (
                              <small>
                                {bestMethod2Summary.method.toUpperCase()}
                                {bestMethod2Summary.sentiment
                                  ? ` / ${bestMethod2Summary.sentiment}`
                                  : ""}
                              </small>
                            ) : null}
                          </div>
                          <div className={styles.summaryNote}>
                            {qualitativeExample?.note ??
                              "Compare mode uses the P1 global/cluster-style summary as context and the closest available P2 SPACE aspect summary. Matched qualitative examples show direct paired notes."}
                          </div>
                        </div>
                      ) : null}

                      {summaryMode === "method1" ? (
                        <div className={styles.summaryMethodCard}>
                          <span>Method 1 - cluster-style summary</span>
                          <p>
                            {qualitativeExample?.method1Summary ??
                              method1Summary?.summary ??
                              "No Method 1 summary is available for this entity."}
                          </p>
                          <small>
                            P1 in this package is mainly a global/cluster-style summary; the UI
                            does not force direct aspect-level comparison when the same slice is
                            missing.
                          </small>
                        </div>
                      ) : null}

                      {summaryMode !== "compare" && summaryMode !== "method1" ? (
                        <div className={styles.summaryList}>
                          {selectedMethod2Summaries.length ? (
                            selectedMethod2Summaries.map((row) => (
                              <div
                                key={`${row.method}-${row.sentiment || "overall"}`}
                                className={styles.summaryMethodCard}
                              >
                                <span>
                                  Method 2 / {row.method.toUpperCase()}
                                  {row.sentiment ? ` / ${row.sentiment}` : " / overall"}
                                </span>
                                <p>{row.summary}</p>
                                {row.evidence ? <small>Evidence: {row.evidence}</small> : null}
                              </div>
                            ))
                          ) : (
                            <div className={styles.summaryMethodCard}>
                              <span>No summary</span>
                              <p>
                                The compact data package has no {SUMMARY_MODE_LABEL[summaryMode]}{" "}
                                for {selectedEntity.entity_id} / {selectedAspect}.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className={styles.referenceBox}>
                      <span>Human gold references</span>
                      {selectedRefs.map((ref, index) => (
                        <p key={index}>
                          <strong>#{index + 1}</strong>
                          {ref}
                        </p>
                      ))}
                    </div>
                    <div className={styles.outputGrid}>
                      {METHODS.map((method) => (
                        <div key={method} className={styles.outputBox}>
                          <span>{METHOD_LABEL[method]}</span>
                          <p>{shortText(methodAspectText(selectedEntity, method, selectedAspect), 220)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </section>
        ) : null}
      </main>
    </div>
  );
}
