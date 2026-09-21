# Rare Friends: Ascension

Your Friend works an orbital station, and every component it fabricates forces one
irreversible choice: **cash it out, ascend with it, or wear it.**

Built with [FriendSDK](https://github.com/spokesz/friendsdk) v0.1.2 for the Rare Friends Vibeathon.

- **Playable preview:** **https://phillipppppp.github.io/rarefriends-ascension/**
- **Builder:** [@phillipppppp](https://github.com/phillipppppp)
- **Category:** Economy Potential

---

## The idea

The SDK's reference game is a pure chance loop — buy bait, roll, redeem, repeat. The player
never makes a decision. Ascension keeps that loop and adds the one decision the SDK genuinely
allows: rewards sit in inventory at fixed value and redeeming is optional, so **what you do
with a component matters more than what you rolled.**

Every fabricated component can go to exactly one of three places:

| Choice | Effect |
|---|---|
| **Redeem** | Convert to RF. The safe play, and the only way to keep funding more cells. |
| **Commit to the Core** | Destroyed for good. Buys ascension charge and ranks your Friend up. |
| **Keep as salvage** | Held back to buy wearables at the Outfitter. |

You cannot do two of them with the same component. Rank, wealth and appearance compete for
the same scarce resource, and that tension is the game.

## Playing it

| Station | Platform | What it does |
|---|---|---|
| **Fabricator** | top-left | Buy a Cell for 1 RF |
| **Assembler** | top-right | Burn a Cell, fabricate a component |
| **Outfitter** | top-left | Buy wearables with salvage |
| **The Core** | bottom | Commit components, ascend |

Walk with **WASD** or the arrow keys, or tap a destination. Press **E** near a station,
or tap its prompt. Everything is reachable by keyboard and by touch.

## Running locally

Requires Node.js 22+ and a FriendSDK checkout. Windows works natively; WSL2 is not needed.

```bash
git clone https://github.com/spokesz/friendsdk.git
cd friendsdk
npm ci
```

Copy `game/` from this repository into `friendsdk/games/ascension/`, then:

```bash
npm run dev:game -- games/ascension     # http://127.0.0.1:4173
npx friendsdk check games/ascension     # validate the economy
npx friendsdk test  games/ascension     # headless browser check
```

Copy `tools/` alongside them to run the project's own tests:

```bash
node tools/economy-sim.mjs   # whale analysis, 400 runs per profile
node tools/record-test.ts    # save-code encode/decode units
node tools/record-e2e.mts    # save codes, driven through the real runtime
node tools/loop-e2e.mts      # the whole loop: walk, buy, fabricate, reveal, choose
```

`loop-e2e` is the interesting one: it walks the Friend across the station by clicking
world coordinates through the SDK's own `project()`, approves the host's purchase
confirmation, fabricates, and asserts the reward reveal gates the three-way choice until
the component is actually revealed.

## The economy

One Cell costs **1 RF**. Both of the SDK's shipped examples run a 10% house edge, so
Ascension matches it exactly.

| Component | Chance | Redeems for | Contribution to EV |
|---|---|---|---|
| Slag | 15% | 0 RF | 0 |
| Plating | 25% | 0.20 RF | 0.050 |
| Coil | 25% | 0.50 RF | 0.125 |
| Servo | 20% | 1.125 RF | 0.225 |
| Optic | 10% | 2.50 RF | 0.250 |
| Reactor | 5% | 5.00 RF | 0.250 |
| | **10000 bps** | | **0.900 RF** |

**Expected reward 0.90 RF against a 1 RF price — a 10.00% edge**, verified by the SDK's own
`expectedReward` and `maximumPrize`.

The top prize is deliberately **5 RF, not 10**. Each purchase must reserve the maximum prize
as backing, so the fishing example's 10 RF top prize locks 10× the cell price per purchase.
Halving it halves the stake lock and roughly doubles how much a funded game can actually sell —
a liquidity decision, not a generosity one.

### Sinks

RF leaves circulation three ways, and only the first is conventional:

1. **House edge** — 10% of every cell purchase.
2. **Committing** — a component's redemption value is permanently forgone.
3. **Salvage spending** — wearables are paid for in components never redeemed.

Sinks 2 and 3 are player-chosen, which is the point: the token leaves circulation because
someone *wanted* something, not because a fee took it.

## Ascension, and why money cannot buy it

Charge alone would be trivially purchasable, so **every rank past Primed also gates on rare
components and sustained play.**

| Rank | Charge | Commits | Components required | Yield |
|---|---|---|---|---|
| Primed | 2 RF | 3 | — | 100% |
| Kindled | 4 RF | 6 | 2 Coil | 85% |
| Radiant | 7 RF | 10 | 3 Coil, 1 Optic | 70% |
| Ascendant | 11 RF | 16 | 3 Optic, 2 Reactor | 55% |

Four separate defences against wealth simply buying rank:

- **Rarity gates.** Optics drop at 10% and Reactors at 5%. Neither can be bought at any
  price — they must be fabricated and rolled.
- **Diminishing yield.** Later ranks pay *less* charge per component, not more.
- **Commit fatigue.** Committing in bulk pays progressively less (0.9ⁿ, floored at 50%)
  and recovers only when you stop. Steady play beats dumping.
- **Per-Friend cap.** Charge is capped at 20 RF per Friend. Rank belongs to the character,
  not the wallet, so scale means owning more Friends — not pouring more RF into one.

The cap limits charge but never blocks a commit. An earlier build blocked committing at the
cap, which locked efficient players out before they could finish a rank's component set and
made *inefficient* bulk-dumping strictly better. The simulation caught it; playtesting alone
probably would not have.

### Simulation

`tools/economy-sim.mjs` models the gates over 400 runs per profile:

```bash
node tools/economy-sim.mjs
```

| Profile | RF spent | Outcome |
|---|---|---|
| Demo player, 20 RF | 19.9 | **Radiant 71%**, Kindled 18%, Ascendant 8% |
| Whale, 1000 RF, dumping | 49.9 | Ascendant 100% |
| Whale, 1000 RF, patient | 48.4 | Ascendant 100% |

A whale with 1000 RF spends about 50 and then stops, because rank is capped per Friend.
**Twenty times the money buys no additional rank** — it buys the same single Ascendant Friend.
Going further requires owning more NFTs, which is demand pointed at the collection rather
than at the token.

## Your Friend

The selected Generations NFT is the character, not a portrait on a menu.

- **Chassis line** is derived from the token id, so a given Friend always ascends the same
  way and no two lines look alike.
- **Ascension aura** builds across five visible tiers as the Friend ranks up.
- **Wearables** are worn on the sprite itself, in two slots, with the best pieces gated
  behind rank rather than spending.

The runtime paints the Friend to a `<canvas>`, so overlays track the sprite by reading the
live position the runtime publishes and projecting it through the SDK's exported `project()`.
Nothing reaches into the canvas, the parent page, or the wallet.

## Ascension Records

Progress belongs to the Friend, so it has to outlive the tab. It cannot use browser storage:
the SDK runs the game in `<iframe sandbox="allow-scripts">` without `allow-same-origin`, which
gives the document an opaque origin. Measured in that frame:

```
localStorage   = THROWS SecurityError
sessionStorage = THROWS SecurityError
cookie         = THROWS SecurityError
```

The runtime bridge is no help either — it is a closed allowlist of six game actions
(`read`, `canBuy`, `buy`, `play`, `settle`, `redeem`) with numeric arguments, so game code
cannot hand custom state to the parent.

So a record is a code the player copies: rank, committed components and wearables, encoded
with an FNV-1a checksum and **bound to the token id that earned it**. A record from another
Friend is refused by name, and a damaged one is rejected rather than half-applied.

```bash
node tools/record-test.ts     # encode/decode units
node tools/record-e2e.mts     # drives the real sandboxed runtime
```

The end-to-end test generates a record, confirms another Friend's record and a corrupted
record are both refused, restores an Ascendant record, and checks the restored state
re-encodes identically. On-chain this state is intended to live against the token id, which
removes the need for codes entirely.

## Simulated mechanics

Everything in the preview is simulated, as the SDK's preview client intends. Specifically:

- **No RF moves.** Balances, purchases and outcomes come from `createGamePreview`.
- **The burn is simulated.** The SDK exposes no burn action, so committing is implemented as
  permanently forgoing redemption, tracked in game state. On-chain, this is intended as a real
  burn to the token's sink address, documented here for Rare Friends review.
- **Ascension rank and wearables are local.** They are not written to chain.
- **The 20 RF starting balance is the SDK host's demo allowance**, not an economic assumption.
  The rank curve is tuned so a demo session realistically reaches Radiant, with Ascendant
  visible as a stretch.

Wallet connection, NFT ownership verification and Friend selection are all handled by the SDK
runtime. None of them are reimplemented in game code.

## Known issues

- **Held components do not survive a reload.** Rank, committed components and wearables do,
  through an Ascension Record; the SDK's preview ledger is in memory, so inventory cannot.
- **Ascendant is out of reach in a single demo session** by design; it needs roughly 45 RF
  of fabrication to complete the rare-component set.
- **Commit fatigue is subtle at the top rank**, where the rarity gate binds first and does
  the real work.
- **The game does not load inside MetaMask's in-app mobile browser.** The SDK renders the
  game in `<iframe sandbox="allow-scripts">` and the bridge handshake never completes there.
  Verified working in Chromium and WebKit, at desktop and phone viewports, so this is that
  app's webview rather than the engine — and it affects every FriendSDK game equally,
  including the SDK's own example. Desktop with a browser-extension wallet works.
- Tested at desktop and mobile widths via the SDK's automated browser checks. Not yet tested
  on physical iOS hardware.

## Credits

Built on [FriendSDK](https://github.com/spokesz/friendsdk) (Apache-2.0). World art, sprite
rendering, sound kit and the preview economy client are the SDK's. Game design, economy,
world layout, wearables and ascension system are original to this submission.
