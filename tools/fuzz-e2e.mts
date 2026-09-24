// Plays a randomised session and checks invariants that must hold no matter what:
//   - a component can never be committed or spent more times than it was fabricated
//   - charge never exceeds the lifetime cap
//   - no console errors
import assert from "node:assert/strict";
import { testGame } from "../scripts/testing.mjs";
import { project } from "../dist/friend-world.js";

const VIEW = { x: 320, y: 330, width: 960, height: 640 };
const NAMES = ["Slag", "Plating", "Coil", "Servo", "Optic", "Reactor"];
const BANDS = [500, 2000, 5000, 7000, 9000, 9700];   // one roll inside each band
const CAP = 20;

await testGame("./games/ascension", {
  timeout: 120_000,
  check: async ({ page, game }) => {
    const errors: string[] = [];
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

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

    const fabricated = NAMES.map(() => 0);
    const committedExpected = NAMES.map(() => 0);
    const ROUNDS = 12;

    // Buy the cells up front.
    await walkTo(203, 152);
    await (await arriveAt(/^Enter Fabricator$/)).click();
    for (let i = 0; i < ROUNDS; i += 1) {
      await game.getByRole("button", { name: /^Buy one cell/ }).click();
      await approve();
      await page.waitForTimeout(150);
    }
    await game.getByRole("button", { name: "Close Fabricator" }).click();

    await walkTo(470, 160);
    const assembler = await arriveAt(/^Enter Assembler$/);

    for (let round = 0; round < ROUNDS; round += 1) {
      const pick = Math.floor(Math.random() * BANDS.length);
      await forceRoll(BANDS[pick]);
      await assembler.click();
      await game.getByRole("button", { name: /^Fabricate one component$/ }).click();
      await approve();
      await game.getByText("Fabrication complete", { exact: true }).waitFor();

      const name = await game.locator(".asc-reward h3").innerText();
      const index = NAMES.indexOf(name);
      assert.notEqual(index, -1, `unknown component ${name}`);
      fabricated[index] += 1;

      const choices = ["redeem", "commit", "salvage"][Math.floor(Math.random() * 3)];
      const canRedeem = await game.getByRole("button", { name: /^Redeem/ }).count() > 0;
      if (choices === "redeem" && canRedeem) {
        await game.getByRole("button", { name: /^Redeem/ }).click();
        await approve();
      } else if (choices === "commit" && canRedeem) {
        await game.getByRole("button", { name: /^Commit to the Core$/ }).click();
        committedExpected[index] += 1;
        await game.getByRole("button", { name: /^Close The Core/ }).click();
      } else {
        await game.locator(".asc-reward button").last().click();
      }
      await page.waitForTimeout(120);
    }

    // Invariants.
    await walkTo(330, 290);
    await (await arriveAt(/^Enter The Core$/)).click();
    const coreText = (await game.locator(".rf-frame-menu-body").innerText()).replace(/\s+/g, " ");

    for (let i = 1; i < NAMES.length; i += 1) {
      const row = new RegExp(`${NAMES[i]} (\d+) held · [\d.]+ RF · (\d+) committed`);
      const match = coreText.match(row);
      if (!match) continue;
      const held = Number(match[1]), committed = Number(match[2]);
      assert.ok(held >= 0, `${NAMES[i]} held went negative: ${held}`);
      assert.ok(committed <= fabricated[i],
        `${NAMES[i]} committed ${committed} but only ${fabricated[i]} were ever fabricated`);
      assert.ok(held + committed <= fabricated[i],
        `${NAMES[i]}: held ${held} + committed ${committed} exceeds fabricated ${fabricated[i]}`);
    }

    const chargeLine = coreText.match(/Charge ([\d.]+) RF/);
    if (chargeLine) {
      assert.ok(Number(chargeLine[1]) <= CAP, `charge ${chargeLine[1]} exceeds cap ${CAP}`);
    }

    console.log("fabricated   :", NAMES.map((n, i) => `${n}=${fabricated[i]}`).join(" "));
    console.log("charge       :", chargeLine ? chargeLine[1] + " RF" : "n/a");
    console.log("console errs :", errors.length ? errors.join(" | ") : "none");
    assert.equal(errors.length, 0, "no console errors during play");
    console.log("PASS  all invariants held across 12 randomised rounds");
  },
});
