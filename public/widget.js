(function () {
  var script = document.currentScript;
  var DEFAULT_BASE = script ? new URL(script.src).origin : window.location.origin;

  // 프로바이더 레지스트리 — 새 프로바이더 추가 시 여기에 한 항목만 추가하면 됨.
  // logo는 단색 SVG(currentColor)로 테마에 맞춰 색이 따라간다.
  var PROVIDERS = {
    openai: {
      label: "OpenAI",
      hint: "sk-...",
      logo: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A6 6 0 0 0 19.02 19.8a5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.74-7.08Zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .4-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.06v5.58a4.5 4.5 0 0 1-4.5 4.49ZM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.08 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.07.07 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.64Zm-1.26-10.4a4.48 4.48 0 0 1 2.34-1.97v5.68a.78.78 0 0 0 .39.68l5.84 3.37-2.02 1.17a.07.07 0 0 1-.07 0L4 19.4a4.5 4.5 0 0 1-1.65-6.15ZM19.24 11l-5.84-3.38 2.02-1.16a.07.07 0 0 1 .07 0l4.83 2.78a4.5 4.5 0 0 1-.68 8.12v-5.68a.78.78 0 0 0-.4-.68Zm2.01-3.03-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.71 8.47V6.14a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66ZM8.61 12.13 6.59 10.96a.07.07 0 0 1-.04-.05V5.33a4.5 4.5 0 0 1 7.38-3.45l-.14.08L9 4.72a.78.78 0 0 0-.4.68l-.01 6.73Zm1.1-2.37L12.31 8.25l2.6 1.5v3.01l-2.6 1.5-2.6-1.5v-3Z"/></svg>',
    },
    anthropic: {
      label: "Anthropic",
      hint: "sk-ant-...",
      logo: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.78 3h-3.2l5.6 18h3.2l-5.6-18Zm-9.56 0L1.62 21h3.27l1.15-3.74h6.07L13.25 21h3.27L10.92 3H7.22Zm-.13 11.06 2.04-6.6 2.03 6.6H7.09Z"/></svg>',
    },
    google: {
      label: "Google AI Studio",
      hint: "AIza...",
      logo: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 9.8 9.8 2 12l7.8 2.2L12 22l2.2-7.8L22 12l-7.8-2.2L12 2Z"/></svg>',
    },
  };
  var ORDER = ["openai", "anthropic", "google"];

  var I18N = {
    en: {
      pickTitle: "Connect an AI key",
      pickSub: "Choose your provider, then paste your key.",
      title: "Connect your {provider} key",
      back: "← Back",
      placeholder: "Paste your API key",
      connect: "Connect key",
      verifying: "Verifying…",
      connected: "Connected",
      retry: "Try again",
      enterKey: "Please enter a key.",
      noToken: "Missing registrationToken.",
      okMsg: "Connected ({masked}) — this app never sees the raw key.",
      models: " · {n} models available",
      netErr: "Network error: {msg}",
      failed: "Failed (HTTP {status})",
      trust1: "Your key is encrypted and held by Relay — not this app",
      trust2: "The app's servers can never read the raw key",
      trust3: "Disconnect anytime",
      poweredBy: "Secured by Relay",
    },
    ko: {
      pickTitle: "AI 키 연결",
      pickSub: "프로바이더를 고르고 키를 붙여넣으세요.",
      title: "{provider} 키 연결",
      back: "← 뒤로",
      placeholder: "API 키를 붙여넣으세요",
      connect: "키 연결하기",
      verifying: "검증 중…",
      connected: "연결 완료",
      retry: "다시 시도",
      enterKey: "키를 입력하세요.",
      noToken: "registrationToken이 없습니다.",
      okMsg: "연결됨 ({masked}) — 이 앱은 원문을 못 봅니다.",
      models: " · 사용 가능 모델 {n}개",
      netErr: "네트워크 오류: {msg}",
      failed: "실패 (HTTP {status})",
      trust1: "이 키는 이 앱이 아니라 Relay가 암호화해 보관합니다",
      trust2: "앱 서버는 키 원문을 볼 수 없어요",
      trust3: "언제든 연결 해제 가능",
      poweredBy: "Secured by Relay",
    },
  };

  function fmt(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? vars[k] : "";
    });
  }

  function styles(accent, radius, dark) {
    var bg = dark ? "#1a2332" : "#ffffff";
    var fg = dark ? "#e6edf6" : "#1a2332";
    var sub = dark ? "#8aa0b8" : "#697586";
    var border = dark ? "#2d3a4d" : "#e3e8ef";
    var inputBg = dark ? "#0f1620" : "#ffffff";
    var tileHover = dark ? "#22304a" : "#f6f8fb";
    var r2 = Math.max(6, radius - 4);
    return [
      ":host{all:initial}",
      "*{box-sizing:border-box;margin:0;padding:0}",
      ".card{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;width:100%;max-width:420px;background:" + bg + ";color:" + fg + ";border:1px solid " + border + ";border-radius:" + radius + "px;padding:20px}",
      ".hd{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px}",
      ".sub{color:" + sub + ";font-size:13px;margin-top:4px;line-height:1.5}",
      ".lock{width:16px;height:16px;flex:none;color:" + accent + "}",
      ".tiles{display:flex;flex-direction:column;gap:8px;margin-top:14px}",
      ".tile{display:flex;align-items:center;gap:12px;width:100%;padding:13px 14px;border:1px solid " + border + ";border-radius:" + r2 + "px;background:" + inputBg + ";color:" + fg + ";cursor:pointer;font-size:14px;font-weight:500;text-align:left;transition:background .12s,border-color .12s}",
      ".tile:hover{background:" + tileHover + ";border-color:" + accent + "}",
      ".tile:focus-visible{outline:none;border-color:" + accent + ";box-shadow:0 0 0 3px " + accent + "33}",
      ".tile .glyph{width:22px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;color:" + fg + "}",
      ".tile .glyph svg{width:22px;height:22px}",
      ".tile .chev{margin-left:auto;color:" + sub + "}",
      ".back{background:none;border:0;color:" + sub + ";cursor:pointer;font-size:13px;padding:0;margin-bottom:4px}",
      ".back:hover{color:" + fg + "}",
      ".prov{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;margin-top:6px}",
      ".prov .glyph{width:20px;height:20px;color:" + fg + "}",
      ".prov .glyph svg{width:20px;height:20px}",
      ".field{position:relative;margin:14px 0}",
      ".input{width:100%;padding:11px 12px;border:1px solid " + border + ";border-radius:" + r2 + "px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:" + inputBg + ";color:" + fg + ";outline:none;transition:border-color .15s,box-shadow .15s}",
      ".input:focus{border-color:" + accent + ";box-shadow:0 0 0 3px " + accent + "33}",
      ".input:disabled{opacity:.6}",
      ".btn{width:100%;padding:11px;background:" + accent + ";color:#fff;border:0;border-radius:" + r2 + "px;cursor:pointer;font-size:14px;font-weight:600;transition:filter .15s}",
      ".btn:hover:not(:disabled){filter:brightness(1.08)}",
      ".btn:disabled{cursor:default;opacity:.7}",
      ".msg{margin-top:12px;font-size:13px;min-height:18px;line-height:1.5}",
      ".msg.ok{color:#0f9d58}",
      ".msg.err{color:#e5484d}",
      ".trust{margin:14px 0 0;padding-left:18px;color:" + sub + ";font-size:12px;line-height:1.7}",
      ".brand{margin-top:14px;display:flex;align-items:center;justify-content:flex-end;gap:5px;font-size:11px;color:" + sub + "}",
      ".brand .lock{width:12px;height:12px;color:" + sub + "}",
    ].join("");
  }

  var LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

  function mount(selector, opts) {
    opts = opts || {};
    var container = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!container) {
      console.error("[RelayPay] container not found:", selector);
      return;
    }
    var apiBase = opts.apiBase || DEFAULT_BASE;
    var token = opts.registrationToken;
    var t = I18N[opts.locale] || I18N.en;
    var accent = opts.accentColor || "#635bff";
    var radius = typeof opts.radius === "number" ? opts.radius : 12;
    var dark = opts.theme === "dark";
    // opts.provider가 있으면 그 프로바이더로 고정(선택 단계 생략). 없으면 사용자가 고른다.
    var fixedProvider = opts.provider && PROVIDERS[opts.provider] ? opts.provider : null;

    container.innerHTML = "";
    var hostEl = document.createElement("div");
    container.appendChild(hostEl);
    var root = hostEl.attachShadow ? hostEl.attachShadow({ mode: "open" }) : hostEl;
    var styleEl = document.createElement("style");
    styleEl.textContent = styles(accent, radius, dark);
    var card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "group");
    root.appendChild(styleEl);
    root.appendChild(card);

    function renderPicker() {
      card.setAttribute("aria-label", t.pickTitle);
      var tiles = ORDER.map(function (id) {
        var p = PROVIDERS[id];
        return '<button class="tile" type="button" data-provider="' + id + '"><span class="glyph">' + p.logo + "</span><span>" + p.label + "</span>" + CHEV + "</button>";
      }).join("");
      card.innerHTML =
        '<div class="hd">' + LOCK_SVG + "<span>" + t.pickTitle + "</span></div>" +
        '<div class="sub">' + t.pickSub + "</div>" +
        '<div class="tiles">' + tiles + "</div>" +
        '<div class="brand">' + LOCK_SVG + "<span>" + t.poweredBy + "</span></div>";
      Array.prototype.forEach.call(card.querySelectorAll(".tile"), function (el) {
        el.addEventListener("click", function () {
          renderInput(el.getAttribute("data-provider"), true);
        });
      });
    }

    function renderInput(provider, showBack) {
      var p = PROVIDERS[provider];
      card.setAttribute("aria-label", fmt(t.title, { provider: p.label }));
      card.innerHTML =
        (showBack ? '<button class="back" type="button">' + t.back + "</button>" : "") +
        '<div class="prov"><span class="glyph">' + p.logo + "</span><span>" + fmt(t.title, { provider: p.label }) + "</span></div>" +
        '<div class="field"><input class="input" type="password" autocomplete="off" spellcheck="false" placeholder="' + (p.hint || t.placeholder) + '" aria-label="' + fmt(t.title, { provider: p.label }) + '"/></div>' +
        '<button class="btn submit" type="button">' + t.connect + "</button>" +
        '<div class="msg" role="status" aria-live="polite"></div>' +
        '<ul class="trust"><li>' + t.trust1 + "</li><li>" + t.trust2 + "</li><li>" + t.trust3 + "</li></ul>" +
        '<div class="brand">' + LOCK_SVG + "<span>" + t.poweredBy + "</span></div>";

      var backBtn = card.querySelector(".back");
      if (backBtn) backBtn.addEventListener("click", renderPicker);
      var input = card.querySelector(".input");
      var btn = card.querySelector(".submit");
      var msg = card.querySelector(".msg");
      input.focus();

      function setMsg(text, kind) {
        msg.textContent = text;
        msg.className = "msg" + (kind ? " " + kind : "");
      }

      function submit() {
        var key = input.value.trim();
        if (!key) {
          setMsg(t.enterKey, "err");
          input.focus();
          return;
        }
        if (!token) {
          setMsg(t.noToken, "err");
          return;
        }
        btn.disabled = true;
        btn.textContent = t.verifying;
        setMsg("");
        fetch(apiBase + "/api/widget/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationToken: token, apiKey: key, provider: provider }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { status: r.status, body: j };
            });
          })
          .then(function (res) {
            if (res.body && res.body.ok) {
              var n = res.body.availableModels && res.body.availableModels.length
                ? fmt(t.models, { n: res.body.availableModels.length })
                : "";
              setMsg(fmt(t.okMsg, { masked: res.body.masked }) + n, "ok");
              input.value = "";
              input.disabled = true;
              btn.disabled = true;
              btn.textContent = t.connected;
              if (backBtn) backBtn.style.display = "none";
              if (typeof opts.onSuccess === "function") opts.onSuccess(res.body);
            } else {
              var err = (res.body && res.body.error) || fmt(t.failed, { status: res.status });
              setMsg("✕ " + err, "err");
              btn.disabled = false;
              btn.textContent = t.retry;
              if (typeof opts.onError === "function") opts.onError(err);
            }
          })
          .catch(function (e) {
            setMsg("✕ " + fmt(t.netErr, { msg: e.message }), "err");
            btn.disabled = false;
            btn.textContent = t.retry;
            if (typeof opts.onError === "function") opts.onError(e.message);
          });
      }

      btn.addEventListener("click", submit);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") submit();
      });
    }

    if (fixedProvider) renderInput(fixedProvider, false);
    else renderPicker();
  }

  window.RelayPay = { mount: mount };
})();
