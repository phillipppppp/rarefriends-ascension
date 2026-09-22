// Captures the README images from the real runtime, so they can never drift from the game.
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const OUT = "C:/dev/ascension/docs";
const VIEW = { x: 320, y: 330, width: 960, height: 640 };

await testGame("./games/ascension", {
  width: 960, height: 640, timeout: 60_000,
  check: async ({ page, game }) => {
    const canvas = game.locator("canvas");
    const box = (await canvas.boundingBox())!;
    const walkTo = async (x: number, y: number) => {
      const [px, py] = project(x, y);
      await canvas.click({ position: {
        x: ((px - VIEW.x) / VIEW.width) * box.width,
        y: ((py - VIEW.y) / VIEW.height) * box.height,
      } });
    };
    const arriveAt = async (label: RegExp) => {
      const p = game.getByRole("button", { name: label });
      for (let i = 0; i < 30 && !(await p.isEnabled()); i += 1) await page.waitForTimeout(350);
      return p;
    };
    const shot = async (name: string) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log("captured", name);
    };

    // The Core, at Dormant, so the rank gates are visible rather than "fully ascended".
    await walkTo(330, 290);
    await (await arriveAt(/^The Core/)).click();
    await shot("core");
    await game.getByRole("button", { name: /^Close The Core/ }).click();

    // The Outfitter, at Dormant, so the rank locks on the better wearables show.
    await walkTo(140, 100);
    await (await arriveAt(/^Outfitter/)).click();
    await shot("outfitter");
    await game.getByRole("button", { name: /^Close Outfitter/ }).click();

    // Hero last: a fully ascended Friend out on the station.
    await game.getByRole("button", { name: /^Settings$/ }).click();
    await game.getByRole("button", { name: /^Show me Ascendant$/ }).click();
    await game.getByRole("button", { name: "Close Settings" }).click();
    await walkTo(300, 255);
    await page.waitForTimeout(1400);
    await shot("hero");
  },
});
console.log("\nscreenshots written to docs/");
