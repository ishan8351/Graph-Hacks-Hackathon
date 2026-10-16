"""
Active Engineering Memory Layer - Custom Fake Microservice Gateway
===================================================================
Provides deterministic, zero-external-dependency mock responses simulating
real enterprise banking microservice endpoints and breaking API deprecations.

Architectural Purpose:
Simulates real-world operational failure scenarios (e.g. HTTP 410 Gone on legacy auth,
and silent webhook drops on batch transactions) to test multi-agent reasoning,
self-healing procedural edge rerouting (Graph Stigmergy), and active guardrails.
"""

from typing import Any, Dict, Optional


class DeprecatedAPIError(Exception):
    """
    Raised when an operational agent or client attempts to invoke a discontinued endpoint.
    Conveys explicit HTTP 410 status and machine-readable migration advice.
    """

    def __init__(
        self,
        message: str = "Endpoint /v1/legacy-auth is discontinued. Migrate to /v3/oauth/token",
        status_code: int = 410,
        error_code: str = "HTTP_410_GONE",
        recommended_replacement: str = "/v3/oauth/token",
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.recommended_replacement = recommended_replacement

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status_code,
            "error": self.error_code,
            "message": self.message,
            "recommended_replacement": self.recommended_replacement,
        }


class FakeMicroserviceGateway:
    """
    Deterministic enterprise microservice mock gateway.
    Never makes real external HTTP calls.
    """

    def call(
        self,
        endpoint: str,
        method: str = "POST",
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Dispatch a simulated HTTP request against enterprise mock microservices.

        Args:
            endpoint: Route path, e.g. '/v1/legacy-auth' or '/v3/oauth/token'.
            method: HTTP method (default: 'POST').
            payload: Optional request payload dictionary.

        Returns:
            Dictionary payload mimicking upstream microservice HTTP response.

        Raises:
            DeprecatedAPIError: For deprecated / shut down endpoints (HTTP 410).
            ValueError: For unrecognized or unmapped endpoints (HTTP 404).
        """
        norm_method = (method or "POST").upper()
        norm_endpoint = endpoint.rstrip("/") if endpoint.startswith("/") else f"/{endpoint.rstrip('/')}"

        # 1. Deprecated Legacy Auth
        if norm_method == "POST" and norm_endpoint == "/v1/legacy-auth":
            raise DeprecatedAPIError(
                message="Endpoint /v1/legacy-auth is discontinued. Migrate to /v3/oauth/token",
                status_code=410,
                error_code="HTTP_410_GONE",
                recommended_replacement="/v3/oauth/token",
            )

        # 2. Modern OAuth V3 Token
        elif norm_method == "POST" and norm_endpoint == "/v3/oauth/token":
            return {
                "status": 200,
                "token": "eyJ_mock_oauth_v3_token",
                "token_type": "Bearer",
                "expires_in": 3600,
                "latency_ms": 35,
            }

        # 3. Synchronous Single Charge (Healthy Workaround)
        elif norm_method == "POST" and norm_endpoint == "/v1/charge/sync":
            return {
                "status": 200,
                "tx_id": "tx_sync_99",
                "status_text": "SETTLED",
                "latency_ms": 450,
                "webhook_delivered": True,
            }

        # 4. Batch Charge (Catastrophic Production Bug)
        elif norm_method == "POST" and norm_endpoint == "/v2/charge/batch":
            return {
                "status": 502,
                "error": "BANK_WEBHOOK_DROPPED",
                "message": "Legacy bank gateway silently dropped settlement webhooks for batch size > 1",
            }

        # Unrecognized endpoint
        raise ValueError(f"Unrecognized endpoint: {norm_method} {norm_endpoint}")
