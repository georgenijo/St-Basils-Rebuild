"""Failure-only SDK diagnostics. Never serialize input or exception details.

Contract: claude-agent-sdk 0.3.288 sdk.d.ts SDKAssistantMessageError and
SDKResultMessage; claude-code-action execution-file.ts writes a JSON array.
Text classification is only a hint; structured SDK error/status takes priority.
"""

import json
import os
from pathlib import Path
import re
import stat

MAX_BYTES = 8 * 1024 * 1024
MAX_COUNT = 100_000
MAX_DURATION_MS = 86_400_000
UNAVAILABLE = {"diagnostic_status": "diagnostics_unavailable"}
ASSISTANT_ERRORS = frozenset(
    (
        "authentication_failed", "oauth_org_not_allowed", "account_on_hold",
        "verification_required", "billing_error", "rate_limit", "overloaded",
        "invalid_request", "model_not_found", "server_error", "unknown",
        "max_output_tokens", "cloud_credential_error",
    )
)
RESULT_SUBTYPES = frozenset(
    (
        "success", "error_during_execution", "error_max_turns",
        "error_max_budget_usd", "error_max_structured_output_retries",
    )
)


def bounded_int(value, maximum, minimum=0):
    # bool is an int subclass; coercing strings or floats would trust unknown data.
    return type(value) is int and minimum <= value <= maximum


def category(error, status, result):
    if error != "unknown":
        return error
    if status == 401:
        return "authentication_failed"
    if status == 429:
        return "rate_limit"
    if status == 400:
        return "invalid_request"
    if status is not None and status >= 500:
        return "server_error"
    if status is not None:
        return "unknown"
    # Only inspect the terminal error result, never prompts or assistant/tool text.
    # An anchored, exact command avoids classifying a quoted prompt as a failure.
    if re.fullmatch(
        r"Unknown (?:slash command|command|skill): /?code-review:code-review\.?",
        result.strip(), re.IGNORECASE,
    ):
        return "unknown_command"
    return "unknown"


def diagnose(messages):
    if not isinstance(messages, list) or not 0 < len(messages) <= MAX_COUNT:
        return UNAVAILABLE.copy()
    if any(not isinstance(m, dict) or m.get("type") not in ("system", "assistant", "user", "result") for m in messages):
        return UNAVAILABLE.copy()
    results = [m for m in messages if m["type"] == "result"]
    if len(results) != 1:
        return UNAVAILABLE.copy()
    result = results[0]
    subtype = result.get("subtype")
    if not isinstance(subtype, str) or subtype not in RESULT_SUBTYPES:
        return UNAVAILABLE.copy()
    if type(result.get("is_error")) is not bool:
        return UNAVAILABLE.copy()
    if not bounded_int(result.get("duration_ms"), MAX_DURATION_MS):
        return UNAVAILABLE.copy()
    if not bounded_int(result.get("num_turns"), MAX_COUNT):
        return UNAVAILABLE.copy()
    status = result.get("api_error_status")
    if status is not None and not bounded_int(status, 599, 100):
        return UNAVAILABLE.copy()
    denials = result.get("permission_denials")
    if not isinstance(denials, list) or len(denials) > MAX_COUNT:
        return UNAVAILABLE.copy()
    inits = [m for m in messages if m["type"] == "system" and m.get("subtype") == "init"]
    if len(inits) > 1:
        return UNAVAILABLE.copy()
    commands = inits[0].get("slash_commands") if inits else []
    if not isinstance(commands, list) or any(not isinstance(c, str) for c in commands):
        return UNAVAILABLE.copy()
    errors = [m["error"] for m in messages if m["type"] == "assistant" and "error" in m]
    if any(not isinstance(e, str) for e in errors):
        return UNAVAILABLE.copy()
    error = errors[-1] if errors and errors[-1] in ASSISTANT_ERRORS else "unknown"
    text = result.get("result", "")
    if not isinstance(text, str):
        return UNAVAILABLE.copy()
    result_errors = result.get("errors", [])
    if not isinstance(result_errors, list) or any(not isinstance(e, str) for e in result_errors):
        return UNAVAILABLE.copy()
    hint = category(error, status, text)
    if hint == "unknown":
        for entry in result_errors:
            hint = category(error, status, entry)
            if hint != "unknown":
                break
    # Every value below is constructed from a fixed enum, boolean or bounded int.
    return {
        "diagnostic_status": "available",
        "result_subtype": subtype,
        "result_is_error": result["is_error"],
        "api_error_status": status,
        "assistant_error_present": bool(errors),
        "assistant_error": error,
        "init_present": bool(inits),
        "code_review_command_registered": "code-review:code-review" in commands,
        "permission_denials_count": len(denials),
        "duration_ms": result["duration_ms"],
        "num_turns": result["num_turns"],
        "known_error_category": hint if result["is_error"] else "unknown",
    }


def read_diagnostics(execution_file, runner_temp):
    try:
        if not runner_temp:
            return UNAVAILABLE.copy()
        expected = Path(runner_temp).absolute() / "claude-execution-output.json"
        path = Path(execution_file).absolute() if execution_file else expected
        # Do not follow a supplied arbitrary path or read credentials elsewhere.
        if path != expected:
            return UNAVAILABLE.copy()
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_BYTES:
                return UNAVAILABLE.copy()
            data = stream.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            return UNAVAILABLE.copy()
        return diagnose(json.loads(data))
    except Exception:
        # Includes IO, encoding, JSON, recursion and schema errors. No traceback.
        return UNAVAILABLE.copy()


if __name__ == "__main__":
    print(json.dumps(read_diagnostics(os.environ.get("CLAUDE_EXECUTION_FILE"), os.environ.get("RUNNER_TEMP")), sort_keys=True))
