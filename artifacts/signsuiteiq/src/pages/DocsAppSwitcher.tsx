/**
 * Public docs page for the embeddable App Switcher widget. This is the
 * page you hand to a child-app team (InstalliQ, SignSalesIQ, SignTakeoffIQ)
 * so they can drop one <script> tag into their app and surface the
 * SignSuiteIQ app-switcher grid in their UI.
 *
 * Lives at /docs/app-switcher.
 */
export default function DocsAppSwitcher() {
  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-medium mb-2">
          Developer Docs
        </p>
        <h1 className="text-gray-900 text-3xl md:text-4xl font-semibold tracking-tight">
          App Switcher Widget
        </h1>
        <p className="text-gray-600 mt-3">
          A drop-in widget that adds a Google-style app launcher to your app's UI.
          Users see every SignSuite product they have access to and can jump
          between them with one click — already signed in.
        </p>

        <Section title="1. The one line you add">
          <p className="text-gray-600 text-sm mb-3">
            Put this <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">&lt;script&gt;</code> tag in your app's HTML, somewhere
            inside <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">&lt;body&gt;</code>, after the user signs in. Pass the
            widget token your backend received from <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">/api/sso/exchange</code>.
          </p>
          <CodeBlock>{`<script
  src="https://signsuiteiq.ai/widget/app-switcher.js"
  data-api-base="https://signsuiteiq.ai"
  data-token="WIDGET_TOKEN_FROM_SSO_EXCHANGE"
  data-position="top-right"
  defer
></script>`}</CodeBlock>
          <table className="w-full text-sm mt-4 border border-gray-200 rounded-lg overflow-hidden">
            <tbody className="divide-y divide-gray-100">
              {[
                ["data-token", "Required. The widgetToken returned by POST /api/sso/exchange."],
                ["data-api-base", "Optional. Defaults to https://signsuiteiq.ai."],
                ["data-position", "Optional. top-right (default), top-left, bottom-right, bottom-left."],
                ["data-portal-url", "Optional. Link shown in the panel footer (defaults to https://signsuiteiq.ai)."],
              ].map(([attr, desc]) => (
                <tr key={attr}>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700 align-top whitespace-nowrap">{attr}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-sm">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="2. How you get the token">
          <p className="text-gray-600 text-sm mb-3">
            You already call <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">POST /api/sso/exchange</code> from your
            server to redeem the SSO code into a user identity. That response now
            also contains a <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">widgetToken</code> field. Send it back to
            your browser (in your login response or via a separate "bootstrap"
            endpoint) and store it client-side so the widget can read it.
          </p>
          <CodeBlock>{`{
  "appKey": "installiq",
  "user": { "id": 42, "name": "Jane", "email": "jane@acme.com", ... },
  "widgetToken": "eyJ1aWQiOj...",
  "widgetTokenExpiresIn": 86400
}`}</CodeBlock>
          <p className="text-gray-500 text-xs mt-3">
            Tokens live for 24 hours. After that, the widget shows a "Sign in
            again" prompt — your users redo the SSO loop and get a fresh token.
          </p>
        </Section>

        <Section title="3. What the widget calls">
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
            <li>
              <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">GET /api/sso/me/apps</code> — lists the products this user can launch.
            </li>
            <li>
              <code className="px-1.5 py-0.5 rounded bg-gray-100 text-[12px]">POST /api/sso/issue</code> — mints a single-use SSO code so the click navigates the user into the target app already signed in.
            </li>
          </ul>
          <p className="text-gray-500 text-xs mt-3">
            Both are called from the browser with <code>Authorization: Bearer &lt;widgetToken&gt;</code> — no cookies, no CORS gymnastics, no second password prompt.
          </p>
        </Section>

        <Section title="4. Try it now">
          <p className="text-gray-600 text-sm mb-3">
            A test harness lives at <a className="text-accent font-medium" href="/widget/demo.html">/widget/demo.html</a>. Paste a token,
            click "Mount", and look for the grid icon in the top-right corner.
          </p>
        </Section>

        <Section title="FAQ">
          <FAQ q="Does it work in a React app?">
            Yes — it's a plain script tag, framework-agnostic. Add it once to your
            root HTML or render it once after login.
          </FAQ>
          <FAQ q="Will the widget's CSS break my app?">
            No. The widget renders inside Shadow DOM, so its styles are fully
            isolated from your page.
          </FAQ>
          <FAQ q="What happens if the user has no other apps?">
            The widget still shows the locked products from the public catalog
            and a link back to the SignSuiteIQ portal so the user can upgrade.
          </FAQ>
          <FAQ q="Can a leaked token be used forever?">
            No. Tokens are signed and expire after 24 hours. Rotate by issuing
            a new <code>widgetToken</code> on your next /sso/exchange call.
          </FAQ>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-gray-900 text-lg font-semibold mb-3">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#1C2A3A] text-gray-100 text-xs leading-relaxed rounded-lg p-4 overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

function FAQ({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border border-gray-200 rounded-lg p-4 bg-white">
      <p className="text-gray-900 text-sm font-medium">{q}</p>
      <p className="text-gray-600 text-sm mt-1.5">{children}</p>
    </div>
  );
}
