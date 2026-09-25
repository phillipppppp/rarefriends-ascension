// Forces specific outcomes by re-stubbing the preview roll, so every branch of the
// reward screen is checked rather than whichever component happened to drop.
// Bands for this game.json: Slag 0-1499, Plating 1500-3999, Coil 4000-6499,
// Servo 6500-8499, Optic 8500-9499, Reactor 9500-9999.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const VIEW = { x: 320, y: 330, width: 960, height: 640 };

await testGame("./games/ascension", {
  timeout: 40_000,
  check: async ({ page, game }) => {
      // How to Play opens on load, so every suite dismisses it before touching the world.
      const helpGotIt = game.getByRole("button", { name: /^Got it$/ });
      if (await helpGotIt.count() > 0) {
        await helpGotIt.click();
        await helpGotIt.waitFor({ state: "detached", timeout: 8000 });
      }
    const canvas = game.locator("canvas");
    const box = (await canvas.boundingBox())!;
    const walkTo = async (x: number, y: number) => {
      const [px, py] = project(x, y);
      await canvas.click({ position: {
        x: ((px - VIEW.x) / VIEW.width) * box.width,
        y: ((py - VIEW.y) / VIEW.height) * box.height,
      } });
    };
    /** Stations are entered from the HUD once the Friend walks into range. */
    const arriveAt = async (label: RegExp) => {
      const enter = game.getByRole("button", { name: label });
      await enter.waitFor({ timeout: 20_000 });
      return enter;
    };
    const approve = async () => {
      const confirm = page.getByRole("button", { name: "Confirm preview" });
      await confirm.waitFor({ timeout: 10_000 });
      await confirm.click();
    };
    /** The preview ledger lives in the host page, so the roll is stubbed there. */
    const forceRoll = (value: number) =>
      page.evaluate((v) => {
        crypto.getRandomValues = (array: any) =>
          array instanceof Uint32Array && array.length === 1 ? ((array[0] = v), array) : array;
      }, value);

    await walkTo(203, 152);
    await (await arriveAt(/^Enter Fabricator$/)).click();
    for (let i = 0; i < 2; i += 1) {
      await game.getByRole("button", { name: /^Buy one cell/ }).click();
      await approve();
      await page.waitForTimeout(300);
    }
    await game.getByRole("button", { name: "Close Fabricator" }).click();
    await walkTo(470, 160);
    const assembler = await arriveAt(/^Enter Assembler$/);

    for (const [roll, expected] of [[500, "Slag"], [9900, "Reactor"]] as const) {
      await forceRoll(roll);
      await assembler.click();
      await game.getByRole("button", { name: /^Fabricate one component$/ }).click();
      await approve();
      await game.getByText("Fabrication complete", { exact: true }).waitFor();

      const name = await game.locator(".asc-reward h3").innerText();
      assert.equal(name, expected, `roll ${roll} should produce ${expected}`);
      const fork = await game.locator(".asc-fork").innerText();
      const last = await game.locator(".asc-reward button").last().innerText();

      if (expected === "Slag") {
        assert.match(fork, /A miss/);
        assert.equal(last, "Back to the station");
        assert.equal(await game.getByRole("button", { name: /^Redeem/ }).count(), 0, "Slag must not offer Redeem");
        assert.equal(await game.getByRole("button", { name: /^Commit to the Core$/ }).count(), 0, "Slag must not offer Commit");
      } else {
        assert.match(fork, /Redeem it, commit it/);
        assert.equal(last, "Keep as salvage");
        assert.equal(await game.getByRole("button", { name: /^Commit to the Core$/ }).count(), 1);
      }
      console.log(`PASS  roll ${roll} -> ${name}: choices correct`);
      await game.getByRole("button", { name: "Close Fabrication complete" }).click();
    }
  },
});
console.log("\nboth the miss and the jackpot branches verified");
