/**
 * Ascension Records: portable save codes.
 *
 * The game runs in a sandboxed frame with an opaque origin, so localStorage,
 * sessionStorage and cookies all throw SecurityError, and the runtime bridge only
 * carries the six fixed game actions. A code the player copies is therefore the only
 * way progress can outlive a reload without modifying the SDK.
 *
 * A record is bound to the Friend that earned it and refuses to load onto another.
 */

const VERSION = "ASC1";

/** FNV-1a, so a mistyped or truncated code is rejected rather than half-applied. */
function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

const toBase64Url = (input: string) =>
  btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (input: string) => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
};

export type AscensionRecord = {
  friendId: bigint;
  charge: bigint;
  committed: readonly bigint[];
  owned: readonly string[];
  worn: { eye?: string; head?: string };
};

export function encodeRecord(record: AscensionRecord): string {
  const body = [
    record.friendId.toString(),
    record.charge.toString(),
    record.committed.map(count => count.toString()).join(","),
    record.owned.join(","),
    `${record.worn.eye ?? ""},${record.worn.head ?? ""}`,
  ].join("|");
  return `${VERSION}-${toBase64Url(`${body}|${checksum(body)}`)}`;
}

export type DecodeResult =
  | { ok: true; record: AscensionRecord }
  | { ok: false; reason: string };

export function decodeRecord(input: string, friendId: bigint, outcomes: number): DecodeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Paste a record first." };
  if (!trimmed.startsWith(`${VERSION}-`)) return { ok: false, reason: "That is not an Ascension Record." };

  let decoded: string;
  try {
    decoded = fromBase64Url(trimmed.slice(VERSION.length + 1));
  } catch {
    return { ok: false, reason: "That record is damaged." };
  }

  const parts = decoded.split("|");
  if (parts.length !== 6) return { ok: false, reason: "That record is damaged." };
  const [rawFriend, rawCharge, rawCommitted, rawOwned, rawWorn, sum] = parts;
  if (checksum(parts.slice(0, 5).join("|")) !== sum) return { ok: false, reason: "That record is damaged." };

  let friend: bigint;
  let charge: bigint;
  let committed: bigint[];
  try {
    friend = BigInt(rawFriend);
    charge = BigInt(rawCharge);
    committed = rawCommitted ? rawCommitted.split(",").map(value => BigInt(value)) : [];
  } catch {
    return { ok: false, reason: "That record is damaged." };
  }

  if (friend !== friendId) return { ok: false, reason: `That record belongs to Friend #${friend.toString()}, not this one.` };
  if (committed.length !== outcomes) return { ok: false, reason: "That record is from a different version of the game." };
  if (charge < 0n || committed.some(count => count < 0n)) return { ok: false, reason: "That record is damaged." };

  const [eye, head] = rawWorn.split(",");
  return {
    ok: true,
    record: {
      friendId: friend,
      charge,
      committed,
      owned: rawOwned ? rawOwned.split(",").filter(Boolean) : [],
      worn: { eye: eye || undefined, head: head || undefined },
    },
  };
}
