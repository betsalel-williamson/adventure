export function defaultPorts(): {
  fetch: typeof fetch;
  EventSource: typeof EventSource;
  localStorage: Storage;
  location: Location;
  requestAnimationFrame: typeof requestAnimationFrame;
};

export function resolveDashboardElements(
  doc: Document,
): Record<string, HTMLElement | null>;
