import { testGame } from "../scripts/testing.mjs";

await testGame("./games/ascension", {
  timeout: 30_000,
  check: async ({ page, game }) => {
      // How to Play opens on load, so every suite dismisses it before touching the world.
      const helpGotIt = game.getByRole("button", { name: /^Got it$/ });
      if (await helpGotIt.count() > 0) {
        await helpGotIt.click();
        await helpGotIt.waitFor({ state: "detached", timeout: 8000 });
      }
    const canvas = game.locator("canvas");
    const at = () => canvas.evaluate((c: HTMLCanvasElement) => `${c.dataset.x},${c.dataset.y}`);

    const focused = await canvas.evaluate((c: HTMLElement) => { c.focus(); return document.activeElement === c; });
    console.log("canvas focusable (no menu open):", focused);

    const before = await at();
    await page.keyboard.down("w");
    await page.waitForTimeout(900);
    await page.keyboard.up("w");
    const after = await at();
    console.log("position before W:", before);
    console.log("position after  W:", after);
    console.log(before !== after ? "PASS  keyboard walking works" : "FAIL  keyboard did not move the Friend");

    // Tab order: every HUD control should be reachable.
    const reachable: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press("Tab");
      const label = await game.locator(":focus").evaluate((el: HTMLElement) =>
        (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)).catch(() => "");
      if (label && !reachable.includes(label)) reachable.push(label);
    }
    console.log("tab-reachable controls:", reachable.join(" | "));
  },
});
