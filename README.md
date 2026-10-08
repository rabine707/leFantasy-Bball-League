# LeFantasy Basketball — League HQ

Mobile-first Sleeper companion for the LeFantasy basketball league.

## V1
- League ID: 1406415989997846528
- Live league, manager, roster and draft discovery from Sleeper
- League HQ and manager directory
- Draft War Room with live pick rendering
- 60-second refresh
- Plain HTML/CSS/JS; no build step or keys

This is a separate basketball-native project inspired by the Bape Jesus Fantasy Football architecture. The football repository is not modified.

## Data rule
The site does not invent projections, ADP, category strengths or pick-survival probabilities. Draft Intelligence will only display those once an explicit source/model is wired in.

## Next milestone
Draft Intelligence: rankings/tiers, My Guys, roster-build analysis, best-fit recommendations, reach/value, next-pick survival estimate, and room tendencies where historical data supports them.

Unofficial league companion; not affiliated with Sleeper.

## GM Survival 2.0

Arcade includes an 82-game season simulator and the unchanged original 10-day
GM Survival mode. This is a single additive season-mode overhaul; it does not
change league standings, rosters, transactions, or the NBA schedule API.

- Sleeper provides real names, ages when available, and positional eligibility.
  Base OVR is a **game estimate** from search rank, not an NBA or fantasy
  projection. Missing rank uses 77. Opponent franchises and ratings are fictional.
- Ten unique players; five authoritative PG/SG/SF/PF/C slots and five reserves.
  Slot changes use eligible, available bench players and displace the starter.
  The phone court orders PG above SG/SF above PF/C.
- Starters supply 90% of strength, reserves 10%. Unavailable players supply zero.
  Injuries tick down after each missed game; a three-game injury misses exactly
  three games, even within an eight-game stretch. Replacement impact enters the
  same strength calculation used for each opponent's win probability.
- Morale zones: 80–100 Locked in (+2), 60–79 Happy (0), 40–59 Frustrated (−3),
  20–39 Unhappy (−6), 0–19 Disengaged (−9). Motivation drives daily reactions:
  Winning, Role, Loyalty, Development, Spotlight. Scenarios offer explicit costs.
- Promises remember their baseline and deadline; starts and roster improvements
  settle once, and trading the recipient breaks an open promise. Offensive freedom
  also creates a later review. Remaining obligations settle at season end.
- Four CPU archetypes trade actual players and uniquely owned future picks.
  Accept, decline, and counter have costs. Both rosters must retain five eligible
  slots; transfers preserve ten-player rosters. Projections include loyalty morale
  costs and use the same best-eligible rotation as acceptance.
- The final report grades results, ownership, locker room, promises and future
  assets, with identity and achievements based on behavior. Five owned future
  firsts earn A+ Future Assets and the Sam Presti Award. Initial assets are three
  firsts and three seconds over the next three years.
- Runs save locally under `lefantasy-gm-survival-v2`, including schedule, injuries,
  decisions, flags, promises, picks and trade ledger. They are private to this
  browser. Storage failure leaves the current run playable in the open tab.

Validation: `node --check app.js`, `node --check gm-survival.js`,
`node --check gm-survival-ui.js`, and `node --test tests/*.test.cjs`.
Regression tests cover substitutions, unavailable impact/recovery, morale,
opponent strengths, scenario costs, callback persistence, trade conservation and
projection equality, counters, 50 full seasons, and the Sam Presti threshold.
Browser QA should deal through Arcade, check widths 320/390/430/1280, substitute,
reload, complete all 82 games, reload the report, and start the original mode.
Verify no runtime errors or horizontal page overflow. Publishing is a separate
step after review; these changes do not require production data mutations.

## Highlightly NBA proxy (preview only)

`GET /api/nba/games?date=2026-10-07` returns up to 20 NBA matches for one
UTC calendar date, plus upstream pagination. Supply exactly one valid
`YYYY-MM-DD` date; no other query parameters are accepted.

The Vercel Node.js function reads **`process.env.highlightly_nba`** at runtime.
Keep that exact variable name configured in the intended Vercel project's
Preview and Production environments. Never place its value in browser code,
GitHub, or a URL. No frontend changes or Games Grid are included.

Current official docs checked October 7, 2026:
- Base URL: https://nba.highlightly.net
- Endpoint: `GET /matches?league=NBA&date=YYYY-MM-DD&limit=20`
- Authentication: `x-rapidapi-key` header. Direct Highlightly requests do not use
  `x-rapidapi-host`.
- Docs: https://highlightly.net/nba-api/documentation/matches/
- Authentication: https://highlightly.net/nba-api/documentation/getting-started/authentication/

Only successful JSON is cached for 60 seconds on Vercel's CDN. Errors are
uncached and omit provider bodies, headers and exception details. Requests
have a 10-second timeout and cannot choose another upstream host or route.
This public read endpoint does not add user authentication or a distributed
rate limiter; CDN caching reduces repeated calls for the same date but cannot
prevent deliberate quota abuse across many dates. Preview protection remains
enabled.

Run local security/contract checks with `node --test tests/nba-games.test.cjs`.
These use a fake credential and mocked provider responses; they do not verify
the live subscription. For the real smoke test, open the preview endpoint
while signed in to the owning Vercel team and verify HTTP 200 with a nonempty
`data` array. If the chosen date has no covered games, test one known game date
within the subscription's coverage. Do not build the Games Grid or release to
production until the real response has been verified.
