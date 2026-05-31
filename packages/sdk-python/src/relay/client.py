"""Relay client — mirrors the TypeScript SDK (packages/sdk).

Relay is an OpenAI-compatible proxy, so chat/embeddings are handled by the official
``openai`` package via :meth:`Relay.openai`. The only Relay-specific HTTP call is
:meth:`Relay.create_registration_token`.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Any, Optional, TYPE_CHECKING

from .errors import error_from_response

if TYPE_CHECKING:  # pragma: no cover - typing only
    from openai import OpenAI

DEFAULT_BASE_URL = "https://vault.relayservice.im"


@dataclass
class RegistrationToken:
    registration_token: str
    expires_at: str
    submit_url: str


@dataclass
class Health:
    status: str
    db: str


class Relay:
    """Relay tenant client.

    :param key: your Relay key (``rly_...``)
    :param base_url: override the default ``https://vault.relayservice.im`` (tests/self-host)
    """

    def __init__(self, key: str, base_url: str = DEFAULT_BASE_URL) -> None:
        if not key:
            raise ValueError("Relay: 'key' is required (your rly_ key)")
        self.key = key
        self.base_url = base_url.rstrip("/")

    # ── internal HTTP (only for the two tiny Relay-specific calls) ──
    def _request(self, method: str, path: str, body: Optional[dict] = None, *, auth: bool = True) -> Any:
        url = f"{self.base_url}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        if auth:
            headers["Authorization"] = f"Bearer {self.key}"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body_bytes = e.read()
            request_id = e.headers.get("X-Relay-Request-Id")
            raise error_from_response(e.code, body_bytes, request_id) from None

    def create_registration_token(self, user: str, provider: Optional[str] = None) -> RegistrationToken:
        """Issue a single-use token so an end-user can connect their key (call from your backend).

        :param user: the end-user's id label (e.g. ``"alice"``)
        :param provider: optional; omit to let the end-user pick in the widget
        """
        if not user:
            raise ValueError("Relay: 'user' is required")
        payload: dict = {"endUserLabel": user}
        if provider is not None:
            payload["provider"] = provider
        data = self._request("POST", "/v1/registration-tokens", payload)
        return RegistrationToken(
            registration_token=data["registrationToken"],
            expires_at=data["expiresAt"],
            submit_url=data["submitUrl"],
        )

    def openai(self, user: str, paid: bool = True) -> "OpenAI":
        """Return an official ``openai.OpenAI`` client pre-bound to an end-user.

        ``base_url`` and the Relay headers (Authorization, X-Relay-User[, X-Relay-Paid]) are
        pre-set, so you just call ``client.chat.completions.create(...)`` /
        ``client.embeddings.create(...)`` as usual.

        :param user: the end-user's id label (X-Relay-User)
        :param paid: set False for a free-tier end-user key (X-Relay-Paid). Defaults to paid.
        """
        if not user:
            raise ValueError("Relay: 'user' is required for openai()")
        try:
            from openai import OpenAI
        except ImportError as e:  # pragma: no cover - dependency guard
            raise ImportError("Relay.openai() needs the 'openai' package — pip install openai") from e

        default_headers = {"X-Relay-User": user}
        # server treats only "false" as free → send the header only when opting out
        if paid is False:
            default_headers["X-Relay-Paid"] = "false"
        return OpenAI(
            api_key=self.key,
            base_url=f"{self.base_url}/v1",
            default_headers=default_headers,
        )

    def health(self) -> Health:
        """Service status (no auth). Note: /api/health is outside the /v1 rewrite."""
        data = self._request("GET", "/api/health", auth=False)
        return Health(status=data.get("status", ""), db=data.get("db", ""))
