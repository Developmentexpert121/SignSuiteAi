/**
 * SignSuiteIQ App Switcher — drop-in widget for child apps.
 *
 * Usage in a child app (InstalliQ, SignSalesIQ, SignTakeoffIQ, etc.):
 *
 *   <script
 *     src="https://signsuiteiq.ai/widget/app-switcher.js"
 *     data-api-base="https://signsuiteiq.ai"
 *     data-token="WIDGET_TOKEN_FROM_SSO_EXCHANGE"
 *     data-position="top-right"
 *     defer
 *   ></script>
 *
 * `data-token` is the `widgetToken` returned by /api/sso/exchange when the
 * child app exchanges its SSO code. The child app stores it client-side
 * (e.g., localStorage) and renders this <script> tag once the user is
 * signed in. The widget never touches cookies and never sees a password.
 *
 * Tokens live for 24h; after that the widget shows a "Sign in again" CTA
 * pointing back to SignSuiteIQ.
 *
 * All styles are isolated via Shadow DOM so the widget cannot collide with
 * the host app's CSS, and the host app's CSS cannot deform the widget.
 */
(function () {
  "use strict";

  if (window.__SIGNSUITEIQ_APP_SWITCHER_LOADED__) return;
  window.__SIGNSUITEIQ_APP_SWITCHER_LOADED__ = true;

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var config = {
    apiBase: (script && script.getAttribute("data-api-base")) || "",
    token: (script && script.getAttribute("data-token")) || "",
    position: (script && script.getAttribute("data-position")) || "top-right",
    portalUrl: (script && script.getAttribute("data-portal-url")) || "https://signsuiteiq.ai",
  };
  if (!config.apiBase) {
    config.apiBase = "https://signsuiteiq.ai";
  }
  config.apiBase = String(config.apiBase).replace(/\/+$/, "");

  if (!config.token) {
    console.warn("[signsuiteiq-app-switcher] data-token attribute is missing; widget will not render.");
    return;
  }

  // ─── Mount host ───────────────────────────────────────────────────────────
  var host = document.createElement("div");
  host.setAttribute("data-signsuiteiq-app-switcher", "");
  // outer positioning lives on the host element so the host app can override
  // it with a higher-specificity rule if needed.
  host.style.position = "fixed";
  host.style.zIndex = "2147483600";
  host.style.pointerEvents = "none";
  applyPosition(host, config.position);

  var shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = [
    "<style>",
    "  :host, *, *::before, *::after { box-sizing: border-box; }",
    "  .root { pointer-events: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1C2A3A; }",
    "  .btn {",
    "    width: 44px; height: 44px; border-radius: 999px; border: 1px solid rgba(28,42,58,0.12);",
    "    background: #ffffff; color: #1C2A3A; cursor: pointer; display: inline-flex;",
    "    align-items: center; justify-content: center;",
    "    box-shadow: 0 6px 18px rgba(15,23,42,0.12); transition: transform .15s ease, box-shadow .15s ease;",
    "  }",
    "  .btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(15,23,42,0.18); }",
    "  .btn:focus-visible { outline: 2px solid #E8932C; outline-offset: 2px; }",
    "  .btn svg { width: 22px; height: 22px; }",
    "  .panel {",
    "    position: absolute; top: 54px; right: 0; width: 340px; max-width: calc(100vw - 24px);",
    "    max-height: min(560px, calc(100vh - 80px)); overflow: hidden; display: none;",
    "    background: #ffffff; border-radius: 16px; border: 1px solid rgba(28,42,58,0.10);",
    "    box-shadow: 0 30px 60px rgba(15,23,42,0.20); flex-direction: column;",
    "  }",
    "  .panel.left { right: auto; left: 0; }",
    "  .panel.open { display: flex; }",
    "  .panel-head { padding: 14px 16px 8px; border-bottom: 1px solid #f1f5f9; }",
    "  .panel-head .user { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; }",
    "  .panel-head .name { font-size: 14px; font-weight: 600; color: #1C2A3A; margin-top: 2px; }",
    "  .panel-body { padding: 6px 8px 8px; overflow-y: auto; flex: 1; }",
    "  .section-label { padding: 10px 10px 6px; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 600; }",
    "  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0 4px 4px; }",
    "  .tile {",
    "    appearance: none; background: transparent; border: 0; border-radius: 10px;",
    "    padding: 10px 4px; cursor: pointer; text-align: center;",
    "    display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 86px;",
    "    color: #1C2A3A; transition: background .15s ease;",
    "  }",
    "  .tile:hover { background: rgba(232,147,44,0.08); }",
    "  .tile:focus-visible { outline: 2px solid #E8932C; outline-offset: -2px; }",
    "  a.tile { text-decoration: none; }",
    "  .tile.locked { opacity: 0.65; }",
    "  .tile.locked:hover { background: rgba(232,147,44,0.10); opacity: 1; }",
    "  .tile.locked .pill { color: #E8932C; }",
    "  .tile.soon { opacity: 0.7; cursor: default; }",
    "  .tile.soon:hover { background: transparent; opacity: 0.7; }",
    "  .tile.current { background: rgba(28,42,58,0.04); }",
    "  .tile .icon {",
    "    width: 44px; height: 44px; border-radius: 10px; display: inline-flex;",
    "    align-items: center; justify-content: center; background: #f8fafc;",
    "    border: 1px solid #eef2f7; overflow: hidden;",
    "  }",
    "  .tile .icon img { max-width: 32px; max-height: 32px; object-fit: contain; }",
    "  .tile .icon .fallback { font-size: 14px; font-weight: 700; color: #1C2A3A; }",
    "  .tile .label { font-size: 11px; font-weight: 500; line-height: 1.25; }",
    "  .tile .pill { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }",
    "  .footer { border-top: 1px solid #f1f5f9; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }",
    "  .footer a { color: #E8932C; text-decoration: none; font-size: 12px; font-weight: 600; }",
    "  .footer a:hover { text-decoration: underline; }",
    "  .footer .brand { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em; }",
    "  .state { padding: 24px 16px; text-align: center; font-size: 13px; color: #64748b; }",
    "  .state .cta { display: inline-block; margin-top: 10px; background: #1C2A3A; color: #ffffff; padding: 8px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; }",
    "  @media (max-width: 480px) {",
    "    .panel { width: calc(100vw - 24px); }",
    "  }",
    "</style>",
    '<div class="root">',
    '  <button class="btn" type="button" aria-label="Switch apps" aria-haspopup="dialog" aria-expanded="false">',
    '    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '      <rect x="3" y="3" width="6" height="6" rx="1.5"/>',
    '      <rect x="15" y="3" width="6" height="6" rx="1.5"/>',
    '      <rect x="3" y="15" width="6" height="6" rx="1.5"/>',
    '      <rect x="15" y="15" width="6" height="6" rx="1.5"/>',
    '    </svg>',
    "  </button>",
    '  <div class="panel" role="dialog" aria-label="Switch SignSuiteIQ apps">',
    '    <div class="panel-head"><div class="user">Signed in as</div><div class="name" data-name>…</div></div>',
    '    <div class="panel-body" data-body><div class="state">Loading…</div></div>',
    '    <div class="footer"><span class="brand">SignSuiteIQ</span><a href="" target="_blank" rel="noopener" data-portal>Open portal</a></div>',
    "  </div>",
    "</div>",
  ].join("");

  document.body ? document.body.appendChild(host) : document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(host); });

  var root = shadow.querySelector(".root");
  var btn = shadow.querySelector(".btn");
  var panel = shadow.querySelector(".panel");
  var nameEl = shadow.querySelector("[data-name]");
  var bodyEl = shadow.querySelector("[data-body]");
  var portalLink = shadow.querySelector("[data-portal]");
  portalLink.href = config.portalUrl;

  // Panel anchors to the right by default; switch to .left if button sits on
  // the left side of the screen so the panel never clips off-screen.
  if (/left/.test(config.position)) panel.classList.add("left");

  var data = null;
  var dataPromise = null;

  function applyPosition(el, pos) {
    el.style.top = el.style.bottom = el.style.left = el.style.right = "";
    switch (String(pos || "").toLowerCase()) {
      case "top-left":    el.style.top = "16px"; el.style.left = "16px"; break;
      case "bottom-left": el.style.bottom = "16px"; el.style.left = "16px"; break;
      case "bottom-right":el.style.bottom = "16px"; el.style.right = "16px"; break;
      case "top-right":
      default:            el.style.top = "16px"; el.style.right = "16px";
    }
  }

  function load() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch(config.apiBase + "/api/sso/me/apps", {
      method: "GET",
      headers: { "Authorization": "Bearer " + config.token },
      credentials: "omit",
    })
      .then(function (r) {
        if (r.status === 401) return { __expired: true };
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (payload) {
        data = payload;
        return payload;
      })
      .catch(function (err) {
        data = { __error: err && err.message ? err.message : "Network error" };
        return data;
      });
    return dataPromise;
  }

  function render() {
    if (!data) {
      bodyEl.innerHTML = '<div class="state">Loading…</div>';
      return;
    }
    if (data.__expired) {
      nameEl.textContent = "Session expired";
      bodyEl.innerHTML =
        '<div class="state">Your sign-in expired. Please open the portal to refresh access.' +
        '<br/><a class="cta" href="' + escapeAttr(config.portalUrl) + '" target="_blank" rel="noopener">Open portal</a></div>';
      return;
    }
    if (data.__error) {
      nameEl.textContent = "Could not load apps";
      bodyEl.innerHTML = '<div class="state">' + escapeHtml(data.__error) + '</div>';
      return;
    }
    var user = data.user || {};
    nameEl.textContent = user.name || user.email || "Signed in";

    var html = "";
    var apps = Array.isArray(data.apps) ? data.apps : [];
    var locked = Array.isArray(data.locked) ? data.locked : [];

    if (apps.length === 0 && locked.length === 0) {
      bodyEl.innerHTML = '<div class="state">No products available.</div>';
      return;
    }

    if (apps.length > 0) {
      html += '<div class="section-label">Your products</div>';
      html += '<div class="grid">';
      for (var i = 0; i < apps.length; i++) html += renderTile(apps[i], false, user.currentApp);
      html += "</div>";
    }
    if (locked.length > 0) {
      html += '<div class="section-label">Upgrade for more</div>';
      html += '<div class="grid">';
      for (var j = 0; j < locked.length; j++) html += renderTile(locked[j], true, user.currentApp);
      html += "</div>";
    }
    bodyEl.innerHTML = html;

    bodyEl.querySelectorAll("a.tile, button.tile").forEach(function (el) {
      if (el.tagName === "A") return; // anchors navigate natively
      el.addEventListener("click", function () {
        var key = el.getAttribute("data-key");
        if (key === user.currentApp) { close(); return; }
        launch(key, el);
      });
    });
  }

  function renderTile(p, isLocked, currentApp) {
    var comingSoon = !!p.comingSoon;
    var underMaintenance = !!p.underMaintenance;
    var nonClickable = comingSoon || underMaintenance;
    var cls = "tile" + (isLocked ? " locked" : "") + (nonClickable ? " soon" : "") + (p.key === currentApp ? " current" : "");
    var iconInner;
    if (p.logoUrl) {
      iconInner = '<img alt="" src="' + escapeAttr(p.logoUrl) + '"/>';
    } else {
      iconInner = '<span class="fallback">' + escapeHtml(initials(p.label)) + "</span>";
    }
    var pill = comingSoon ? '<span class="pill">Coming Soon</span>' :
               underMaintenance ? '<span class="pill">Maintenance</span>' :
               isLocked ? '<span class="pill">Upgrade</span>' :
               (p.key === currentApp ? '<span class="pill">Current</span>' : "");
    var inner =
      '<span class="icon">' + iconInner + "</span>" +
      '<span class="label">' + escapeHtml(p.label) + "</span>" +
      pill;

    if (nonClickable) {
      // Coming-soon and under-maintenance products are shown but not clickable.
      var soonTitle = comingSoon ? p.label + " — coming soon" : p.label + " — under maintenance";
      return (
        '<span class="' + cls + '" data-key="' + escapeAttr(p.key) + '"' +
        ' title="' + escapeAttr(soonTitle) + '" aria-disabled="true">' +
          inner +
        "</span>"
      );
    }

    if (isLocked) {
      // Locked tiles link straight to the SignSuiteIQ product page so
      // the user can purchase access without leaving the launcher.
      var upgradeUrl = p.upgradeUrl || config.portalUrl;
      return (
        '<a class="' + cls + '" href="' + escapeAttr(upgradeUrl) + '" target="_blank" rel="noopener" data-key="' + escapeAttr(p.key) + '"' +
        ' title="' + escapeAttr("Upgrade to unlock " + p.label) + '">' +
          inner +
        "</a>"
      );
    }
    return (
      '<button class="' + cls + '" type="button" data-key="' + escapeAttr(p.key) + '"' +
      ' title="' + escapeAttr(p.label) + '">' +
        inner +
      "</button>"
    );
  }

  function launch(appKey, el) {
    var original = el.innerHTML;
    el.style.opacity = "0.5";
    fetch(config.apiBase + "/api/sso/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + config.token },
      credentials: "omit",
      body: JSON.stringify({ appKey: appKey }),
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
      .then(function (resp) {
        if (!resp.ok || !resp.body || !resp.body.redirectUrl) {
          alert((resp.body && resp.body.error) || ("Could not launch (HTTP " + resp.status + ")."));
          el.innerHTML = original; el.style.opacity = "1";
          return;
        }
        // Navigate the current tab — switching apps is a navigation, not a popup.
        window.location.href = resp.body.redirectUrl;
      })
      .catch(function () {
        alert("Could not reach the sign-in service. Try again in a moment.");
        el.innerHTML = original; el.style.opacity = "1";
      });
  }

  function open() {
    panel.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    load().then(render);
    setTimeout(function () { document.addEventListener("mousedown", onDocClick, true); }, 0);
    document.addEventListener("keydown", onKey, true);
  }
  function close() {
    panel.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", onDocClick, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function onDocClick(e) {
    var path = (e.composedPath ? e.composedPath() : []) || [];
    if (path.indexOf(host) === -1) close();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  btn.addEventListener("click", function () {
    if (panel.classList.contains("open")) close();
    else open();
  });

  // ─── tiny utils ──────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function initials(s) {
    var t = String(s || "").trim();
    if (!t) return "?";
    var parts = t.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
  }
})();
