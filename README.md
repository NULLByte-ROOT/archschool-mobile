# ArchSchool Mobile

The Android/iOS client for [ArchSchool](https://archschool.vidxsepehr.ir) — the
class workspace for 11th-grade Computer Network 1. Built with Expo (SDK 58),
React Native, Expo Router, React Query, Zustand and Reanimated.

The UI is fully RTL Persian, dark-only, with a “midnight blueprint” identity:
deep navy paper, a hairline drafting grid, warm amber accent and Vazirmatn.
Every dynamic number is rendered with Latin digits; dates use Persian wording
with Latin numerals.

## What is inside

| Area | Notes |
| --- | --- |
| Dashboard | Streak hero, “at risk” pulse, percentage top-3, personal focus, class activity, 7-day trend, tomorrow's timetable |
| Assignments | Urgent/upcoming/completed, swipe a card to toggle completion, deadline countdown, detail page with attachments and comments |
| Chat | Global, private DM and assignment rooms; WebSocket live updates, image upload, reply/pin/delete (staff) |
| Leaderboard | Ranked by completion percentage, streaks and 7-day activity |
| Profile | Own stats, role, sign-out, admin entry to member management |
| Admin | Member CRUD, role changes, access-code rotation (Owner only), assignment creation with quick due-date presets |
| Push | Expo push token registration; chat, new-assignment and 24h/2h deadline notifications with deep links |
| OTA | EAS Update channels (`development`, `preview`, `production`) |

## Requirements

- Node.js 20+ (Node 22 recommended)
- An Expo account and EAS CLI (`npx eas-cli@latest`)
- Android device/emulator; for iOS builds a Mac or EAS cloud build
- The ArchSchool backend reachable over HTTPS (production is already live)

No local backend or database is needed for the app itself.

## Install

```bash
cd archschool-mobile
npm install
```

The API base is compiled in:

```
https://archschool.vidxsepehr.ir/api
```

To point a development build at another backend, copy `.env.example` to `.env`
and set `EXPO_PUBLIC_API_URL` (the WebSocket URL is derived automatically):

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api
```

## First-time EAS setup

Remote push and OTA both need an EAS project. Run this once, from the project
root:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest update:configure
```

`eas init` writes `extra.eas.projectId` into `app.json`; `update:configure`
replaces the placeholder `updates.url` with `https://u.expo.dev/<project-id>`.
Commit both changes. Until this is done the app logs
`[push] no EAS projectId configured yet` and skips push registration — everything
else works.

## Run during development

Expo Go is fine for UI work, but **remote push does not work in Expo Go on
Android**. Use a development build for push testing:

```bash
# 1) build and install the dev client (APK link appears when done)
npx eas-cli@latest build --platform android --profile development

# 2) start Metro for the installed dev client
npx expo start --dev-client

# or plain Expo Go for UI-only work
npx expo start
```

Scan the QR code, or press `a` to open Android. If the phone cannot reach your
computer, use `npx expo start --tunnel`.

## Build an installable APK (no store)

```bash
npx eas-cli@latest build --platform android --profile preview
```

The `preview` profile produces an APK with `distribution: internal`; EAS prints a
download link when the build finishes. This is the easiest way to hand the app
to classmates.

## Production build / store

```bash
npx eas-cli@latest build --platform android --profile production
```

This produces an AAB with `autoIncrement: true` and the `production` update
channel. For iOS:

```bash
npx eas-cli@latest build --platform ios --profile production
```

## OTA updates

Every production install checks for updates on load (`ON_LOAD`). Ship JS-only
changes without a new store build:

```bash
npx eas-cli@latest update --channel production --message "fix: chat composer height"
```

`runtimeVersion.policy` is `appVersion`, so an OTA only reaches builds with the
same `version` in `app.json`. Bump the version (and rebuild) when native modules
change.

## Push notifications

After login the app asks for notification permission and registers its Expo
token with:

```
POST /api/users/push-token   { token, device_type }
```

Logout deletes it (`DELETE /api/users/push-token`). The backend fans out:

- **Chat** — new messages in global/DM/assignment rooms, according to the same
  RBAC rules as the web client (members only receive assignment comments).
- **New assignment** — every active account except its creator.
- **Deadlines** — 24 hours and 2 hours before `due_date`, only to users who have
  not completed the task.

Tapping a notification opens the matching chat room or assignment detail page.
Delivery is best-effort and never blocks the originating request.

Test it on a physical device with a development/production build (not Expo Go,
not an emulator):

1. Log in and accept notifications.
2. Send a message from another account (or create an assignment as an admin).
3. Check `docker compose logs`/`docker logs archschool_backend_*` for
   `archschool.push` warnings if nothing arrives.

## Validation (no local runtime)

Project rule: never start a dev server or create a local SQLite database.

```bash
npm run typecheck          # tsc --noEmit
npx expo export --platform android --output-dir .expo-export-test
npx expo-doctor
```

Remove `.expo-export-test/` afterwards (it is git-ignored).

## Project layout

```
src/
  app/                    Expo Router routes
    (tabs)/               home, assignments, chat, leaderboard, profile
    chat/[room].tsx       one room: messages, composer, WS
    assignment/[id].tsx   detail + comment room
    users.tsx             admin/owner member management
    new-assignment.tsx    staff assignment creation
  api/                    typed fetch client + query keys
  components/             glass cards, headers, sheets, tab bar, primitives
  hooks/                  room/pulse sockets, notifications, clock
  lib/                    format, roles, chat room parsing, subjects
  store/                  Zustand auth store (SecureStore)
  theme/                  design tokens
```

State: React Query for server data, Zustand for the session. JWTs live in
`expo-secure-store`. The WebSocket is receive-only; writes go through REST so
push fan-out and anti-abuse checks stay in one place.

## Backend contract

The mobile app expects these endpoints (all already implemented in
`homeworkmanager/backend`):

- `POST /api/auth/login` → `{ access_token, user }`
- `GET /api/assignments`, `GET /api/assignments/{id}`, `POST /api/assignments`
- `POST /api/assignments/{id}/toggle`
- `GET/POST /api/messages/{room}`, `POST /api/messages/{room}/upload`
- `GET /api/stats/leaderboard`, `GET /api/stats/overview`
- `GET /api/chat/overview`, `GET /api/chat/unread`
- `GET/POST/PATCH/DELETE /api/users` (staff/owner rules apply)
- `POST/DELETE /api/users/push-token`
- `WS /api/ws?room=...&token=...`

CORS on the backend allows Expo development origins via a regex; native
requests send no `Origin` at all.

## Deploying the backend

The API changes for push live in the main repository. Deploy with the blue-green
script — never `docker compose up` directly:

```bash
cd /path/to/homeworkmanager
git pull
./deploy.sh deploy
```

The additive tables (`push_tokens`, `deadline_notifications`) are created by the
boot migration; no manual SQL is required.
