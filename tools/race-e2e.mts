// React batches state updates, so any guard that reads render state can be raced by a
// burst of clicks. These two paths spend a scarce resource, so both are checked here.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const VIEW = { x: 320, y: 330, width: 960, height: 640 };

await testGame("./games/ascension", {
  timeout: 60_000,
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
      const c = page.getByRole("button", { name: "Confirm preview" });
      await c.waitFor({ timeout: 10_000 });
      await c.click();
    };
    const forceRoll = (v: number) => page.evaluate((value) => {
      crypto.getRandomValues = (a: any) =>
        a instanceof Uint32Array && a.length === 1 ? ((a[0] = value), a) : a;
    }, v);
    const spam = (locator: any) =>
      locator.evaluate((b: HTMLButtonElement) => { for (let i = 0; i < 5; i += 1) b.click(); });

    // Two cells: one Coil for the commit race, one Optic for the shop race.
    await walkTo(203, 152);
    await (await arriveAt(/^Enter Fabricator$/)).click();
    for (let i = 0; i < 2; i += 1) {
      await game.getByRole("button", { name: /^Buy one cell/ }).click();
      await approve();
      await page.waitForTimeout(250);
    }
    await game.getByRole("button", { name: "Close Fabricator" }).click();

    await walkTo(470, 160);
    const assembler = await arriveAt(/^Enter Assembler$/);
    for (const roll of [5000, 9000]) {           // Coil, then Optic
      await forceRoll(roll);
      await assembler.click();
      await game.getByRole("button", { name: /^Fabricate one component$/ }).click();
      await approve();
      await game.getByText("Fabrication complete", { exact: true }).waitFor();
      await game.getByRole("button", { name: /^Keep as salvage$/ }).click();
    }

    // --- commit race ---
    await walkTo(330, 290);
    await (await arriveAt(/^Enter The Core$/)).click();
    const coil = game.locator(".asc-item", { hasText: "Coil" }).first();
    await spam(coil.getByRole("button", { name: /^Commit one$/ }));
    await page.waitForTimeout(600);
    const coilText = (await coil.innerText()).replace(/\s+/g, " ");
    assert.match(coilText, /1 committed/, `5 clicks on 1 held Coil must commit 1, got: ${coilText}`);
    assert.match(coilText, /0 held/);
    console.log("PASS  commit cannot be raced:", coilText);
    await game.getByRole("button", { name: /^Close The Core/ }).click();

    // --- shop race --- one Optic (2.5 RF) is enough for Shades (2 RF) exactly once.
    await walkTo(140, 100);
    await (await arriveAt(/^Enter Outfitter$/)).click();
    const shades = game.locator(".asc-item", { hasText: "Shades" }).first();
    await spam(shades.getByRole("button", { name: /^Buy$/ }));
    await page.waitForTimeout(600);
    const shadesText = (await shades.innerText()).replace(/\s+/g, " ");
    assert.match(shadesText, /Take off|Wear/, "Shades should be owned after buying");
    const salvageLeft = await game.locator(".asc-hud button", { hasText: "Salvage" }).innerText();
    console.log("PASS  purchase cannot be raced:", shadesText.slice(0, 40), "|", salvageLeft);
    assert.match(salvageLeft, /Salvage · 0 RF/, `one Optic should have been spent exactly once, got ${salvageLeft}`);
  },
});
console.log("\nboth spend paths are race-safe");
