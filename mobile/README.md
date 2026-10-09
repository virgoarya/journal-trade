# Hunter Trades Journal — Mobile

Flutter client for Hunter Trades Journal. Shares the **Terminal Noir** design
language with the web surface (`web/login.html`, `frontend/`).

## Status: PoC

Login page only. Auth is mocked — no backend call yet.

## Run

```bash
flutter pub get
flutter gen-l10n
flutter run -d chrome     # web
flutter run               # attached device
```

## Test

```bash
flutter test
```

## Layout

```
mobile/
├── lib/
│   ├── main.dart                        app root, locale wiring
│   ├── theme/terminal_noir.dart         design tokens (SSOT)
│   ├── l10n/app_{en,id}.arb             all user-facing strings
│   └── features/auth/login_screen.dart  login PoC
└── test/login_screen_test.dart          widget tests
```

## Conventions

- **No hardcoded user-facing strings.** Everything goes through
  `AppLocalizations` (`lib/l10n/*.arb`) from day one.
- **Colour/type/spacing come from `TerminalNoir`** — never inline a hex value.
- Auth is injected via `LoginScreen.onAuthenticate` so the widget stays
  presentation-only and testable; the real API call swaps in without edits.

## Mock credentials

```
username: admin
password: hunter
```
