# StylAIze

**See it. Style it. Buy it for less.**

StylAIze is a production-ready AI fashion platform — your AI personal stylist. Tell it where you're going (wedding, interview, date night, festival…), optionally upload a photo, and it returns five complete, explained outfits that are scored for fashion, fit, comfort and budget — then it helps you buy them at the best price.

## Architecture

```
├── apps/
│   ├── web/              # Next.js 15 + React + TypeScript + Tailwind v4 + shadcn/ui + Framer Motion
│   └── api/              # Express + TypeScript + MongoDB (clean architecture)
├── packages/
│   └── shared/           # Shared domain types, enums & constants (@stylaiize/shared)
```

### Clean architecture (API)

```
src/
├── api/                  # HTTP layer: routes, controllers, middleware, validators
│   └── types/            # Express type augmentation
├── application/          # Use-cases / orchestration services (provider-agnostic)
│   └── services/         #   e.g. ai.service.ts
├── domain/               # Entities + ports (interfaces the app depends on)
│   └── ports/            #   e.g. repositories
├── infrastructure/       # Adapters: DB, AI providers, storage, email, repos
│   ├── ai/               #   Gemini, OpenAI, Qwen, Llama, Gemma + Mock (pluggable)
│   ├── db/               #   Mongoose models + connection
│   ├── email/            #   SMTP + dev logging
│   ├── repos/            #   Mongo + in-memory (demo) repositories
│   └── storage/          #   Cloudinary + local
├── config/               # env, feature flags, db status
├── utils/                # errors, logger, jwt, password, async helpers
└── server.ts             # bootstrap
```

## Getting started

Requirements: Node 20+, npm 10+.

```bash
npm install
npm run build:shared     # compile @stylaiize/shared
npm run dev              # runs web (localhost:3000) + api (localhost:4000)
```

Or run each workspace separately: `npm run dev:web` / `npm run dev:api`.

### Environment

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`.

**Demo mode is automatic.** If MongoDB, Gemini, Google OAuth, SMTP or Cloudinary keys are missing, the app boots in demo mode with in-memory data and a deterministic mock AI provider — no crash, no placeholder pages. Add real credentials at any time; no code changes are needed.

| Service | Env vars | Without it |
| --- | --- | --- |
| MongoDB | `MONGODB_URI` | In-memory demo repositories |
| AI | `GEMINI_API_KEY` (or OPENAI/QWEN/LLAMA/GEMMA) | Mock provider |
| Google Login | `GOOGLE_CLIENT_ID/SECRET` | Email login only |
| SMTP | `SMTP_HOST/USER/PASS` | Emails logged to console |
| Cloudinary | `CLOUDINARY_*` | Local `uploads/` folder |
| Virtual try-on | `VTON_SERVICE_URL` (preferred), `VTON_API_URL`, or `VTON_CATVTON_API_URL` | Honest "not configured" state (no fake images) |

### AI providers

The AI layer is fully pluggable. The factory resolves the active provider in this order:

1. `AI_PROVIDER` (pinned, e.g. `gemini`, `openai`, `qwen`, `llama`, `gemma`)
2. First provider with a configured API key
3. Otherwise `AI_NOT_CONFIGURED` (the mock provider is only used when you explicitly set `AI_PROVIDER=mock`)

Business logic lives in `application/services/ai.service.ts` and never touches provider specifics.

### Build Your Look: grooming & optional photo profile

`POST /api/v1/build-look/generate` returns `{ look, grooming? }`. Grooming plans
contain 4-6 styling suggestions (hair, facial grooming, skin prep, accessories,
fragrance) matched to the outfit, occasion and budget. Send
`includeGrooming: false` to omit the `grooming` field entirely.

Grooming is styling advice only: it never makes medical, dermatological or
cosmetic-procedure claims.

The optional photo step has two endpoints:

- `POST /api/v1/style-profile/analyze` (auth + upload rate limit) accepts one
  `image` multipart field (`image/jpeg`, `image/png` or `image/webp`, capped by
  the same `AI_MAX_IMAGE_CHARS`-derived limit as other uploads). It returns a style profile containing only
  styling cues: face shape, hair type/length, skin undertone (for colour
  palettes) and general build. It never infers age, gender, ethnicity,
  religion, health or identity.
- `PUT /api/v1/memory/style-profile` saves a profile **only** after the user
  reviews it (`userEdited: true`). The general `PATCH /api/v1/memory` does not
  accept this field, so an analysed photo is never persisted automatically.

Photos are processed in memory for that single request. They are never written
to disk, uploaded to Cloudinary or logged, and `POST /style-profile/analyze`
never calls the storage adapter. If no AI provider is configured the endpoint
returns `AI_NOT_CONFIGURED` rather than inventing a profile. Saved outfits also
accept an optional `grooming` plan and older outfits load with `grooming: null`.

### Virtual try-on providers

Try-on inference runs on a GPU server you deploy; the Express API is only a
secure gateway. It never fabricates an image, never fakes progress, and never
sends provider keys or provider URLs to the browser.

The preferred IDM-VTON backend is the FastAPI service in
[`inference-service/`](inference-service/README.md). It runs the real pipeline,
exposes asynchronous jobs, and reports progress from the actual diffusion step
callback. Deployment details are in
[`inference-service/DEPLOYMENT.md`](inference-service/DEPLOYMENT.md).

```dotenv
VTON_PROVIDER=auto                      # idm_vton | catvton | auto
VTON_SERVICE_URL=                       # preferred IDM-VTON FastAPI base URL
VTON_SERVICE_API_KEY=                   # must match IDM_VTON_SERVICE_API_KEY
VTON_SERVICE_REQUEST_TIMEOUT_MS=30000
VTON_JOB_POLL_MS=2500
VTON_JOB_MAX_MS=600000                  # includes cold model load
VTON_API_URL=                           # legacy IDM-VTON POST endpoint
VTON_API_KEY=                           # optional legacy Bearer token
VTON_FALLBACK_PROVIDER=catvton          # idm_vton | catvton | none
VTON_CATVTON_API_URL=                   # CatVTON POST endpoint
VTON_CATVTON_API_KEY=                   # optional Bearer token
VTON_HEALTH_URL=                        # optional GET readiness endpoint
VTON_CATVTON_HEALTH_URL=                # optional GET readiness endpoint
VTON_TIMEOUT_MS=120000                  # legacy synchronous timeout
VTON_HEALTH_TIMEOUT_MS=8000
VTON_MAX_IMAGE_BYTES=8388608
```

Check `GET /api/v1/tryon/status` (configuration) and
`GET /api/v1/tryon/health` (real reachability probe). Both are auth-protected.
The async service is ready only when `GET /ready` returns `{"ready": true}`;
`GET /health` only proves the process is alive.

**IDM-VTON FastAPI service contract**

```http
POST /v1/jobs
Authorization: Bearer <key>
Content-Type: application/json

{ "human_image": "<raw base64>", "garment_image": "<raw base64>",
  "garment_description": "Navy blazer", "category": "upper_body" }
```

The response is a job with `id`, `status`, `stage`, `progress`, `message`,
`error`, and `processingTimeMs`. Poll `GET /v1/jobs/:id`, then download
`GET /v1/jobs/:id/result` with `Content-Type: image/png`. Statuses are
`queued`, `running`, `succeeded`, and `failed`. The Node API polls the service,
persists the completed image in MongoDB, and serves it from the authenticated
`/api/v1/tryon/results/:id/image` endpoint.

The service also supports a synchronous `POST /infer` endpoint with the same
request body; it returns raw `image/png` and is intended for legacy callers.
`category` is one of `upper_body`, `lower_body`, `dresses`.

**CatVTON on a GPU server** uses
`https://github.com/Zheng-Chong/CatVTON`; download its checkpoints and expose
its inference function through the legacy `/infer` contract with
`{ "source_image", "reference_image", "cloth_type" }`.

Expose the GPU server over HTTPS (or a RunPod/Modal HTTPS proxy) and put the URL
in `VTON_SERVICE_URL` or `VTON_CATVTON_API_URL`. Do not expose it to the
internet without a strong API key and firewall rules.

IDM-VTON and its checkpoint assets are CC BY-NC-SA 4.0. Review
[`inference-service/THIRD_PARTY_NOTICES.md`](inference-service/THIRD_PARTY_NOTICES.md)
before commercial use.

## Commands

```bash
npm run dev          # web + api concurrently
npm run build        # shared + api + web
npm run typecheck    # all workspaces
npm run lint         # web + api
npm test             # api (vitest)
```

## Deployment

- Frontend → Vercel (`apps/web`)
- API → Railway or Render (`apps/api`, `npm run build && npm start`)
- Database → MongoDB Atlas
- Virtual try-on / GPU inference → RunPod or Modal using `inference-service/` (IDM-VTON primary, CatVTON legacy fallback)
- Images → Cloudinary

## Roadmap (phased)

1. ✅ Project setup, architecture, design system, landing page
2. Authentication (email + Google OAuth, JWT)
3. AI chatbot
4. Image upload & smart detection
5. Image & body analysis
6. Recommendation engine (5 scored outfits)
7. Virtual try-on (IDM-VTON / CatVTON)
8. Shopping engine
9. Smart price comparison
10. Live price alerts
11. Wardrobe AI
12. Fashion memory
13. Couple mode
14. Group styling
15. AI packing assistant
16. Sustainability intelligence
17. AI fashion calendar
18. User dashboard
19. Admin dashboard
20. Testing, optimization, launch
