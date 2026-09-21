"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameWorld, type GameWorldInteraction } from "@rarefriends/friendsdk/world-view";
import { getWorldPreset, validateWorld, project } from "@rarefriends/friendsdk/world";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import { maximumPrize, type GameSnapshot, type GamePlay } from "@rarefriends/friendsdk/game";
import { createFriendSoundKit, type FriendSoundKit, type FriendSoundCue } from "@rarefriends/friendsdk/sounds";
import { COSMETICS, CosmeticArt, cosmeticById, type CosmeticSlot } from "./cosmetics";
import { encodeRecord, decodeRecord } from "./record";
import "@rarefriends/friendsdk/frame.css";
import "@rarefriends/friendsdk/world-view.css";
import "./style.css";

const hex = getWorldPreset("06-orbital-hex-complete");

/**
 * The preset ships three disconnected hex platforms, so a Friend cannot walk between them.
 * These corridors overlap each pair at both ends, joining the station into one walkable ring.
 */
const CORRIDORS = [
  [[248, 98], [324, 98], [324, 126], [248, 126]],
  [[180, 175], [240, 175], [240, 245], [180, 245]],
  [[335, 175], [395, 175], [395, 245], [335, 245]],
] as const;

const world = validateWorld({
  ...hex,
  geometry: { ...hex.geometry, polygons: [...hex.geometry.polygons, ...CORRIDORS.map(points => points.map(point => [...point]))] },
  actors: [],
});

/** Far enough from every station that the Friend starts unprompted and has to walk. */
const spawn = [230, 290] as const;

const interactions: readonly GameWorldInteraction[] = [
  { id: "shop", label: "Outfitter", position: [107, 67], reach: 50, labelOffset: -150 },
  { id: "fabricator", label: "Fabricator", position: [203, 120], reach: 50, labelOffset: -170 },
  { id: "assembler", label: "Assembler", position: [491, 148], reach: 58, labelOffset: -150 },
  { id: "core", label: "The Core", position: [347, 310], reach: 58, labelOffset: -140 },
];

/**
 * Ascension gates. Charge alone is buyable, so every rank past Primed also demands
 * specific rare components and a minimum number of commits. Reactors and Optics cannot
 * be bought at any price — they have to be fabricated and rolled — which is what stops
 * rank from collapsing into a wealth display.
 *
 * `needs` entries are [outcome index, quantity]; outcomes are
 * 0 Slag, 1 Plating, 2 Coil, 3 Servo, 4 Optic, 5 Reactor.
 */
const TIERS = [
  { name: "Dormant", charge: 0n, commits: 0n, needs: [] as readonly (readonly [number, number])[] },
  { name: "Primed", charge: 2n, commits: 3n, needs: [] as readonly (readonly [number, number])[] },
  { name: "Kindled", charge: 4n, commits: 6n, needs: [[2, 2]] as readonly (readonly [number, number])[] },
  { name: "Radiant", charge: 7n, commits: 10n, needs: [[2, 3], [4, 1]] as readonly (readonly [number, number])[] },
  { name: "Ascendant", charge: 11n, commits: 16n, needs: [[4, 3], [5, 2]] as readonly (readonly [number, number])[] },
] as const;

/** Charge per committed component by rank. Diminishing, so later ranks cost more, not less. */
const TIER_YIELD = [100n, 85n, 70n, 55n, 45n];

/**
 * Committing in bulk pays progressively less, recovering slowly once you stop.
 * Ten times the money therefore buys nowhere near ten times the rank.
 */
const FATIGUE_FLOOR = 50;
const FATIGUE_RECOVERY_MS = 15_000;
const fatigueFactor = (fatigue: number) =>
  Math.max(FATIGUE_FLOOR, Math.round(100 * Math.pow(0.9, fatigue)));

/**
 * Lifetime charge one Friend can ever hold. Rank is a property of the Friend, not the wallet,
 * so scale means owning more Friends rather than pouring more RF into one.
 * The cap stops charge accruing; it never blocks committing, or a player who charged
 * efficiently would be locked out before finishing a rank's rare-component set.
 */
const LIFETIME_CAP = 20n;

/** Deterministic chassis line, seeded from the Friend's token id. Same Friend always ascends the same way. */
const CHASSIS = ["Aurora", "Basalt", "Cinder", "Drift", "Ember", "Flux"] as const;
const chassisFor = (friendId: bigint) => CHASSIS[Number(((friendId % 6n) + 6n) % 6n)];

const RF_UNIT = 10n ** 18n;
const rf = (value: bigint) => `${formatGameAmount(value, 18)} RF`;
type Menu = "shop" | "fabricator" | "assembler" | "core" | "inventory" | "settings" | "reward" | null;

/** Mirrors the runtime camera in world-view so overlays land exactly on the canvas sprite. */
const VIEW = { x: 320, y: 330, width: 960, height: 640 };
/** The runtime paints the Friend into an 80x80 box whose top-left sits at (x-40, y-75). */
const SPRITE = 80;

/**
 * The Friend is painted onto a canvas, not the DOM, so it cannot be styled directly.
 * The runtime publishes the live position on the canvas dataset, which lets overlays
 * track the sprite without reaching into the canvas or the parent page.
 */
function useSpriteAnchor(world: HTMLDivElement | null, active: boolean) {
  const anchor = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!world || !active) {
      if (anchor.current) anchor.current.style.opacity = "0";
      return;
    }
    let frame = 0;
    const tick = () => {
      const canvas = world.querySelector("canvas");
      const node = anchor.current;
      if (canvas && node) {
        const x = Number(canvas.dataset.x);
        const y = Number(canvas.dataset.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          const canvasBox = canvas.getBoundingClientRect();
          const worldBox = world.getBoundingClientRect();
          if (canvasBox.width > 0) {
            const [projectedX, projectedY] = project(x, y);
            const ratio = canvasBox.width / VIEW.width;
            node.style.left = `${canvasBox.left - worldBox.left + (projectedX - VIEW.x - SPRITE / 2) * ratio}px`;
            node.style.top = `${canvasBox.top - worldBox.top + (projectedY - VIEW.y - 75) * ratio}px`;
            node.style.width = `${SPRITE * ratio}px`;
            node.style.height = `${SPRITE * ratio}px`;
            node.style.opacity = "1";
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [world, active]);
  return anchor;
}

export default function Ascension({ friendId, client, paused }: GameComponentProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [result, setResult] = useState<GamePlay | null>(null);
  const [committed, setCommitted] = useState<readonly bigint[]>([]);
  const [spent, setSpent] = useState<readonly bigint[]>([]);
  const [charge, setCharge] = useState(0n);
  const [fatigue, setFatigue] = useState(0);
  const [recordInput, setRecordInput] = useState("");
  const [recordMessage, setRecordMessage] = useState("");
  const [owned, setOwned] = useState<readonly string[]>([]);
  const [worn, setWorn] = useState<Partial<Record<CosmeticSlot, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [worldNode, setWorldNode] = useState<HTMLDivElement | null>(null);
  const sound = useRef<FriendSoundKit | null>(null);
  const locked = useRef(false);
  const epoch = useRef(0);
  const definition = client.definition;

  useEffect(() => {
    const version = ++epoch.current;
    sound.current = createFriendSoundKit({ muted: true });
    setSnapshot(null); setMenu(null); setResult(null); setError(""); setMessage("");
    setBusy(false); setMuted(true);
    setCommitted(definition.outcomes.map(() => 0n));
    setSpent(definition.outcomes.map(() => 0n));
    setCharge(0n); setFatigue(0); setOwned([]); setWorn({});
    setRecordInput(""); setRecordMessage("");
    locked.current = false;
    void client.read().then(value => { if (version === epoch.current) setSnapshot(value); }).catch(cause => {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not load the preview.");
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener("change", update);
    return () => {
      epoch.current++; sound.current?.dispose(); sound.current = null;
      preference.removeEventListener("change", update);
    };
  }, [client, friendId, definition]);

  async function act(work: () => Promise<void>, cue?: FriendSoundCue, after?: () => void) {
    if (locked.current || paused) return;
    const version = epoch.current;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    void sound.current?.unlock();
    try {
      await work();
      const value = await client.read();
      if (version === epoch.current) { setSnapshot(value); if (cue) sound.current?.play(cue); after?.(); }
    } catch (cause) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "The preview action failed.");
    } finally {
      if (version === epoch.current) { locked.current = false; setBusy(false); }
    }
  }

  const navigate = (next: Menu) => { if (!busy && !paused) { setMenu(next); setError(""); setMessage(""); } };

  /** Commit fatigue bleeds off once the player stops dumping. */
  useEffect(() => {
    const timer = setInterval(() => setFatigue(current => (current > 0 ? current - 1 : 0)), FATIGUE_RECOVERY_MS);
    return () => clearInterval(timer);
  }, []);

  const chargeWhole = charge / RF_UNIT;
  const totalCommits = committed.reduce((total, count) => total + count, 0n);
  /** Every gate must pass, and ranks are sequential, so one lucky drop cannot skip a tier. */
  const meetsTier = (index: number) => {
    const candidate = TIERS[index];
    return charge >= candidate.charge * RF_UNIT
      && totalCommits >= candidate.commits
      && candidate.needs.every(([outcome, quantity]) => (committed[outcome] ?? 0n) >= BigInt(quantity));
  };
  let ranked = 0;
  while (ranked + 1 < TIERS.length && meetsTier(ranked + 1)) ranked += 1;
  const tierIndex = ranked;
  const tier = TIERS[tierIndex];
  const nextTier = TIERS[tierIndex + 1] ?? null;
  const chassis = chassisFor(friendId);
  const anchor = useSpriteAnchor(worldNode, tierIndex > 0 || Boolean(worn.eye) || Boolean(worn.head));

  const feedback = (
    <p role={error ? "alert" : "status"}>
      {error || message || (busy ? "Waiting for preview confirmation…" : "Simulated RF and outcomes.")}
    </p>
  );

  if (!snapshot) {
    return (
      <div className="asc-loading" role={error ? "alert" : "status"}>
        {error || "Bringing the station online…"}
        {error && <button type="button" disabled={busy || paused} onClick={() => void act(async () => {})}>Retry</button>}
      </div>
    );
  }
  if (snapshot.friendId !== friendId) return <p role="alert">This game session does not match the selected Friend.</p>;

  const maxPrize = maximumPrize(definition);
  const canBuy =
    snapshot.rfBalance >= definition.price &&
    snapshot.freeStake >= maxPrize &&
    snapshot.freeStake + definition.price >= maxPrize;
  const pending = snapshot.plays.find(play => play.outcomeId === null);
  const outcome = result?.outcomeId ? definition.outcomes[result.outcomeId - 1] : null;

  /** Components still free to redeem, commit or spend. */
  const held = (index: number) => {
    const remaining = (snapshot.inventory[index] ?? 0n) - (committed[index] ?? 0n) - (spent[index] ?? 0n);
    return remaining > 0n ? remaining : 0n;
  };
  const heldTotal = definition.outcomes.reduce((total, _item, index) => total + held(index), 0n);
  const salvage = definition.outcomes.reduce((total, item, index) => total + held(index) * item.reward, 0n);

  const fabricate = () =>
    act(async () => {
      const version = epoch.current;
      const play = pending ?? (await client.play(1n))[0];
      const settled = await client.settle(play.id);
      if (version === epoch.current) { setResult(settled); setMenu("reward"); }
    }, "reveal-common");

  const capUnits = LIFETIME_CAP * RF_UNIT;
  const atCap = charge >= capUnits;
  /** Rank curve and anti-dump fatigue combine into the rate the Core actually pays. */
  const yieldPercent = (TIER_YIELD[tierIndex] * BigInt(fatigueFactor(fatigue))) / 100n;

  const commit = (index: number) => {
    if (busy || paused || held(index) <= 0n) return;
    const reward = definition.outcomes[index].reward;
    if (reward <= 0n) return;
    // At the cap a commit still counts toward a rank's component gates, it just earns no charge.
    const gain = atCap ? 0n : (reward * yieldPercent) / 100n;
    setCommitted(current => current.map((count, position) => (position === index ? count + 1n : count)));
    setCharge(current => (current + gain > capUnits ? capUnits : current + gain));
    setFatigue(current => current + 1);
    sound.current?.play("reward");
    setMessage(atCap
      ? `${definition.outcomes[index].name} committed. Charge is capped, so it earns no charge — but it still counts toward rank requirements.`
      : `${definition.outcomes[index].name} committed · +${rf(gain)} charge at ${yieldPercent.toString()}% yield.`);
  };

  /** Pays a shop price out of held components, most valuable first, and locks them away for good. */
  const purchase = (id: string) => {
    const item = cosmeticById(id);
    if (!item || busy || paused || owned.includes(id) || tierIndex < item.tier) return;
    let owing = item.price * RF_UNIT;
    if (salvage < owing) { setError("Not enough salvage. Fabricate more components first."); return; }
    // Cheapest first, so a small purchase spends junk components instead of eating a Reactor.
    const order = definition.outcomes
      .map((component, index) => ({ index, reward: component.reward }))
      .filter(entry => entry.reward > 0n)
      .sort((a, b) => (a.reward > b.reward ? 1 : a.reward < b.reward ? -1 : 0));
    const taken = definition.outcomes.map(() => 0n);
    for (const entry of order) {
      let available = held(entry.index);
      while (owing > 0n && available > 0n) {
        taken[entry.index] += 1n; available -= 1n; owing -= entry.reward;
      }
      if (owing <= 0n) break;
    }
    if (owing > 0n) { setError("Not enough salvage. Fabricate more components first."); return; }
    setSpent(current => current.map((count, index) => count + taken[index]));
    setOwned(current => [...current, id]);
    setWorn(current => ({ ...current, [item.slot]: id }));
    sound.current?.play("purchase");
    setMessage(`${item.name} fitted. Salvage spent is gone for good.`);
  };

  /** A record only carries progress the Friend earned; held components are not restored. */
  const currentRecord = committed.length === definition.outcomes.length
    ? encodeRecord({ friendId, charge, committed, owned, worn })
    : "";

  const restoreRecord = () => {
    const result = decodeRecord(recordInput, friendId, definition.outcomes.length);
    if (!result.ok) { setRecordMessage(result.reason); return; }
    // Ignore anything the current build no longer ships, so an old record cannot smuggle in unknown items.
    const validOwned = result.record.owned.filter(id => cosmeticById(id));
    const wornEye = result.record.worn.eye && validOwned.includes(result.record.worn.eye) ? result.record.worn.eye : undefined;
    const wornHead = result.record.worn.head && validOwned.includes(result.record.worn.head) ? result.record.worn.head : undefined;
    setCharge(result.record.charge > LIFETIME_CAP * RF_UNIT ? LIFETIME_CAP * RF_UNIT : result.record.charge);
    setCommitted(result.record.committed);
    setOwned(validOwned);
    setWorn({ eye: wornEye, head: wornHead });
    setFatigue(0);
    setRecordInput("");
    setRecordMessage("Record restored. Your rank and wearables are back.");
    sound.current?.play("reward");
  };

  const title =
    menu === "shop" ? "Outfitter"
    : menu === "fabricator" ? "Fabricator"
    : menu === "assembler" ? "Assembler"
    : menu === "core" ? `The Core · ${tier.name}`
    : menu === "reward" ? "Fabrication complete"
    : menu === "inventory" ? "Components"
    : "Settings";

  return (
    <section className="asc-game" aria-label={definition.name} aria-busy={busy}>
      <div className="asc-world" ref={setWorldNode} inert={Boolean(menu) || paused || undefined}>
        <GameWorld
          world={world}
          spawn={spawn}
          interactions={interactions}
          friendId={friendId}
          paused={Boolean(menu) || paused}
          reducedMotion={reducedMotion}
          onInteract={id => navigate(id as Menu)}
        />
        <div ref={anchor} className="asc-anchor" aria-hidden="true">
          <div className={`asc-aura asc-aura-${tierIndex}${reducedMotion ? " asc-aura-still" : ""}`} />
          {(worn.head || worn.eye) && (
            <svg className="asc-wear" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              {worn.head && <CosmeticArt id={worn.head} />}
              {worn.eye && <CosmeticArt id={worn.eye} />}
            </svg>
          )}
        </div>

        <div className="asc-hud">
          <span className="asc-hud-wallet">{rf(snapshot.rfBalance)} · {snapshot.consumables.toString()} cells</span>
          <span className={`asc-tier asc-tier-${tierIndex}`}>{chassis} · {tier.name}</span>
          <button type="button" onClick={() => navigate("inventory")}>Salvage · {rf(salvage)}</button>
          <button type="button" onClick={() => navigate("settings")}>Settings</button>
        </div>
        <p className="asc-hint">
          <span className="asc-desktop-hint">WASD / arrows to walk · Tap a destination · E near a station</span>
          <span className="asc-mobile-hint">Tap to walk · E / tap near a station</span>
        </p>
      </div>

      {menu && (
        <GameMenu title={title} onClose={busy ? undefined : () => navigate(null)}>
          {menu === "fabricator" ? (
            <>
              <p>One cell costs {rf(definition.price)} and fabricates one component.</p>
              <table>
                <thead><tr><th>Component</th><th>Chance</th><th>Redeems for</th></tr></thead>
                <tbody>
                  {definition.outcomes.map(item => (
                    <tr key={item.name}>
                      <td>{item.name}</td><td>{item.chanceBps / 100}%</td><td>{rf(item.reward)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="rf-frame-primary"
                disabled={!canBuy || busy || paused}
                onClick={() => void act(() => client.buy(1n), "purchase", () => setMessage("One simulated cell added."))}
              >
                Buy one cell · {rf(definition.price)}
              </button>
              {!canBuy && (
                <p>{snapshot.rfBalance < definition.price
                  ? "Not enough simulated RF."
                  : "New purchases are paused until there is enough free backing."}</p>
              )}
              <p className="asc-note">Every cell reserves {rf(maxPrize)} of backing. Purchased cells remain usable.</p>
            </>
          ) : menu === "assembler" ? (
            <>
              <p>{snapshot.consumables.toString()} cells ready. One fabrication consumes one cell.</p>
              <button
                type="button"
                className="rf-frame-primary"
                disabled={busy || paused || (!pending && snapshot.consumables === 0n)}
                onClick={() => void fabricate()}
              >
                {pending ? "Finish pending fabrication" : "Fabricate one component"}
              </button>
            </>
          ) : menu === "reward" && outcome ? (
            <div className="asc-reward">
              <span aria-hidden="true">◈</span>
              <h3>{outcome.name}</h3>
              <p>{rf(outcome.reward)} · {outcome.chanceBps / 100}% chance</p>
              <p className="asc-fork">Redeem it, commit it, or keep it as salvage for the Outfitter.</p>
              {outcome.reward > 0n && (
                <button
                  type="button"
                  disabled={busy || paused}
                  onClick={() => void act(() => client.redeem(result!.outcomeId!, 1n), "reward", () => {
                    setMessage(`Redeemed for ${rf(outcome.reward)}.`);
                    setMenu(null);
                  })}
                >
                  Redeem · {rf(outcome.reward)}
                </button>
              )}
              {outcome.reward > 0n && (
                <button
                  type="button"
                  className="rf-frame-primary"
                  disabled={busy || paused}
                  onClick={() => { commit(result!.outcomeId! - 1); setMenu("core"); }}
                >
                  Commit to the Core
                </button>
              )}
              <button type="button" disabled={busy || paused} onClick={() => navigate(null)}>Keep as salvage</button>
            </div>
          ) : menu === "core" ? (
            <>
              <p className="asc-core-line"><strong>{chassis}</strong> chassis · <strong>{tier.name}</strong></p>
              <div className="asc-meter" role="img" aria-label={`Charge ${chargeWhole.toString()} RF`}>
                <span style={{ width: `${nextTier ? Math.min(100, Number((charge * 100n) / (nextTier.charge * RF_UNIT))) : 100}%` }} />
              </div>
              <p>
                Charge {rf(charge)} · lifetime cap {rf(capUnits)}
                {atCap && <> · <em className="asc-blocked">capped — commits still count toward rank, but earn no charge</em></>}
              </p>

              {nextTier ? (
                <div className="asc-gates">
                  <strong>To reach {nextTier.name}</strong>
                  <ul>
                    <li className={charge >= nextTier.charge * RF_UNIT ? "asc-met" : ""}>
                      Charge {rf(charge)} / {rf(nextTier.charge * RF_UNIT)}
                    </li>
                    <li className={totalCommits >= nextTier.commits ? "asc-met" : ""}>
                      Components committed {totalCommits.toString()} / {nextTier.commits.toString()}
                    </li>
                    {nextTier.needs.map(([outcome, quantity]) => (
                      <li
                        key={outcome}
                        className={(committed[outcome] ?? 0n) >= BigInt(quantity) ? "asc-met" : ""}
                      >
                        {definition.outcomes[outcome].name} committed {(committed[outcome] ?? 0n).toString()} / {quantity}
                      </li>
                    ))}
                  </ul>
                  <p className="asc-note">
                    Rare components cannot be bought at any price. They have to be fabricated and rolled,
                    so rank costs play, not just RF.
                  </p>
                </div>
              ) : (
                <p className="asc-fork">Fully ascended. This Friend has gone as far as the Core allows.</p>
              )}

              <p className="asc-note">
                The Core pays <strong>{yieldPercent.toString()}%</strong> right now — {TIER_YIELD[tierIndex].toString()}%
                for {tier.name} rank{fatigue > 0 && <>, reduced to {fatigueFactor(fatigue)}% by commit fatigue</>}.
                Yield falls as you commit in bulk and recovers when you stop, so committing steadily beats dumping.
                Committed components can never be redeemed.
              </p>
              {definition.outcomes.map((item, index) => (
                item.reward > 0n && (
                  <div className="asc-item" key={item.name}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{held(index).toString()} held · {rf(item.reward)} · {(committed[index] ?? 0n).toString()} committed</small>
                    </span>
                    <button
                      type="button"
                      disabled={busy || paused || held(index) <= 0n}
                      onClick={() => commit(index)}
                    >
                      Commit one
                    </button>
                  </div>
                )
              ))}
            </>
          ) : menu === "shop" ? (
            <>
              <p>Salvage on hand: <strong>{rf(salvage)}</strong></p>
              {salvage === 0n && (
                <p className="asc-warn">
                  You have no salvage yet. Buy a cell at the Fabricator, fabricate it at the Assembler,
                  then choose <strong>Keep as salvage</strong> instead of redeeming. Salvage is what pays here.
                </p>
              )}
              {COSMETICS.map(item => {
                const isOwned = owned.includes(item.id);
                const unlocked = tierIndex >= item.tier;
                const price = item.price * RF_UNIT;
                const short = price - salvage;
                const reason = !unlocked
                  ? `Locked · reach ${TIERS[item.tier].name}`
                  : short > 0n ? `Need ${rf(short)} more salvage` : null;
                return (
                  <div className="asc-item" key={item.id}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.blurb}
                        <br />
                        {rf(price)} · {item.slot === "eye" ? "eyewear" : "headwear"}
                        {reason && !isOwned && <> · <em className="asc-blocked">{reason}</em></>}
                      </small>
                    </span>
                    {isOwned ? (
                      <button
                        type="button"
                        disabled={busy || paused}
                        onClick={() => setWorn(current => ({
                          ...current,
                          [item.slot]: current[item.slot] === item.id ? undefined : item.id,
                        }))}
                      >
                        {worn[item.slot] === item.id ? "Take off" : "Wear"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        title={reason ?? `Spend ${rf(price)} of salvage`}
                        disabled={busy || paused || Boolean(reason)}
                        onClick={() => purchase(item.id)}
                      >
                        {reason ? "Locked" : "Buy"}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          ) : menu === "inventory" ? (
            <>
              <p>Held components keep their fixed value with no expiry. Committed and spent ones are gone for good.</p>
              {definition.outcomes.map((item, index) => (
                <div className="asc-item" key={item.name}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{held(index).toString()} held · {rf(item.reward)}</small>
                  </span>
                  <button
                    type="button"
                    disabled={busy || paused || held(index) <= 0n || item.reward === 0n}
                    onClick={() => void act(() => client.redeem(index + 1, 1n), "reward")}
                  >
                    Redeem one
                  </button>
                </div>
              ))}
              <p className="asc-note">{heldTotal.toString()} components held.</p>
            </>
          ) : menu === "settings" ? (
            <>
              <button
                type="button"
                aria-pressed={!muted}
                onClick={() => {
                  const next = !muted;
                  setMuted(next); sound.current?.setMuted(next);
                  if (!next) void sound.current?.unlock();
                }}
              >
                {muted ? "Sound off" : "Sound on"}
              </button>
              <label>
                <input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} />
                {" "}Reduce motion
              </label>
              <div className="asc-record">
                <strong>Ascension Record</strong>
                <p className="asc-note">
                  This Friend&rsquo;s rank, committed components and wearables, as a code. Copy it before you
                  leave and paste it back next time. A record only loads onto the Friend that earned it.
                </p>
                <label className="asc-record-label" htmlFor="asc-current-record">Your record</label>
                <textarea
                  id="asc-current-record"
                  className="asc-record-code"
                  readOnly
                  rows={2}
                  value={currentRecord}
                  onFocus={event => event.currentTarget.select()}
                />
                <button
                  type="button"
                  disabled={!currentRecord}
                  onClick={() => {
                    const field = document.getElementById("asc-current-record") as HTMLTextAreaElement | null;
                    field?.select();
                    // Clipboard access can be refused in the sandboxed frame; selecting the text always works.
                    void navigator.clipboard?.writeText(currentRecord)
                      .then(() => setRecordMessage("Record copied."))
                      .catch(() => setRecordMessage("Copy blocked here — the record is selected, press Ctrl+C."));
                  }}
                >
                  Copy record
                </button>

                <label className="asc-record-label" htmlFor="asc-restore-record">Restore a record</label>
                <textarea
                  id="asc-restore-record"
                  className="asc-record-code"
                  rows={2}
                  placeholder="Paste an Ascension Record"
                  value={recordInput}
                  onChange={event => { setRecordInput(event.target.value); setRecordMessage(""); }}
                />
                <button type="button" disabled={busy || paused || !recordInput.trim()} onClick={restoreRecord}>
                  Restore
                </button>
                {recordMessage && <p className="asc-record-message" role="status">{recordMessage}</p>}
              </div>

              <p className="asc-note">
                All economy actions are simulated. Committing, salvage spending and ascension ranks are tracked
                in this preview only; the on-chain burn is documented in the project README for later review.
                Held components do not survive a reload — the SDK&rsquo;s preview ledger is in memory — but your
                rank and wearables do, through the record above. Wallet connection and ownership verification
                are provided by the SDK.
              </p>
            </>
          ) : null}
          {feedback}
        </GameMenu>
      )}
    </section>
  );
}
