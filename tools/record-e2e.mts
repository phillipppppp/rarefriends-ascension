// End-to-end: drives the real sandboxed runtime and proves an Ascension Record
// restores rank onto the Friend that earned it, and is refused by any other.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
import { encodeRecord } from "../games/ascension/record.ts";

const RF = 10n ** 18n;
// 16 commits, 3 Optics, 2 Reactors, 11 RF charge: every Ascendant gate satisfied.
const ascendant = encodeRecord({
  friendId: 7730n,
  charge: 11n * RF,
  committed: [0n, 2n, 3n, 4n, 3n, 4n],
  owned: ["shades", "halo"],
  worn: { eye: "shades", head: "halo" },
});
const otherFriend = encodeRecord({
  friendId: 1234n,
  charge: 11n * RF,
  committed: [0n, 2n, 3n, 4n, 3n, 4n],
  owned: [],
  worn: {},
});

await testGame("./games/ascension", {
  screenshot: "./artifacts/record-e2e.png",
  check: async ({ game }) => {
    await game.getByRole("button", { name: /^Settings$/ }).click();

    const current = game.locator("#asc-current-record");
    await current.waitFor();
    const baseline = await current.inputValue();
    assert.ok(baseline.startsWith("ASC1-"), `record should be an ASC1 code, got: ${baseline.slice(0, 20)}`);
    console.log("PASS  a record is generated       :", baseline.slice(0, 28) + "…");

    // A record from a different Friend must be refused.
    await game.locator("#asc-restore-record").fill(otherFriend);
    await game.getByRole("button", { name: /^Restore$/ }).click();
    await game.getByText(/belongs to Friend #1234/).waitFor();
    console.log("PASS  refuses another Friend's record");

    // Corruption must be refused.
    await game.locator("#asc-restore-record").fill(ascendant.slice(0, -5) + "ZZZZZ");
    await game.getByRole("button", { name: /^Restore$/ }).click();
    await game.getByText(/damaged/).waitFor();
    console.log("PASS  refuses a damaged record");

    // The Friend's own record must restore rank.
    await game.locator("#asc-restore-record").fill(ascendant);
    await game.getByRole("button", { name: /^Restore$/ }).click();
    await game.getByText(/Record restored/).waitFor();
    await game.locator(".asc-tier", { hasText: /Ascendant/i }).waitFor();
    console.log("PASS  restores rank to Ascendant");

    // And the restored state must re-encode to the same record.
    const after = await current.inputValue();
    assert.equal(after, ascendant, "re-encoded record should match what was restored");
    console.log("PASS  round trips through the UI");
  },
});
console.log("\nrecord system verified end to end");
