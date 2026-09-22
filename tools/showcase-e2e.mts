// The endgame takes more play than a judge will do, so it must be reachable directly
// and must never look like earned progress.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";

await testGame("./games/ascension", {
  screenshot: "./artifacts/showcase.png",
  timeout: 30_000,
  check: async ({ page, game }) => {
    await game.getByRole("button", { name: /^Settings$/ }).click();
    await game.getByRole("button", { name: /^Show me Ascendant$/ }).click();
    await page.waitForTimeout(500);

    const tier = await game.locator(".asc-tier").innerText();
    assert.match(tier, /Ascendant/i, `expected Ascendant, got ${tier}`);
    console.log("PASS  rank is now:", tier);

    const flag = await game.locator(".asc-showcase-flag").innerText();
    assert.match(flag, /Showcase/i, "a granted state must be flagged in the HUD");
    console.log("PASS  HUD flags it as:", flag);

    // Top aura and both wearables should be on the sprite.
    assert.equal(await game.locator(".asc-aura-4").count(), 1, "tier 4 aura should be showing");
    assert.equal(await game.locator(".asc-wear").count(), 1, "wearables should be showing");
    console.log("PASS  tier 4 aura and wearables rendered");

    // Close the menu so the screenshot shows the Friend.
    await game.getByRole("button", { name: "Close Settings" }).click();
    await page.waitForTimeout(400);

    // And it must be reversible.
    await game.getByRole("button", { name: /^Settings$/ }).click();
    await game.getByRole("button", { name: /^Clear showcase$/ }).click();
    await page.waitForTimeout(300);
    assert.match(await game.locator(".asc-tier").innerText(), /Dormant/i);
    assert.equal(await game.locator(".asc-showcase-flag").count(), 0);
    console.log("PASS  showcase clears back to Dormant");

    await game.getByRole("button", { name: "Close Settings" }).click();
    await game.getByRole("button", { name: /^Settings$/ }).click();
    await game.getByRole("button", { name: /^Show me Ascendant$/ }).click();
    await game.getByRole("button", { name: "Close Settings" }).click();
    await page.waitForTimeout(600);
  },
});
console.log("\nshowcase verified");
