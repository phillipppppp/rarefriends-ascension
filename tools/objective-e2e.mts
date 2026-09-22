// The objective must name the next useful action at every stage, or it is just decoration.
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const VIEW = { x: 320, y: 330, width: 960, height: 640 };

await testGame("./games/ascension", {
  timeout: 45_000,
  screenshot: "./artifacts/objective.png",
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
    const approve = async () => {
      const c = page.getByRole("button", { name: "Confirm preview" });
      await c.waitFor({ timeout: 10_000 });
      await c.click();
    };
    const objective = () => game.locator(".asc-objective").innerText();

    const atStart = await objective();
    assert.match(atStart, /Fabricator/, `should point at the Fabricator first, got: ${atStart}`);
    console.log("PASS  fresh start ->", atStart);

    await walkTo(203, 152);
    await (await arriveAt(/^Fabricator/)).click();
    await game.getByRole("button", { name: /^Buy one cell/ }).click();
    await approve();
    await game.getByRole("button", { name: "Close Fabricator" }).click();

    const holdingCell = await objective();
    assert.match(holdingCell, /Assembler/, `holding a Cell should point at the Assembler, got: ${holdingCell}`);
    console.log("PASS  holding a Cell ->", holdingCell);

    await walkTo(470, 160);
    await (await arriveAt(/^Assembler/)).click();
    await game.getByRole("button", { name: /^Fabricate one component$/ }).click();
    await approve();
    await game.getByText("Fabrication complete", { exact: true }).waitFor();
    await game.locator(".asc-reward button").last().click();   // keep it

    const holdingComponent = await objective();
    assert.match(holdingComponent, /Core|Outfitter/, `holding salvage should point at the Core or Outfitter, got: ${holdingComponent}`);
    console.log("PASS  holding salvage ->", holdingComponent);
  },
});
console.log("\nobjective tracks the player through the loop");
