/**
 * Cross-tab coordination for the subsystem WAL store MVP (ADR0006):
 * workspace tab holds the write-capable DB; dashboard consumes snapshots via messages.
 */

export const SUBSYSTEM_WAL_BROADCAST_CHANNEL =
  "adventure-nl:subsystem-wal" as const;

export type SubsystemWalBroadcastMessage =
  | { readonly type: "head_revision"; readonly revisionId: number }
  | { readonly type: "promote"; readonly revisionId: number };
