"""Relay Python SDK — BYOK AI infrastructure.

Mirrors the TypeScript SDK. Relay is an OpenAI-compatible proxy, so chat/embeddings go
through the official ``openai`` package via ``Relay.openai``; the Relay-specific call is
``Relay.create_registration_token``.
"""

from .client import Relay, RegistrationToken, Health
from .errors import RelayError

__all__ = ["Relay", "RelayError", "RegistrationToken", "Health"]
__version__ = "0.1.0"
