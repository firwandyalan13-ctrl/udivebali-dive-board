# UDIVEBALI Dive Board

Vanilla HTML/CSS/JS dive-shop board for UDiveBali Tulamben. The live board, Autoplay, Loop, Export, and Import stay on the client. An optional **AI Assistant** can propose changes, but the board never updates until you press **Apply**.

Live frontend: https://firwandyalan13-ctrl.github.io/udivebali-dive-board/

## Local testing

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 4173
```

Then open http://127.0.0.1:8765/ if that server is already running, or:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

## Tulamben tide and wave

The overview and each session load **that board date’s** modeled tide and wave for Tulamben (WITA). If the board date is today, the NOW line updates about every minute.

- Tide: Open-Meteo Marine `sea_level_height_msl` (no API key, browser fetch)
- Wave: Open-Meteo GFS WAVE `wave_height`, period, and direction (`ncep_gfswave016`)
- High/low times are turning points in the 15-minute tide series
- Each dive slot (09:00, 11:00, 14:00, 18:30) shows tide and significant wave height at that time
- Wave size labels: CALM under 0.5m, SMALL under 1.0m, MODERATE under 1.5m, ROUGH 1.5m+
- Changing the board date reloads that day’s curve
- This is a planning aid, not a navigation product

Without an AI endpoint, the assistant still works with local commands:

- `Check today’s schedule`
- `幫我檢查今天的 DM 比例`
- `Assign Alan to the 14:00 Liberty Wreck group`
- `Move Budi from 09:00 to 11:00`
- `Change 14:00 site to Coral Garden`

Press **Send** to preview. **Cancel** / **Clear** discard the preview. **Apply** writes through the existing `saveState()` path, so localStorage, Export, and Import stay in sync.

## Architecture

```
UI (index.html + js/ai-assistant.js)
  -> parser (local) and/or AI client (optional HTTP)
  -> JSON schema check (js/action-schema.js)
  -> board validator (js/action-validator.js)
  -> rule engine (js/rule-engine.js)
  -> preview clone (js/action-executor.js)
  -> Apply uses window.DiveBoard.applyBoardData -> saveState / renderApp
```

Safety checks are deterministic TypeScript-free JavaScript. The model never writes to the board, never receives the API key on the client, and never executes code.

### Action payloads

| type | payload |
| --- | --- |
| `ASSIGN_DM` | `{ sessionId, groupIndex, dmId? , dmName? }` |
| `ADD_DIVER` | `{ sessionId, groupIndex, name, note? }` |
| `MOVE_DIVER` | `{ fromSessionId, fromGroupIndex, toSessionId, toGroupIndex, name }` |
| `REMOVE_DIVER` | `{ sessionId, groupIndex, name }` |
| `CREATE_GROUP` | `{ sessionId, context?, dmName?, dmId? }` |
| `CHANGE_SITE` | `{ sessionId, site, groupIndex? }` |
| `CHECK_SCHEDULE` | `{}` |

Unknown actions, invalid IDs, missing people, and safety-rule failures are rejected before Apply.

Optional diver fields (`certification`, `maxDepthM`, `experience`) are backward compatible. Old Export/Import files still load.

## Token usage

**Never uses a token**

- Opening the assistant
- Local command parser
- DM 1:3, missing DM, duplicates, time conflicts, blank names, invalid times, site-fit warnings
- Preview / Cancel / Clear / Apply
- Export, Import, Autoplay, Loop, localStorage

**Uses a token only when all of these are true**

1. `window.DIVE_BOARD_AI_API_URL` (or `VITE_AI_API_URL`) is set
2. The serverless function has `OPENAI_API_KEY` or `AI_API_KEY`
3. The instruction is sent to that endpoint because it needs free-form language understanding

If the endpoint is missing, the panel shows: `AI natural-language service is not configured.` Local checks still run.

## Frontend env: `VITE_AI_API_URL`

This project is not a Vite app. GitHub Pages serves static files, so set the public function URL in `index.html`:

```html
<script>
  window.DIVE_BOARD_AI_API_URL = "https://your-function-host/api/ai";
  window.VITE_AI_API_URL = window.DIVE_BOARD_AI_API_URL;
</script>
```

Leave it as `""` to keep the local-only assistant.

Do **not** put `OPENAI_API_KEY` in `index.html`, GitHub Pages, localStorage, or any `js/` file.

## Backend API key

Copy `.env.example` and set secrets on the host, never in git:

```
OPENAI_API_KEY=sk-...
ALLOWED_ORIGINS=https://firwandyalan13-ctrl.github.io,http://127.0.0.1:4173
OPENAI_MODEL=gpt-4o-mini
```

`ALLOWED_ORIGINS` is a comma-separated allowlist. Rate limit is 20 requests / 10 minutes / IP. Instruction max length is 2000 characters. Errors never echo the API key.

## Deploy

### GitHub Pages (frontend)

1. Push `main`.
2. Settings → Pages → Deploy from branch `main` `/` (root).
3. After the AI function exists, commit the public URL into `window.DIVE_BOARD_AI_API_URL`.

### Netlify (serverless AI)

```bash
npx netlify deploy --prod
```

Set `OPENAI_API_KEY` and `ALLOWED_ORIGINS` in Site settings → Environment variables. The function is `netlify/functions/ai.mjs` at `/api/ai`.

Frontend URL example: `https://your-site.netlify.app/api/ai`

### Vercel

The portable handler `api/ai.mjs` is the `/api/ai` function (`api/vercel-ai.js` is an Edge alias).

```bash
npx vercel --prod
```

Set the same environment variables in the Vercel project.

### Cloudflare Worker

`workers/ai.js` wraps the same handler.

```bash
npx wrangler deploy workers/ai.js
```

Bind `OPENAI_API_KEY` and `ALLOWED_ORIGINS` as Worker secrets/vars.

## Disclaimer

The UI always shows: **AI suggestions do not replace the Dive Manager’s safety judgment.**
