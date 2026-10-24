# PROJECT CONTEXT: ArchSchool Mobile — SINGLE SOURCE OF TRUTH

Read this before changing anything. The backend and web client live in the
sibling repository `../homeworkmanager` (GitHub `NULLByte-ROOT/archschool`);
this repository contains **only** the Expo app.

## 1. What this is

`archschool-mobile` is the Android/iOS client for ArchSchool, a class workspace
for 11th grade (Computer Network 1). It talks to the production FastAPI backend
at `https://archschool.vidxsepehr.ir/api` and mirrors the web app's RBAC,
percentage leaderboard, streaks, chat rooms and Persian RTL UI.

## 2. Stack

- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6
- Expo Router (`src/app`) with `Tabs` from `expo-router/js-tabs` and a custom
  `TabBar`
- React Query v5 (server state), Zustand (session), Expo SecureStore (JWT)
- Reanimated 4, Gesture Handler 3, `expo-blur`, `expo-image`, `expo-haptics`
- `expo-notifications` + `expo-device` (push), `expo-updates` (OTA)
- FlashList 2, Vazirmatn (`@expo-google-fonts/vazirmatn`)
- EAS Build/Update (`eas.json`, channels: development/preview/production)

## 3. Non-negotiable rules

1. **Never test locally.** Do not run `expo start`, `npm run android`, Metro, or
   create SQLite databases. Validate with:
   - `npm run typecheck` (`tsc --noEmit`)
   - `npx expo export --platform android --output-dir .expo-export-test`
   - `npx expo-doctor`
   Delete `.expo-export-test/` afterwards (git-ignored).
2. **Surgical changes only.** The screens have been laid out for small phones;
   do not rewrite whole components unless explicitly asked.
3. **RTL is explicit, not global.** Use `flexDirection: "row-reverse"` and
   `textAlign: "right"`; never call `I18nManager.forceRTL` (it needs a reload and
   breaks Expo Go sessions).
4. **Latin digits everywhere.** Dynamic numbers use `Intl.NumberFormat("en-US")`
   via `src/lib/format.ts`; Persian dates use `fa-IR-u-nu-latn`. Never use bare
   `fa-IR` or a Persian digit converter.
5. **RBAC is backend-enforced.** The client only hides UI. Members cannot chat
   outside assignment comment rooms; friends cannot delete messages; only
   admins/owner manage assignments; only Owner sees server stats and changes
   other users' access codes. Never weaken these checks client-side.
6. **No secrets in the repo.** `.env` is git-ignored; only `.env.example` is
   committed. The JWT lives in SecureStore, never in AsyncStorage.
7. **Never commit** `node_modules/`, `.expo/`, `dist/`, `.expo-export-test/`,
   `.env`, keystores, or generated native folders.

## 4. Backend contract

- Login: `POST /api/auth/login` with `{ username, code }` → `{ access_token, user }`.
  Codes are exactly 6 uppercase alphanumerics; there are no passwords.
- API base is compiled in; `EXPO_PUBLIC_API_URL` overrides it for dev builds.
  `WS_BASE` is derived (`http` → `ws`, `/api/ws`).
- WebSocket is **receive-only**: `wss://…/api/ws?room=<room>&token=<jwt>`.
  Rooms: `global`, `dm:<low>:<high>`, `assignment:<id>`, plus `pulse` for unread
  badges. Messages are written with REST so the backend can fan out push and
  apply anti-abuse checks in one place.
- Push: `POST /api/users/push-token` `{ token, device_type }` and
  `DELETE /api/users/push-token`. The backend sends chat/new-assignment/deadline
  pushes; notification `data` carries `type`, `room`, `assignment_id`.
- Deadline semantics: `due_date` is a UTC instant (web sends `toISOString()`),
  rendered locally. Assignment completion is blocked for 30 minutes after
  creation and locks after 3 toggles/hour (HTTP 429) — show the server message.

## 5. Key files

```
src/app/_layout.tsx          providers, fonts, auth gate, notification observer
src/app/(tabs)/_layout.tsx   custom tab bar wiring
src/app/(tabs)/home.tsx      dashboard
src/app/(tabs)/assignments.tsx  list + swipe-to-complete
src/app/(tabs)/chat.tsx      chat hub (global/DMs/unread)
src/app/(tabs)/leaderboard.tsx
src/app/(tabs)/profile.tsx
src/app/chat/[room].tsx      room screen, composer, upload, message actions
src/app/assignment/[id].tsx  detail, attachments, comment room
src/app/users.tsx            admin/owner member management
src/app/new-assignment.tsx   staff creation + due presets
src/api/client.ts            every endpoint, ApiError, query keys
src/hooks/useRoomSocket.ts   per-room WS + reconnect + 1008 handling
src/hooks/usePulseSocket.ts  session-wide unread channel
src/hooks/useNotifications.ts push registration + deep links
src/lib/format.ts            Latin digits, Persian dates, due helpers
src/lib/roles.ts             role labels/colors + isStaff/isOwner
src/lib/subjects.ts          class subject ids mirrored from web
src/theme/tokens.ts          colors, spacing, radii, fonts
```

## 6. Design identity

“Midnight blueprint”: background `#060A11`, navy panels, hairline grid,
amber `#F2B455` accent, teal success, red danger, Vazirmatn. Glass cards use
`expo-blur` with a translucent tint. Motion is short (`FadeInDown`, 300–450ms)
and paired with light haptics; never animate layout on every keystroke.

## 7. Push / OTA setup

`app.json` ships placeholders:

- `extra.eas.projectId` — filled by `npx eas-cli@latest init`
- `updates.url` — filled by `npx eas-cli@latest update:configure`

Until then push registration logs a message and skips; the app still works.
Expo Go on Android cannot receive remote push — use the `development` profile
(`expo-dev-client` is installed) or `preview`/`production` APK. OTA uses
`runtimeVersion.policy: appVersion`; bump `version` for native changes.

## 8. Commands

```bash
npm install
npm run typecheck
npx expo export --platform android --output-dir .expo-export-test

npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview      # APK
npx eas-cli@latest build --platform android --profile production   # AAB
npx eas-cli@latest update --channel production --message "…"
```

Backend deployment stays in the main repo: `./deploy.sh deploy` (blue-green),
never bare `docker compose up`.

## 9. Known SDK 58 / tooling pitfalls

- `Tabs`/`BottomTabBarProps` come from `expo-router/js-tabs`; the custom bar gets
  `{ state, descriptors, emitter, navigateToTab, insets }` — there is no
  `navigation` prop. Emit `tabPress` through `emitter` and navigate with
  `navigateToTab(route.key)`.
- `ReanimatedSwipeable.onSwipeableOpen` only receives `direction`; close through
  a `useRef<SwipeableMethods>` (type exported from
  `react-native-gesture-handler/ReanimatedSwipeable`).
- TypeScript 6 rejects `baseUrl`; `paths` works without it.
- RN 0.88 types have no `StyleSheet.absoluteFillObject`; write the four edges.
- `ScrollView` ref type is `ComponentRef<typeof ScrollView>`.
- PowerShell blocks `npm.ps1`; use `cmd /c "npm …"` / `cmd /c "npx …"` on this
  Windows workstation.
