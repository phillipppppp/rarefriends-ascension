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
      page.on("console", m => { if (m.type() === "error") problems.push(`CONSOLE ${m.text()}`); });

      // Horizontal overflow anywhere?
      const overflow = await game.locator("body").evaluate((b: HTMLElement) =>
        b.scrollWidth > b.clientWidth + 1 ? `${b.scrollWidth} > ${b.clientWidth}` : "");
      if (overflow) problems.push(`H-SCROLL in game: ${overflow}`);

      await game.getByRole("button", { name: /^Settings$/ }).click();

      const sample = await game.locator(".rf-frame-menu").evaluate((menu: HTMLElement) => {
        const bg = getComputedStyle(menu).backgroundColor;
        const pick = (sel: string) => {
          const el = menu.querySelector(sel) as HTMLElement | null;
          return el ? { sel, color: getComputedStyle(el).color, text: (el.textContent ?? "").slice(0, 28) } : null;
        };
        return { bg, items: [pick("h2"), pick(".asc-note"), pick(".asc-record-label"), pick(".asc-record>strong")].filter(Boolean) };
      });

      console.log(`\n=== ${label} (${width}x${height}) ===`);
      console.log("menu background:", sample.bg);
      for (const item of sample.items as any[]) {
        const r = ratio(item.color, sample.bg);
        const verdict = r >= 4.5 ? "AA" : r >= 3 ? "large-only" : "FAIL";
        console.log(`  ${verdict.padEnd(10)} ${r.toFixed(2)}:1  ${item.sel.padEnd(22)} "${item.text}"`);
        if (r < 4.5) problems.push(`CONTRAST ${r.toFixed(2)}:1 on ${item.sel}`);
      }

      // Keyboard: can the world canvas take focus and does something focusable follow?
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
