// Drives the whole game loop in the real sandboxed runtime: walk to the Fabricator,
// buy a cell, walk to the Assembler, fabricate, and confirm the reward reveal gates
// the three-way choice until the component is actually revealed.
//
// Note: buy/play/redeem are mutations, so the SDK raises a confirmation in the host
// chrome (outside the game frame) that has to be approved on the parent page.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
// The SDK owns the camera projection; importing it avoids re-deriving it by hand.
import { project } from "../dist/friend-world.js";

const VIEW = { x: 320, y: 330, width: 960, height: 640 };

await testGame("./games/ascension", {
  timeout: 30_000,
  screenshot: "./artifacts/loop-e2e.png",
  check: async ({ page, game }) => {
    const canvas = game.locator("canvas");
    const box = (await canvas.boundingBox())!;

    /** Clicks a walkable point beside a station; the prop itself blocks movement. */
    const walkTo = async (worldX: number, worldY: number) => {
      const [px, py] = project(worldX, worldY);
      await canvas.click({ position: {
        x: ((px - VIEW.x) / VIEW.width) * box.width,
        y: ((py - VIEW.y) / VIEW.height) * box.height,
      } });
    };

    const arriveAt = async (label: RegExp) => {
      const prompt = game.getByRole("button", { name: label });
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if (await prompt.isEnabled()) return prompt;
        await page.waitForTimeout(400);
      }
      throw new Error(`never got close enough to ${label}`);
    };

    /** Mutations are approved in the host chrome, not inside the game. */
    const approve = async () => {
      const confirm = page.getByRole("button", { name: "Confirm preview" });
      await confirm.waitFor({ timeout: 10_000 });
      await confirm.click();
    };

    await walkTo(203, 152);
    await (await arriveAt(/^Fabricator/)).click();
    console.log("PASS  walked to the Fabricator");

    await game.getByRole("button", { name: /^Buy one cell/ }).click();
    await approve();
    await game.getByText(/One simulated cell added/).waitFor();
    console.log("PASS  bought a cell (host confirmation approved)");
    await game.getByRole("button", { name: "Close Fabricator" }).click();

    await walkTo(470, 160);
    await (await arriveAt(/^Assembler/)).click();
    console.log("PASS  walked to the Assembler");

    await game.getByRole("button", { name: /^Fabricate one component$/ }).click();
    await approve();
    await game.getByText("Fabrication complete", { exact: true }).waitFor();
    console.log("PASS  fabricated a component");

    // Reduced motion is forced by the harness, so the reveal resolves at once and the
    // three choices must be live rather than stuck behind the animation.
    const salvage = game.getByRole("button", { name: /^Keep as salvage$/ });
    await salvage.waitFor();
    assert.equal(await salvage.isEnabled(), true, "choices must unlock once revealed");
    await game.getByText(/Redeem it, commit it, or keep it as salvage/).waitFor();
    console.log("PASS  reveal completed and unlocked the choice");

    assert.ok(await game.locator(".asc-reward svg").count() > 0, "reveal should render artwork");
    const shown = await game.locator(".asc-reward h3").innerText();
    console.log(`PASS  revealed component artwork: ${shown}`);

    // Slag is worth nothing, so the screen must not offer redeeming, committing or salvaging it.
    const fork = await game.locator(".asc-fork").innerText();
    const lastButton = await game.locator(".asc-reward button").last().innerText();
    if (shown === "Slag") {
      assert.match(fork, /A miss/, "a zero-value outcome must be described as a miss");
      assert.equal(lastButton, "Back to the station");
      assert.equal(await game.getByRole("button", { name: /^Redeem/ }).count(), 0, "Slag must not offer Redeem");
      assert.equal(await game.getByRole("button", { name: /^Commit to the Core$/ }).count(), 0, "Slag must not offer Commit");
    } else {
      assert.match(fork, /Redeem it, commit it/, "a valuable outcome must offer all three choices");
      assert.equal(lastButton, "Keep as salvage");
      assert.equal(await game.getByRole("button", { name: /^Commit to the Core$/ }).count(), 1);
    }
    console.log(`PASS  choice copy matches the value of ${shown}`);
  },
});
console.log("\nfull loop verified: buy -> fabricate -> reveal -> choose");
