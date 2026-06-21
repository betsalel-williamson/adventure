import featureFlagConfig from "../langgraph-feature-flags.json";

export type V3FeatureFlagName =
  | "explorationMap"
  | "assistPanels"
  | "mapProbe"
  | "mapInspectors"
  | "locationAgent";

export type V3FeatureFlags = Readonly<Record<V3FeatureFlagName, boolean>>;

const FLAG_NAMES = Object.keys(
  featureFlagConfig.defaults,
) as V3FeatureFlagName[];

const STORAGE_PREFIX = featureFlagConfig.storagePrefix;

const BUILD_DEFAULTS: V3FeatureFlags = featureFlagConfig.defaults;

const ENV_KEYS = featureFlagConfig.envKeys as Readonly<
  Record<V3FeatureFlagName, string>
>;

const parseTruthy = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const readBuildDefault = (name: V3FeatureFlagName): boolean => {
  const envKey = ENV_KEYS[name];
  const raw = import.meta.env[envKey] as string | undefined;
  return parseTruthy(raw, BUILD_DEFAULTS[name]);
};

const readQueryOverride = (name: V3FeatureFlagName): boolean | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  if (value === null) {
    return undefined;
  }
  return parseTruthy(value, false);
};

const readSessionOverride = (name: V3FeatureFlagName): boolean | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${name}`);
    if (stored === null) {
      return undefined;
    }
    return parseTruthy(stored, false);
  } catch {
    return undefined;
  }
};

const resolveFlag = (name: V3FeatureFlagName): boolean => {
  const fromQuery = readQueryOverride(name);
  if (fromQuery !== undefined) {
    return fromQuery;
  }
  const fromSession = readSessionOverride(name);
  if (fromSession !== undefined) {
    return fromSession;
  }
  return readBuildDefault(name);
};

/** Resolved once at module load — query string and sessionStorage overrides win over config/env. */
export const v3FeatureFlags: V3FeatureFlags = Object.freeze(
  Object.fromEntries(FLAG_NAMES.map((name) => [name, resolveFlag(name)])) as [
    V3FeatureFlagName,
    boolean,
  ][],
);

export const isV3FeatureEnabled = (name: V3FeatureFlagName): boolean =>
  v3FeatureFlags[name];
