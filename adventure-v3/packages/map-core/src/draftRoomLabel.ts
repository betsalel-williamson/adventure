/** Short label for CRT room line — drops leading YOU ARE when present. */
export const shortRoomLabel = (evidence: string, maxLen = 44): string => {
  const t = evidence.replace(/^\s*YOU ARE\s+/i, "").trim();
  const u = t.length > maxLen ? `${t.slice(0, Math.max(0, maxLen - 1))}…` : t;
  return u || "(room)";
};
