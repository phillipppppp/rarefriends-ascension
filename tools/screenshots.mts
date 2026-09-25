// Captures the README images from the real runtime, so they can never drift from the game.
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const OUT = "C:/dev/ascension/docs";
const VIEW = { x: 320, y: 330, width: 960, height: 640 };

await testGame("./games/ascension", {
  width: 960, height: 640, timeout: 60_000,
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
    const shot = async (name: string) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log("captured", name);
    };

    // The Core, at Dormant, so the rank gates are visible rather than "fully ascended".
    await walkTo(330, 290);
    await (await arriveAt(/^Enter The Core$/)).click();
    await shot("core");
    await game.getByRole("button", { name: /^Close The Core/ }).click();

    // The Outfitter, at Dormant, so the rank locks on the better wearables show.
    await walkTo(140, 100);
    await (await arriveAt(/^Enter Outfitter$/)).click();
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
