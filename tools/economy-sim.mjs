// Simulates Ascension's rank gates to check whether money alone can buy rank.
const RF = 1;
const PRICE = 1;
const OUTCOMES = [
  { name: "Slag",    bps: 1500, reward: 0 },
  { name: "Plating", bps: 2500, reward: 0.20 },
  { name: "Coil",    bps: 2500, reward: 0.50 },
  { name: "Servo",   bps: 2000, reward: 1.125 },
  { name: "Optic",   bps: 1000, reward: 2.50 },
  { name: "Reactor", bps:  500, reward: 5.00 },
];
const TIERS = [
  { name: "Dormant",   charge: 0,  commits: 0,  needs: [] },
  { name: "Primed",    charge: 2,  commits: 3,  needs: [] },
  { name: "Kindled",   charge: 4,  commits: 6,  needs: [[2, 2]] },
  { name: "Radiant",   charge: 7,  commits: 10, needs: [[2, 3], [4, 1]] },
  { name: "Ascendant", charge: 11, commits: 16, needs: [[4, 3], [5, 2]] },
];
const TIER_YIELD = [100, 85, 70, 55, 45];
const CAP = 20;
const fatigueFactor = f => Math.max(50, Math.round(100 * Math.pow(0.9, f)));

function roll() {
  let r = Math.random() * 10000, acc = 0;
  for (let i = 0; i < OUTCOMES.length; i++) {
    acc += OUTCOMES[i].bps;
    if (r < acc) return i;
  }
  return OUTCOMES.length - 1;
}

function rankOf(charge, committed, total) {
  const meets = t => charge >= t.charge && total >= t.commits &&
    t.needs.every(([o, q]) => (committed[o] || 0) >= q);
  let r = 0;
  while (r + 1 < TIERS.length && meets(TIERS[r + 1])) r += 1;
  return r;
}

/**
 * `dump` models a whale committing everything immediately (fatigue never recovers).
 * `patient` models a player committing steadily (fatigue bleeds off between commits).
 */
function run(balance, { dump }) {
  let rf = balance, charge = 0, fatigue = 0, spent = 0;
  const committed = OUTCOMES.map(() => 0);
  let total = 0;
  for (let step = 0; step < 100000; step++) {
    const rank = rankOf(charge, committed, total);
    if (rank === TIERS.length - 1) break;
    if (rf < PRICE) break;
    rf -= PRICE; spent += PRICE;
    const outcome = roll();
    const reward = OUTCOMES[outcome].reward;
    if (reward === 0) continue;
    // Commit everything: rank is the only goal.
    const yieldPct = TIER_YIELD[rank] * fatigueFactor(fatigue) / 100;
    charge = Math.min(CAP, charge + reward * yieldPct / 100);
    committed[outcome] += 1; total += 1;
    fatigue = dump ? fatigue + 1 : Math.max(0, fatigue - 2 + 1);
  }
  return { rank: TIERS[rankOf(charge, committed, total)].name, charge: charge.toFixed(2), spent, total, rf: rf.toFixed(1) };
}

const trials = 400;
for (const [label, balance, dump] of [
  ["Demo player   (20 RF, steady)", 20, false],
  ["Whale       (1000 RF, dumping)", 1000, true],
  ["Whale       (1000 RF, patient)", 1000, false],
]) {
  const results = Array.from({ length: trials }, () => run(balance, { dump }));
  const counts = {};
  for (const r of results) counts[r.rank] = (counts[r.rank] || 0) + 1;
  const avgSpent = (results.reduce((t, r) => t + r.spent, 0) / trials).toFixed(1);
  const avgCommits = (results.reduce((t, r) => t + r.total, 0) / trials).toFixed(1);
  console.log(`\n${label}`);
  console.log(`  avg RF spent on cells : ${avgSpent}`);
  console.log(`  avg components committed: ${avgCommits}`);
  console.log(`  ranks reached          : ${Object.entries(counts).map(([k, v]) => `${k} ${(v / trials * 100).toFixed(0)}%`).join(", ")}`);
}
