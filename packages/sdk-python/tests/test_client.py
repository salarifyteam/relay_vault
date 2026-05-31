"""Unit tests for the Relay Python SDK — no live server needed.

We stub urllib at the module boundary to capture the outgoing request and to inject
fake responses, mirroring the TS SDK's unit intent.
"""

from __future__ import annotations

import io
import json
import urllib.error
import pytest

from relay import Relay, RelayError
from relay.errors import error_from_response


# ── helpers: fake urlopen ──
class FakeResp:
    def __init__(self, payload: dict):
        self._data = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def make_http_error(status: int, body: dict, request_id: str | None = None):
    headers = {}
    if request_id:
        headers["X-Relay-Request-Id"] = request_id
    return urllib.error.HTTPError(
        url="http://x", code=status, msg="err", hdrs=headers,  # type: ignore[arg-type]
        fp=io.BytesIO(json.dumps(body).encode("utf-8")),
    )


# ── constructor ──
def test_requires_key():
    with pytest.raises(ValueError):
        Relay(key="")


def test_base_url_trailing_slash_stripped():
    r = Relay(key="rly_test_x", base_url="http://localhost:3000/")
    assert r.base_url == "http://localhost:3000"


# ── create_registration_token: outgoing request shape ──
def test_create_registration_token_sends_correct_request(monkeypatch):
    captured = {}

    def fake_urlopen(req):
        captured["url"] = req.full_url
        captured["method"] = req.get_method()
        captured["headers"] = {k.lower(): v for k, v in req.header_items()}
        captured["body"] = json.loads(req.data.decode("utf-8"))
        return FakeResp({"registrationToken": "rgt-abc", "expiresAt": "2026-01-01T00:00:00Z", "submitUrl": "http://x/submit"})

    monkeypatch.setattr("relay.client.urllib.request.urlopen", fake_urlopen)

    r = Relay(key="rly_live_secret", base_url="http://localhost:3000")
    tok = r.create_registration_token(user="alice", provider="openai")

    assert captured["method"] == "POST"
    assert captured["url"] == "http://localhost:3000/v1/registration-tokens"
    assert captured["headers"]["authorization"] == "Bearer rly_live_secret"
    assert captured["headers"]["content-type"] == "application/json"
    assert captured["body"] == {"endUserLabel": "alice", "provider": "openai"}
    # response parsed into dataclass (snake_case)
    assert tok.registration_token == "rgt-abc"
    assert tok.submit_url == "http://x/submit"


def test_create_registration_token_omits_provider_when_absent(monkeypatch):
    captured = {}

    def fake_urlopen(req):
        captured["body"] = json.loads(req.data.decode("utf-8"))
        return FakeResp({"registrationToken": "rgt-1", "expiresAt": "t", "submitUrl": "u"})

    monkeypatch.setattr("relay.client.urllib.request.urlopen", fake_urlopen)
    Relay(key="rly_test_x").create_registration_token(user="bob")
    assert captured["body"] == {"endUserLabel": "bob"}  # no provider key


def test_create_registration_token_requires_user():
    with pytest.raises(ValueError):
        Relay(key="rly_test_x").create_registration_token(user="")


# ── error parsing ──
def test_http_error_becomes_relay_error_with_code(monkeypatch):
    def fake_urlopen(req):
        raise make_http_error(
            401,
            {"error": {"message": "Unknown or revoked Relay key", "code": "relay_key_revoked", "doc_url": "https://x/docs#relay_key_revoked", "request_id": "req-9"}},
            request_id="req-9",
        )

    monkeypatch.setattr("relay.client.urllib.request.urlopen", fake_urlopen)
    with pytest.raises(RelayError) as ei:
        Relay(key="rly_live_bad").create_registration_token(user="alice")
    e = ei.value
    assert e.status == 401
    assert e.code == "relay_key_revoked"
    assert e.message == "Unknown or revoked Relay key"
    assert e.doc_url == "https://x/docs#relay_key_revoked"
    assert e.request_id == "req-9"


def test_error_from_response_non_json_keeps_default():
    e = error_from_response(502, b"<html>bad gateway</html>", None)
    assert e.status == 502
    assert "HTTP 502" in e.message
    assert e.code is None


def test_error_from_response_falls_back_to_body_request_id():
    e = error_from_response(429, json.dumps({"error": {"message": "slow", "code": "rate_limit_exceeded", "request_id": "body-req"}}).encode(), None)
    assert e.request_id == "body-req"
    assert e.code == "rate_limit_exceeded"


# ── health ──
def test_health_no_auth(monkeypatch):
    captured = {}

    def fake_urlopen(req):
        captured["url"] = req.full_url
        captured["has_auth"] = any(k.lower() == "authorization" for k, _ in req.header_items())
        return FakeResp({"status": "ok", "db": "up"})

    monkeypatch.setattr("relay.client.urllib.request.urlopen", fake_urlopen)
    h = Relay(key="rly_test_x", base_url="http://localhost:3000").health()
    assert captured["url"] == "http://localhost:3000/api/health"
    assert captured["has_auth"] is False  # health is unauthenticated
    assert h.status == "ok"
    assert h.db == "up"


# ── openai() factory (skip if openai not installed) ──
def test_openai_factory_sets_headers_and_base_url():
    openai = pytest.importorskip("openai")
    r = Relay(key="rly_live_k", base_url="http://localhost:3000")
    client = r.openai(user="alice")
    assert isinstance(client, openai.OpenAI)
    assert str(client.base_url).rstrip("/") == "http://localhost:3000/v1"
    # default header X-Relay-User present, X-Relay-Paid absent (paid defaults True)
    assert client.default_headers.get("X-Relay-User") == "alice"
    assert "X-Relay-Paid" not in client.default_headers


def test_openai_factory_paid_false_adds_header():
    pytest.importorskip("openai")
    client = Relay(key="rly_live_k").openai(user="alice", paid=False)
    assert client.default_headers.get("X-Relay-Paid") == "false"


def test_openai_requires_user():
    with pytest.raises(ValueError):
        Relay(key="rly_test_x").openai(user="")
