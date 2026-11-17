# @stylaiize/api

Express + TypeScript + MongoDB API for StylAIze.

See the [root README](../../README.md) for architecture, environment variables and commands.

Virtual try-on uses `VTON_SERVICE_URL` for the async IDM-VTON FastAPI service in
[`inference-service/`](../../inference-service/README.md), with job polling and
MongoDB persistence handled by this API. `VTON_API_URL` remains the legacy
synchronous fallback.

```bash
npm run dev       # tsx watch on src/server.ts (port 4000)
npm run build     # tsc + tsc-alias -> dist/
npm start         # node dist/server.js
npm test          # vitest
```
