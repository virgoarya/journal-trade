# Hunter Trades Journal — Web Login PoC

Standalone HTML login page, Terminal Noir theme. Zero build step, zero
dependencies (Tailwind + fonts via CDN).

## Run

Open directly:

```
D:/Journal Trade/web/login.html
```

Or serve it:

```bash
cd "D:/Journal Trade/web" && npx serve .
```

## Status: PoC

Auth is mocked in-page. No backend call.

## Mock credentials

```
username: admin
password: hunter
```

Any other pair shows the ACCESS DENIED banner.

## Relationship to the mobile PoC

`web/login.html` and `mobile/` implement the same screen from the same design
tokens (void `#020202`, surface `#111116`, gold `#D4AF37`, neon `#39FF88`,
JetBrains Mono). Deliberately two implementations, one *feel* — the tokens are
mirrored in `mobile/lib/theme/terminal_noir.dart` and must be kept in sync when
either side changes.

## Note

The `frontend/` Next.js app is the production web surface. This folder is a
standalone PoC for design sign-off, not wired into the Next.js build.
