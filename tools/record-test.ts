import { encodeRecord, decodeRecord } from "../games/ascension/record.ts";

const OUTCOMES = 6;
const base = {
  friendId: 7730n,
  charge: 8_250_000_000_000_000_000n,
  committed: [0n, 3n, 5n, 2n, 1n, 1n] as readonly bigint[],
  owned: ["shades", "halo"] as readonly string[],
  worn: { eye: "shades", head: "halo" },
};

let failures = 0;
const check = (label: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? " -> " + detail : ""}`);
  if (!pass) failures += 1;
};

const code = encodeRecord(base);
console.log("code:", code, `(${code.length} chars)\n`);

const round = decodeRecord(code, 7730n, OUTCOMES);
check("round trips", round.ok && round.record.charge === base.charge
  && round.record.committed.join() === base.committed.join()
  && round.record.owned.join() === base.owned.join()
  && round.record.worn.eye === "shades" && round.record.worn.head === "halo");

const wrongFriend = decodeRecord(code, 9999n, OUTCOMES);
check("rejects another Friend", !wrongFriend.ok, !wrongFriend.ok ? wrongFriend.reason : "");

const corrupted = code.slice(0, -4) + "AAAA";
const bad = decodeRecord(corrupted, 7730n, OUTCOMES);
check("rejects corruption", !bad.ok, !bad.ok ? bad.reason : "");

check("rejects empty", !decodeRecord("   ", 7730n, OUTCOMES).ok);
check("rejects junk", !decodeRecord("hello world", 7730n, OUTCOMES).ok);
check("rejects wrong outcome count", !decodeRecord(code, 7730n, 8).ok);

const bare = encodeRecord({ friendId: 1n, charge: 0n, committed: [0n,0n,0n,0n,0n,0n], owned: [], worn: {} });
const bareBack = decodeRecord(bare, 1n, OUTCOMES);
check("handles empty progress", bareBack.ok && bareBack.record.owned.length === 0
  && bareBack.record.worn.eye === undefined);

console.log(failures ? `\n${failures} FAILED` : "\nall good");
process.exit(failures ? 1 : 0);
