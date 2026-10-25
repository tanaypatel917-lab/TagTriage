# TagTriage

Offline-first EMS web app (PWA) for NFC/RFID medical stickers. When an EMT taps a sticker on a person's wallet or phone, the most treatment-relevant safety facts appear instantly: allergies, DNR/POLST, blood thinners, conditions, blood type and emergency contact.

> Demonstrator only. No real patient data, no production auth, no HIPAA claims. Web NFC works only on Android Chrome; the built-in simulator reader is the primary demo path.

## How it works

- **Register before an emergency.** A patient or caregiver fills in critical facts, optionally adds a medical record (text, `.txt`/`.md`, or a photo), runs the rewriter, and writes a personal sticker.
- **Critical facts live on the tag** in a byte-budgeted payload that always fits an NTAG215 (504 bytes, NDEF framing included):
  `ttf:v1|<name>|<birthYear>|<bloodType>|<allergies;…>|<anticoagulants>|<DNR>|<conditions;…>|<contact>`
- **The full EMS summary stays behind the opaque tag-ID lookup** in the local store, never on the tag.
- **First-contact encounter stickers** carry only an opaque `tt:v1:<id>:<crc>` identifier.
- **Event-sourced local store.** An append-only event log in IndexedDB (Dexie) is the source of truth; every view is derived by pure reducers. Devices sync by exporting and importing JSON (conflict-free merge).

## Pages

| Route | Purpose |
|---|---|
| `/` | Capture: tap a sticker, see the MED PROFILE, run the encounter |
| `/register` | Register a personal sticker |
| `/board` | Incident tracking board |
| `/inventory` | Sticker rolls per unit |
| `/audit` | Event log, export/import/merge, FHIR export |

## Development

```bash
npm ci
npm run dev        # http://localhost:3000
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

### NVIDIA NIM (optional)

Create `.env.local` (gitignored) with a key from [build.nvidia.com](https://build.nvidia.com):

```
NVIDIA_NIM_API_KEY=nvapi-...
# optional overrides
NVIDIA_NIM_MODEL=openai/gpt-oss-120b
NVIDIA_NIM_VISION_MODEL=meta/llama-3.2-90b-vision-instruct
```

The key is only read server-side by `/api/rewrite`; the browser never sees it. Without a key the app falls back to a deterministic local extractor (photos then need to be pasted as text).

## Deploying later

The `/api/rewrite` route needs a server runtime, so static hosting (GitHub Pages) is not enough. On Vercel, import the repo and set `NVIDIA_NIM_API_KEY` in the project environment. Note that a public deployment lets anyone spend your NIM credits through `/api/rewrite`.
