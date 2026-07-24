import json
import logging
import os
import time
import uuid
from typing import Any, Dict, Optional, Tuple

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")

DEFAULT_AZURE_API_VERSION = "2024-02-15-preview"
SUPPORTED_PROVIDERS = {"openai", "azure", "openrouter"}

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger("ai_insights_proxy")


def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS", "") or os.getenv("ALLOWED_ORIGIN", "")
    raw = raw.strip()
    if not raw:
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _is_origin_allowed(origin: str) -> bool:
    allowed = _allowed_origins()
    if "*" in allowed:
        return True
    if not origin:
        return True
    return origin in allowed


def _cors_headers(origin: str) -> Dict[str, str]:
    allowed = _allowed_origins()
    if "*" in allowed:
        access_origin = "*"
    elif origin in allowed:
        access_origin = origin
    else:
        access_origin = allowed[0]

    headers = {
        "Access-Control-Allow-Origin": access_origin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "600",
    }
    if access_origin != "*":
        headers["Vary"] = "Origin"
    return headers


def _request_id() -> str:
    incoming = (request.headers.get("X-Request-ID") or "").strip()
    if incoming:
        return incoming[:120]
    return str(uuid.uuid4())


def _log_event(event: str, request_id: str, **fields: Any) -> None:
    payload = {
        "event": event,
        "requestId": request_id,
        **fields,
    }
    logger.info(json.dumps(payload, default=str))


def _json_response(payload: Dict[str, Any], status: int = 200, request_id: str = ""):
    origin = request.headers.get("Origin", "")
    response = jsonify(payload)
    response.status_code = status
    for key, value in _cors_headers(origin).items():
        response.headers[key] = value
    if request_id:
        response.headers["X-Request-ID"] = request_id
    return response


def _error_response(
    request_id: str,
    status: int,
    message: str,
    error_code: str,
    details: Optional[Dict[str, Any]] = None,
):
    payload: Dict[str, Any] = {
        "ok": False,
        "error": message,
        "errorCode": error_code,
        "requestId": request_id,
    }
    if details:
        payload["details"] = details
    return _json_response(payload, status, request_id)


def _json_object_payload(request_id: str):
    payload = request.get_json(silent=True)
    if payload is None:
        return None, _error_response(
            request_id,
            400,
            "Request body must be valid JSON.",
            "INVALID_JSON",
        )
    if not isinstance(payload, dict):
        return None, _error_response(
            request_id,
            400,
            "Request JSON must be an object.",
            "INVALID_PAYLOAD",
        )
    return payload, None


def _api_key_for_provider(provider: str) -> str:
    if provider == "openrouter":
        return os.getenv("OPENROUTER_API_KEY", "").strip()
    if provider == "azure":
        return os.getenv("AZURE_OPENAI_API_KEY", "").strip()
    return os.getenv("OPENAI_API_KEY", "").strip()


def _required_key_name(provider: str) -> str:
    if provider == "openrouter":
        return "OPENROUTER_API_KEY"
    if provider == "azure":
        return "AZURE_OPENAI_API_KEY"
    return "OPENAI_API_KEY"


def _provider_label(provider: str) -> str:
    if provider == "openrouter":
        return "OpenRouter"
    if provider == "azure":
        return "Azure OpenAI"
    return "OpenAI"


def _build_messages(prompt: str):
    return [
        {
            "role": "system",
            "content": "You are a UK GP appraisal writing assistant. Return strict JSON only, no markdown fences.",
        },
        {
            "role": "user",
            "content": prompt,
        },
    ]


def _build_provider_request(payload: Dict[str, Any], prompt: str) -> Tuple[str, Dict[str, str], Dict[str, Any], str, str]:
    provider = str(payload.get("provider", "openai")).strip() or "openai"
    endpoint = str(payload.get("endpoint", "")).strip()
    model = str(payload.get("model", "")).strip()
    api_version = str(payload.get("apiVersion", "")).strip() or DEFAULT_AZURE_API_VERSION
    deployment_name = str(payload.get("deploymentName", "")).strip()
    site_url = str(payload.get("siteUrl", "")).strip()
    app_name = str(payload.get("appName", "")).strip()

    if provider not in SUPPORTED_PROVIDERS:
        raise ValueError("Unsupported provider requested.")
    if not endpoint:
        raise ValueError("API endpoint is required.")
    if provider in {"openai", "openrouter"} and not model:
        raise ValueError("Model name is required for the selected provider.")

    api_key = _api_key_for_provider(provider)
    if not api_key:
        required_name = _required_key_name(provider)
        raise ValueError(f"Server missing {required_name} environment variable.")

    messages = _build_messages(prompt)
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    request_url = endpoint
    body: Dict[str, Any] = {}

    if provider == "azure":
        clean_endpoint = endpoint.rstrip("/")
        if deployment_name and "/deployments/" not in clean_endpoint:
            request_url = (
                f"{clean_endpoint}/openai/deployments/{requests.utils.quote(deployment_name, safe='')}/chat/completions"
            )
        else:
            request_url = clean_endpoint

        if "api-version=" not in request_url:
            separator = "&" if "?" in request_url else "?"
            request_url = f"{request_url}{separator}api-version={requests.utils.quote(api_version, safe='')}"

        headers["api-key"] = api_key
        body = {
            "temperature": 0.3,
            "messages": messages,
        }
    elif provider == "openrouter":
        headers["Authorization"] = f"Bearer {api_key}"
        if site_url:
            headers["HTTP-Referer"] = site_url
        if app_name:
            headers["X-Title"] = app_name
        body = {
            "model": model,
            "temperature": 0.3,
            "messages": messages,
        }
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        body = {
            "model": model,
            "temperature": 0.3,
            "messages": messages,
        }

    return request_url, headers, body, provider, model


def _call_provider(payload: Dict[str, Any], prompt: str, request_id: str) -> Dict[str, Any]:
    request_url, headers, body, provider, model = _build_provider_request(payload, prompt)

    start = time.monotonic()
    _log_event("upstream.request.start", request_id, provider=provider, model=model, endpoint=request_url)

    try:
        response = requests.post(request_url, headers=headers, json=body, timeout=45)
    except requests.RequestException as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        _log_event("upstream.request.network_error", request_id, provider=provider, durationMs=duration_ms, error=str(exc))
        raise RuntimeError(f"Network request failed: {exc}") from exc

    duration_ms = int((time.monotonic() - start) * 1000)

    if not response.ok:
        snippet = (response.text or "").strip()[:400]
        _log_event(
            "upstream.request.http_error",
            request_id,
            provider=provider,
            status=response.status_code,
            durationMs=duration_ms,
        )
        return {
            "ok": False,
            "status": response.status_code,
            "error": f"Upstream request failed ({response.status_code}): {snippet}",
        }

    try:
        data = response.json()
    except ValueError:
        _log_event("upstream.response.invalid_json", request_id, provider=provider, durationMs=duration_ms)
        return {
            "ok": False,
            "status": 502,
            "error": "Upstream response was not valid JSON.",
        }

    message = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not message:
        _log_event("upstream.response.missing_message", request_id, provider=provider, durationMs=duration_ms)
        return {
            "ok": False,
            "status": 502,
            "error": "Upstream response did not include model content.",
        }

    _log_event("upstream.request.success", request_id, provider=provider, durationMs=duration_ms)
    return {
        "ok": True,
        "provider": provider,
        "providerLabel": _provider_label(provider),
        "model": model,
        "message": message,
    }


def _reject_disallowed_origin(request_id: str):
    origin = request.headers.get("Origin", "")
    if _is_origin_allowed(origin):
        return None

    _log_event("request.rejected.origin", request_id, origin=origin)
    return _json_response(
        {
            "ok": False,
            "error": "Request origin is not allowed.",
            "errorCode": "ORIGIN_NOT_ALLOWED",
            "requestId": request_id,
        },
        403,
        request_id,
    )


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    request_id = _request_id()
    if request.method == "OPTIONS":
        return _json_response({"ok": True}, request_id=request_id)

    blocked = _reject_disallowed_origin(request_id)
    if blocked:
        return blocked

    return _json_response(
        {
            "ok": True,
            "service": "ai-insights-proxy",
            "requestId": request_id,
            "allowedOrigins": _allowed_origins(),
        },
        request_id=request_id,
    )


@app.route("/api/test-connection", methods=["POST", "OPTIONS"])
def test_connection():
    request_id = _request_id()
    if request.method == "OPTIONS":
        return _json_response({"ok": True}, request_id=request_id)

    blocked = _reject_disallowed_origin(request_id)
    if blocked:
        return blocked

    payload, error = _json_object_payload(request_id)
    if error:
        return error

    provider = str(payload.get("provider", "openai")).strip() or "openai"
    _log_event("api.test_connection.start", request_id, provider=provider)

    try:
        result = _call_provider(payload, "Reply with exactly CONNECTION_OK and no other text.", request_id)
    except ValueError as exc:
        _log_event("api.test_connection.validation_error", request_id, provider=provider, error=str(exc))
        return _error_response(request_id, 400, str(exc), "VALIDATION_ERROR")
    except RuntimeError as exc:
        _log_event("api.test_connection.runtime_error", request_id, provider=provider, error=str(exc))
        return _error_response(request_id, 502, str(exc), "UPSTREAM_NETWORK_ERROR")

    if not result.get("ok"):
        _log_event("api.test_connection.failed", request_id, provider=provider, error=result.get("error", "unknown"))
        return _error_response(
            request_id,
            result.get("status", 502),
            result.get("error", "Unknown error"),
            "UPSTREAM_ERROR",
        )

    _log_event("api.test_connection.success", request_id, provider=provider)
    return _json_response(
        {
            "ok": True,
            "provider": result.get("provider"),
            "providerLabel": result.get("providerLabel"),
            "model": result.get("model"),
            "requestId": request_id,
        },
        request_id=request_id,
    )


@app.route("/api/generate", methods=["POST", "OPTIONS"])
def generate():
    request_id = _request_id()
    if request.method == "OPTIONS":
        return _json_response({"ok": True}, request_id=request_id)

    blocked = _reject_disallowed_origin(request_id)
    if blocked:
        return blocked

    payload, error = _json_object_payload(request_id)
    if error:
        return error

    prompt = str(payload.get("prompt", "")).strip()
    provider = str(payload.get("provider", "openai")).strip() or "openai"

    if not prompt:
        return _error_response(request_id, 400, "Prompt is required.", "PROMPT_REQUIRED")

    _log_event("api.generate.start", request_id, provider=provider)

    try:
        result = _call_provider(payload, prompt, request_id)
    except ValueError as exc:
        _log_event("api.generate.validation_error", request_id, provider=provider, error=str(exc))
        return _error_response(request_id, 400, str(exc), "VALIDATION_ERROR")
    except RuntimeError as exc:
        _log_event("api.generate.runtime_error", request_id, provider=provider, error=str(exc))
        return _error_response(request_id, 502, str(exc), "UPSTREAM_NETWORK_ERROR")

    if not result.get("ok"):
        _log_event("api.generate.failed", request_id, provider=provider, error=result.get("error", "unknown"))
        return _error_response(
            request_id,
            result.get("status", 502),
            result.get("error", "Unknown error"),
            "UPSTREAM_ERROR",
        )

    _log_event("api.generate.success", request_id, provider=provider)
    return _json_response(
        {
            "ok": True,
            "provider": result.get("provider"),
            "providerLabel": result.get("providerLabel"),
            "model": result.get("model"),
            "message": result.get("message"),
            "requestId": request_id,
        },
        request_id=request_id,
    )


@app.route("/", methods=["GET"])
def root():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:path>", methods=["GET"])
def static_files(path: str):
    file_path = os.path.join(BASE_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, path)
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=False)
