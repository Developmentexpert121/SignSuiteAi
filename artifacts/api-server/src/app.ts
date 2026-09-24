import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { widgetCors } from "./lib/widgetCors";
import { UPLOADS_DIR } from "./lib/paths";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Stripe webhook MUST be registered BEFORE express.json() — it needs the raw Buffer body
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      return res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, 'Stripe webhook error');
      return res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Scoped, allowlist-based CORS for the SSO/widget endpoints — these
// touch auth and must NOT respond to arbitrary origins, unlike the
// permissive global CORS used by the rest of the API. Mounted before
// the global `cors()` so the response headers we set here win.
app.use(["/api/sso/exchange", "/api/sso/issue", "/api/sso/me/apps", "/api/sso/me/revoke"], widgetCors);

app.use(cors());
// 10mb limit accommodates base64-encoded logo uploads on
// /api/admin/upload-logo without rejecting the request before the route
// handler runs. Default 100kb is too small for typical PNG/JPG logos.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve admin-uploaded logos. Lives under /api/* so that the SignSuiteIQ
// dev-server's existing /api proxy entry (vite.config.ts) handles it without
// needing an additional proxy rule. The directory is created lazily by the
// upload route — `existsSync` is fine because express.static degrades to 404
// for missing files.
app.use("/api/uploads", express.static(UPLOADS_DIR, { maxAge: "30d", fallthrough: true }));

app.use("/api", router);

// ─── Serve the SignSuiteIQ React frontend (production single-process deploy) ──
// In Replit dev each artifact runs its own dev server, so this block is a no-op
// when the static dist hasn't been built. On DigitalOcean the api-server is the
// only Node process, so it must serve both /api/* and the SPA.
const FRONTEND_DIST = path.resolve(__dirname, "../../signsuiteiq/dist/public");
if (existsSync(FRONTEND_DIST)) {
  logger.info({ FRONTEND_DIST }, "Serving SignSuiteIQ static build");
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: "1h" }));
  // SPA fallback: any non-/api request that didn't match a static file → index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  logger.warn({ FRONTEND_DIST }, "SignSuiteIQ static build not found — only /api routes will be served");
}

export default app;
