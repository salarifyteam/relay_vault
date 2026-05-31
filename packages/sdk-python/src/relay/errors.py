"""Relay API errors — mirrors the TypeScript SDK's RelayError.

Branch on ``code`` (stable identifier), not ``message`` (human, may change).
"""

from __future__ import annotations

import json
from typing import Optional


class RelayError(Exception):
    """Raised on a non-2xx Relay API response.

    Attributes mirror the server error body ``{error:{message,code,doc_url,request_id}}``.
    """

    def __init__(
        self,
        message: str,
        status: int,
        *,
        code: Optional[str] = None,
        request_id: Optional[str] = None,
        doc_url: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.request_id = request_id
        self.doc_url = doc_url

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return f"RelayError(status={self.status}, code={self.code!r}, message={self.message!r})"


def error_from_response(status: int, body_bytes: bytes, header_request_id: Optional[str]) -> RelayError:
    """Build a RelayError from a raw response body + the X-Relay-Request-Id header.

    Parses ``{error:{message,code,doc_url,request_id}}`` when present; falls back to a
    generic message for non-JSON bodies. Header request id wins, else the body's.
    """
    message = f"Relay request failed (HTTP {status})"
    code = None
    doc_url = None
    body_request_id = None
    try:
        parsed = json.loads(body_bytes.decode("utf-8"))
        err = parsed.get("error") if isinstance(parsed, dict) else None
        if isinstance(err, dict):
            if err.get("message"):
                message = err["message"]
            code = err.get("code")
            doc_url = err.get("doc_url")
            body_request_id = err.get("request_id")
    except Exception:
        # non-JSON body — keep the generic message
        pass
    return RelayError(
        message,
        status,
        code=code,
        request_id=header_request_id or body_request_id,
        doc_url=doc_url,
    )
