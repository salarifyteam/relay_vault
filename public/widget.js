(function () {
  var script = document.currentScript;
  var DEFAULT_BASE = script
    ? new URL(script.src).origin
    : window.location.origin;

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "style") e.setAttribute("style", attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function mount(selector, opts) {
    opts = opts || {};
    var container =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector;
    if (!container) {
      console.error("[RelayPay] container not found:", selector);
      return;
    }
    var apiBase = opts.apiBase || DEFAULT_BASE;
    var provider = opts.provider || "openai";
    var token = opts.registrationToken;

    container.innerHTML = "";
    var wrap = el("div", {
      style:
        "font-family:system-ui;max-width:380px;border:1px solid #e5e7eb;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)",
    });
    var title = el(
      "div",
      { style: "font-weight:600;font-size:16px;margin-bottom:4px" },
      ["🔒 " + provider.toUpperCase() + " 키 연결"]
    );
    var input = el("input", {
      type: "password",
      placeholder: "sk-...",
      style:
        "width:100%;box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:8px;margin:12px 0;font-family:monospace",
    });
    var btn = el(
      "button",
      {
        style:
          "width:100%;padding:10px;background:#111827;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:14px",
      },
      ["키 연결하기"]
    );
    var msg = el("div", {
      style: "margin-top:12px;font-size:13px;min-height:18px",
    });
    var trust = el(
      "ul",
      {
        style:
          "margin:14px 0 0;padding-left:18px;color:#6b7280;font-size:12px;line-height:1.7",
      },
      [
        el("li", {}, [
          "이 키는 이 앱이 아니라 Relay가 암호화해 보관합니다",
        ]),
        el("li", {}, [
          "앱 서버는 키 원문을 볼 수 없어요",
        ]),
        el("li", {}, ["언제든 연결 해제 가능"]),
      ]
    );
    var brand = el(
      "div",
      {
        style:
          "margin-top:14px;font-size:11px;color:#9ca3af;text-align:right",
      },
      ["🛡 Powered by Relay → " + apiBase]
    );

    btn.onclick = function () {
      var key = input.value.trim();
      if (!key) {
        msg.style.color = "#dc2626";
        msg.textContent = "키를 입력하세요.";
        return;
      }
      if (!token) {
        msg.style.color = "#dc2626";
        msg.textContent = "registrationToken이 없습니다.";
        return;
      }
      btn.disabled = true;
      btn.textContent = "검증 중...";
      msg.textContent = "";
      fetch(apiBase + "/api/widget/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationToken: token, apiKey: key }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (res.body && res.body.ok) {
            var n =
              res.body.availableModels && res.body.availableModels.length
                ? " · 사용 가능 모델 " + res.body.availableModels.length + "개"
                : "";
            msg.style.color = "#059669";
            msg.textContent =
              "✅ 연결됨 (" +
              res.body.masked +
              ")" +
              n +
              " — 이 앱은 원문을 못 봅니다.";
            input.value = "";
            input.disabled = true;
            btn.textContent = "연결 완료";
          } else {
            msg.style.color = "#dc2626";
            msg.textContent =
              "❌ " +
              ((res.body && res.body.error) ||
                "실패 (HTTP " + res.status + ")");
            btn.disabled = false;
            btn.textContent = "다시 시도";
          }
        })
        .catch(function (e) {
          msg.style.color = "#dc2626";
          msg.textContent = "❌ 네트워크 오류: " + e.message;
          btn.disabled = false;
          btn.textContent = "다시 시도";
        });
    };

    wrap.appendChild(title);
    wrap.appendChild(input);
    wrap.appendChild(btn);
    wrap.appendChild(msg);
    wrap.appendChild(trust);
    wrap.appendChild(brand);
    container.appendChild(wrap);
  }

  window.RelayPay = { mount: mount };
})();
