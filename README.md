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
