import { useEffect, useState } from "react";

interface ExchangeResult {
  appKey: string;
  user: {
    id: number;
    name: string | null;
    username: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    companyId: number | null;
  };
}

/**
 * Demo SSO callback page. The real product apps (InstalliQ, SignSalesIQ,
 * SignTakeoffIQ) will each ship their own /sso/callback route on their
 * own domain — this page exists so the SSO loop can be tested end-to-end
 * before those apps are wired up. Reads ?code=... from the URL, exchanges
 * it through the API, and shows the resolved user.
 */
export default function SsoCallback() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<ExchangeResult | null>(null);
  const [error, setError] = useState<string>("");
  const [code, setCode] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code") || "";
    setCode(c);
    if (!c) {
      setState("error");
      setError("Missing ?code= in URL.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/sso/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: c }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState("error");
          setError(body?.error || `Exchange failed (HTTP ${res.status}).`);
          return;
        }
        setData(body as ExchangeResult);
        setState("ok");
      } catch (err: any) {
        setState("error");
        setError(err?.message || "Network error.");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <p className="text-gray-400 text-[10px] uppercase tracking-[0.3em] font-medium mb-2">
          SSO Callback (Test Harness)
        </p>
        <h1 className="text-gray-900 text-2xl font-semibold tracking-tight mb-1">
          {state === "loading" && "Exchanging code…"}
          {state === "ok" && "Sign-in successful"}
          {state === "error" && "Sign-in failed"}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          The real product apps will run this exchange on their own backend, then
          start their own session. This page just confirms the loop works.
        </p>

        {code && (
          <div className="mb-4 text-xs">
            <span className="text-gray-400 uppercase tracking-wider">Code:&nbsp;</span>
            <code className="font-mono text-gray-700 break-all">{code.slice(0, 12)}…{code.slice(-6)}</code>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {state === "ok" && data && (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-800">
              Resolved identity for <strong>{data.appKey}</strong>.
            </div>
            <dl className="text-sm divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {[
                ["User ID", String(data.user.id)],
                ["Name", data.user.name || "—"],
                ["Email", data.user.email || "—"],
                ["Username", data.user.username || "—"],
                ["Role", data.user.role],
                ["Company ID", data.user.companyId != null ? String(data.user.companyId) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex px-4 py-2.5">
                  <dt className="w-32 text-gray-500">{k}</dt>
                  <dd className="text-gray-900 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
