import { testGame } from "../scripts/testing.mjs";

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const parse = (value: string) => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
const ratio = (fg: string, bg: string) => {
  const a = luminance(parse(fg)), b = luminance(parse(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

for (const [label, width, height] of [["desktop", 960, 800], ["phone", 390, 780]] as const) {
  const problems: string[] = [];
  await testGame("./games/ascension", {
    width, height, timeout: 30_000,
    check: async ({ page, game }) => {
      // How to Play opens on load, so every suite dismisses it before touching the world.
      const helpGotIt = game.getByRole("button", { name: /^Got it$/ });
      if (await helpGotIt.count() > 0) {
        await helpGotIt.click();
        await helpGotIt.waitFor({ state: "detached", timeout: 8000 });
      }
      page.on("console", m => { if (m.type() === "error") problems.push(`CONSOLE ${m.text()}`); });

      // Horizontal overflow anywhere?
      const overflow = await game.locator("body").evaluate((b: HTMLElement) =>
        b.scrollWidth > b.clientWidth + 1 ? `${b.scrollWidth} > ${b.clientWidth}` : "");
      if (overflow) problems.push(`H-SCROLL in game: ${overflow}`);

      await game.getByRole("button", { name: /^Settings$/ }).click();

      // Every function inside evaluate stays anonymous: a named one, including a named arrow
      // assigned to a const, makes the bundler emit a __name helper the page does not have.
      const sample = await game.locator(".rf-frame-menu").evaluate((menu: HTMLElement) => {
        const bg = getComputedStyle(menu).backgroundColor;
        const selectors = ["h2", ".asc-note", ".asc-record-label", ".asc-record>strong"];
        return {
          bg,
          items: selectors.map(function (sel) {
            const el = menu.querySelector(sel) as HTMLElement | null;
            return el
              ? { sel, color: getComputedStyle(el).color, text: (el.textContent ?? "").slice(0, 28) }
              : null;
          }).filter(Boolean),
        };
      });

      console.log(`\n=== ${label} (${width}x${height}) ===`);
      console.log("menu background:", sample.bg);
      for (const item of sample.items as any[]) {
        const r = ratio(item.color, sample.bg);
        const verdict = r >= 4.5 ? "AA" : r >= 3 ? "large-only" : "FAIL";
        console.log(`  ${verdict.padEnd(10)} ${r.toFixed(2)}:1  ${item.sel.padEnd(22)} "${item.text}"`);
        if (r < 4.5) problems.push(`CONTRAST ${r.toFixed(2)}:1 on ${item.sel}`);
      }

      // Keyboard: can the world canvas take focus? The menu opened above must be closed first —
      // an open menu makes the world inert on purpose, so checking here reported a false problem.
      await game.getByRole("button", { name: /^Close Settings$/ }).click();
      await page.waitForTimeout(300);
      const canFocusCanvas = await game.locator("canvas").evaluate((c: HTMLElement) => {
        c.focus();
        return document.activeElement === c;
      });
      if (!canFocusCanvas) problems.push("canvas cannot take keyboard focus");
      console.log("  canvas focusable:", canFocusCanvas);
    },
  });
  console.log(problems.length ? `  PROBLEMS:\n   - ${problems.join("\n   - ")}` : "  no problems found");
}
