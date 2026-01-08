---
name: runtime-evidence-sweep-lite
agent: 'agent'
description: Chrome-only runtime evidence pack using in-page logger (no list_console/list_network tools required).
argument-hint: tabHint=<url-or-title>
tools:
  - 'chrome-devtools/*'
---

Use ONLY chrome-devtools MCP.

Hard rules:

- Do NOT use Playwright.
- Do NOT use any non-chrome browser MCP tools (including any `mcp_microsoft_pla_*` / Microsoft browser tools).
- Console + network evidence must come from chrome-devtools MCP only.

Purpose:
This prompt is the fallback when the session/tooling does NOT expose `list_pages`, `list_console_messages`, or `list_network_requests`.
It produces a token-safe evidence pack using in-page instrumentation via `evaluate_script`, plus screenshots.

0. Preconditions (manual)

- You (user) must have the target page already open and focused in the DevTools-controlled Chrome window.
- The active tab URL should match ${input:tabHint} (or contain it).

1. Confirm we’re on the right tab (no navigation)
   Run `evaluate_script` and verify URL:

```js
;() => ({ href: location.href, ready: document.readyState, title: document.title })
```

If `href` does not contain `${input:tabHint}`:

- STOP and tell the user: “Open ${input:tabHint} in the ChromeMCP window, then rerun this prompt.”

2. Install token-safe evidence logger (errors + fetch/xhr)
   Run `evaluate_script`:

```js
;() => {
  // ===== token-safe helpers =====
  const redactUrl = (raw) => {
    try {
      const u = new URL(raw, location.origin)
      const redactKeys = [
        'access_token',
        'apikey',
        'authorization',
        'token',
        'id_token',
        'refresh_token',
        'jwt',
        'key',
        'sig',
        'signature',
      ]
      for (const k of redactKeys) if (u.searchParams.has(k)) u.searchParams.set(k, '[REDACTED]')
      return u.toString()
    } catch {
      return String(raw || '')
    }
  }

  const nowIso = () => new Date().toISOString()

  // ===== error log =====
  if (!window.__copilotErrLog) {
    window.__copilotErrLog = []
    const pushErr = (e) => {
      try {
        window.__copilotErrLog.push({ ts: nowIso(), ...e })
        if (window.__copilotErrLog.length > 200)
          window.__copilotErrLog.splice(0, window.__copilotErrLog.length - 200)
      } catch {}
    }

    window.addEventListener(
      'error',
      (e) => {
        pushErr({
          type: 'error',
          message: String(e?.message || ''),
          filename: e?.filename || null,
          lineno: e?.lineno ?? null,
          colno: e?.colno ?? null,
        })
      },
      true
    )

    window.addEventListener(
      'unhandledrejection',
      (e) => {
        const r = e?.reason
        pushErr({
          type: 'unhandledrejection',
          message: r && r.message ? String(r.message) : String(r),
        })
      },
      true
    )
  }

  // ===== network log (fetch + XHR), token-safe =====
  if (!window.__copilotNetLog) {
    window.__copilotNetLog = []
    const pushNet = (rec) => {
      try {
        window.__copilotNetLog.push({ ts: nowIso(), ...rec })
        if (window.__copilotNetLog.length > 400)
          window.__copilotNetLog.splice(0, window.__copilotNetLog.length - 400)
      } catch {}
    }

    const origFetch = window.fetch?.bind(window)
    if (origFetch) {
      window.fetch = async (...args) => {
        const input = args[0]
        const init = args[1] || {}
        const method = (init.method || (input && input.method) || 'GET').toUpperCase()
        const url = redactUrl(typeof input === 'string' ? input : (input && input.url) || '')
        const t0 = performance.now()
        try {
          const res = await origFetch(...args)
          const ms = Math.round(performance.now() - t0)
          pushNet({ kind: 'fetch', method, url, status: res.status, ok: res.ok, ms })
          return res
        } catch (err) {
          const ms = Math.round(performance.now() - t0)
          pushNet({
            kind: 'fetch',
            method,
            url,
            status: 0,
            ok: false,
            ms,
            error: String(err?.message || err),
          })
          throw err
        }
      }
    }

    const XHR = window.XMLHttpRequest
    if (XHR) {
      const origOpen = XHR.prototype.open
      const origSend = XHR.prototype.send
      XHR.prototype.open = function (method, url, ...rest) {
        this.__copilot = {
          method: String(method || 'GET').toUpperCase(),
          url: redactUrl(url),
          t0: performance.now(),
        }
        return origOpen.call(this, method, url, ...rest)
      }
      XHR.prototype.send = function (...args) {
        const self = this
        const done = () => {
          try {
            const ms = Math.round(performance.now() - (self.__copilot?.t0 ?? performance.now()))
            const status = Number(self.status || 0)
            pushNet({
              kind: 'xhr',
              method: self.__copilot?.method || 'GET',
              url: self.__copilot?.url || '',
              status,
              ok: status >= 200 && status < 400,
              ms,
            })
          } catch {}
        }
        self.addEventListener('loadend', done, { once: true })
        return origSend.call(this, ...args)
      }
    }

    window.__copilotNetLogInstalled = true
  }

  return {
    installed: true,
    href: location.href,
    ready: document.readyState,
    errCount: window.__copilotErrLog.length,
    netCount: window.__copilotNetLog.length,
  }
}
```

3. Trigger exactly ONE clean reload (manual)

- In the ChromeMCP tab: press `Ctrl+Shift+R` once (hard reload)
- Wait until the page is stable and `document.readyState` is `interactive` or `complete`.

4. Pull the evidence payload (token-safe)
   Run `evaluate_script`:

```js
;() => {
  const errs = (window.__copilotErrLog || []).slice(-50)

  const net = (window.__copilotNetLog || []).slice(-200)
  const fails = net.filter((r) => !r.ok && r.status !== 304).slice(-25)

  const table = net.slice(-80).map((r) => ({
    status: r.status,
    method: r.method,
    url: r.url.length > 120 ? r.url.slice(0, 120) + '…' : r.url,
    ms: r.ms,
  }))

  const procErr = errs.find((e) =>
    (e.message || '').toLowerCase().includes('process is not defined')
  )

  return {
    href: location.href,
    ready: document.readyState,
    errorsLast50: errs,
    processIsNotDefinedSeen: !!procErr,
    networkLast80: table,
    failuresLast25: fails,
  }
}
```

5. Screenshots (viewport only)

- `take_screenshot` with `fullPage:false`
- If `resize_page` is available:
  - Desktop: 1440×900 then screenshot
  - iPad: 1024×768 then screenshot
  - Mobile: 390×844 then screenshot
- If `resize_page` is NOT available: use Chrome device toolbar manually and run `take_screenshot` each time.

6. Output format

- Console: PASS/FAIL (actionable errors only)
- Network: table + failures (if any)
- Screenshots: captured (desktop/iPad/mobile)
- Next action: smallest fix + proof step (only if FAIL)
