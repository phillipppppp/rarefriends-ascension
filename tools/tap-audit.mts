// On a phone, tapping is the only way to move, so nothing may cover the play area.
// Stations are entered from the HUD rather than a floating prompt; this proves the whole
// canvas stays tappable and that both the HUD action and the E shortcut still work.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const VIEW = { x: 320, y: 330, width: 960, height: 640 };

for (const [label, width, height] of [["phone", 390, 760], ["desktop", 960, 800]] as const) {
  await testGame("./games/ascension", {
    width, height, timeout: 45_000,
    check: async ({ page, game }) => {
      // How to Play opens on load, so every suite dismisses it before touching the world.
      const helpGotIt = game.getByRole("button", { name: /^Got it$/ });
      if (await helpGotIt.count() > 0) {
        await helpGotIt.click();
        await helpGotIt.waitFor({ state: "detached", timeout: 8000 });
      }
      const canvas = game.locator("canvas").first();
      const box = (await canvas.boundingBox())!;
      const at = () => canvas.evaluate((c: HTMLCanvasElement) => `${c.dataset.x},${c.dataset.y}`);
      const pointFor = (x: number, y: number) => {
        const [px, py] = project(x, y);
        return {
          x: ((px - VIEW.x) / VIEW.width) * box.width,
          y: ((py - VIEW.y) / VIEW.height) * box.height,
        };
      };

      console.log(`\n=== ascension ${label} ${width}x${height} ===`);
      assert.equal(await game.locator(".rf-world-prompt").count(), 0,
        "no floating prompt should cover the world");

      // Sample the walkable band; nothing should intercept a tap.
      let total = 0, blocked = 0;
      for (let wy = 100; wy <= 320; wy += 25) {
        for (let wx = 100; wx <= 480; wx += 35) {
          const pos = pointFor(wx, wy);
          if (pos.x < 0 || pos.y < 0 || pos.x > box.width || pos.y > box.height) continue;
          total += 1;
          const tag = await game.locator("body").evaluate((b: HTMLElement, p: { x: number; y: number }) => {
            const c = b.querySelector("canvas") as HTMLCanvasElement;
            const r = c.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + p.x, r.top + p.y) as HTMLElement | null;
            return el ? el.tagName : "none";
          }, pos);
          if (tag !== "CANVAS") blocked += 1;
        }
      }
      assert.equal(blocked, 0, `${blocked} of ${total} taps are intercepted`);
      console.log(`PASS  all ${total} sampled taps reach the world`);

      const before = await at();
      await canvas.click({ position: pointFor(300, 330) });
      await page.waitForTimeout(1600);
      const after = await at();
      assert.notEqual(before, after, "a ground tap must move the Friend");
      console.log(`PASS  ground tap walked the Friend: ${before} -> ${after}`);

      // Walking to the Core offers the HUD action.
      await canvas.click({ position: pointFor(330, 290) });
      const enter = game.getByRole("button", { name: /^Enter The Core$/ });
      await enter.waitFor({ timeout: 15_000 });
      console.log("PASS  HUD offers Enter The Core when in range");

      await enter.click();
      await game.getByText(/chassis/).first().waitFor({ timeout: 8000 });
      console.log("PASS  HUD action opens the station");
      await game.getByRole("button", { name: /^Close The Core/ }).click();

      await canvas.focus();
      await page.keyboard.press("e");
      await game.getByText(/chassis/).first().waitFor({ timeout: 8000 });
      console.log("PASS  E opens the station");
    },
  });
}
console.log("\nascension taps behave correctly at both sizes");
