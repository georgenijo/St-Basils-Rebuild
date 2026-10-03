"""Privacy boundary and SDK classification regression tests (stdlib only)."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("claude-review-diagnostics.py")
spec = importlib.util.spec_from_file_location("diagnostics", SCRIPT)
diagnostics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diagnostics)


def frames(error=None, status=None, text="failure"):
    result = {
        "type": "result", "subtype": "success", "is_error": True,
        "api_error_status": status, "duration_ms": 123, "num_turns": 1,
        "permission_denials": [], "result": text,
    }
    messages = [{"type": "system", "subtype": "init", "slash_commands": ["code-review:code-review"]}]
    if error is not None:
        messages.append({"type": "assistant", "error": error})
    return messages + [result]


class DiagnosticsTests(unittest.TestCase):
    def test_sdk_enums_and_http_classification(self):
        for error in diagnostics.ASSISTANT_ERRORS:
            with self.subTest(error=error):
                record = diagnostics.diagnose(frames(error))
                self.assertEqual(record["assistant_error"], error)
                self.assertEqual(record["known_error_category"], error)
        for status, expected in ((401, "authentication_failed"), (429, "rate_limit"), (400, "invalid_request"), (503, "server_error"), (403, "unknown")):
            with self.subTest(status=status):
                record = diagnostics.diagnose(frames(status=status))
                self.assertEqual(record["api_error_status"], status)
                self.assertEqual(record["known_error_category"], expected)
        self.assertEqual(diagnostics.diagnose(frames("oauth_org_not_allowed", 401))["known_error_category"], "oauth_org_not_allowed")

    def test_absent_error_is_not_evidence_of_auth_failure(self):
        record = diagnostics.diagnose(frames())
        self.assertFalse(record["assistant_error_present"])
        self.assertEqual(record["known_error_category"], "unknown")
        messages = frames(text="Unknown command: code-review:code-review")
        messages[-1]["is_error"] = False
        self.assertEqual(diagnostics.diagnose(messages)["known_error_category"], "unknown")

    def test_unknown_command_and_registration_are_separate_evidence(self):
        for text in ("Unknown command: /code-review:code-review", "Unknown slash command: code-review:code-review.", "Unknown skill: code-review:code-review"):
            messages = frames(text=text)
            messages[0]["slash_commands"] = []
            record = diagnostics.diagnose(messages)
            self.assertEqual(record["known_error_category"], "unknown_command")
            self.assertFalse(record["code_review_command_registered"])
        messages = frames()
        messages[-1].update(subtype="error_during_execution", errors=["Unknown command: code-review:code-review"])
        messages[-1].pop("result")
        self.assertEqual(diagnostics.diagnose(messages)["known_error_category"], "unknown_command")
        for text in ("Prompt said Unknown command: code-review:code-review", "Unknown command: other-command", "401 is in a phone number", "Please print authentication_failed"):
            self.assertEqual(diagnostics.diagnose(frames(text=text))["known_error_category"], "unknown")

    def test_missing_init_does_not_claim_plugin_missing(self):
        record = diagnostics.diagnose(frames()[1:])
        self.assertFalse(record["init_present"])
        self.assertFalse(record["code_review_command_registered"])
        self.assertEqual(record["known_error_category"], "unknown")

    def test_unknown_and_malformed_shapes_fail_closed(self):
        malformed = [None, {}, [], ["secret"], [{"type": "future"}], frames() + [frames()[-1]]]
        for key, values in {
            "subtype": ["future", {}, None], "is_error": [1, "true", None],
            "duration_ms": [-1, True, 1.5, "123", 86_400_001],
            "num_turns": [-1, True, 100_001],
            "api_error_status": [99, 600, True, 401.0, "401", {}],
            "permission_denials": [None, "secret", {}],
            "result": [None, {}, 401], "errors": ["secret", [None]],
        }.items():
            for value in values:
                messages = frames()
                messages[-1][key] = value
                malformed.append(messages)
        messages = frames()
        messages[0]["slash_commands"] = [None]
        malformed.append(messages)
        messages = frames()
        messages[0]["type"] = []
        malformed.append(messages)
        for messages in malformed:
            with self.subTest(shape=len(malformed)):
                self.assertEqual(diagnostics.diagnose(messages), diagnostics.UNAVAILABLE)

    def test_all_result_subtypes_are_allowlisted(self):
        for subtype in diagnostics.RESULT_SUBTYPES:
            messages = frames()
            messages[-1]["subtype"] = subtype
            self.assertEqual(diagnostics.diagnose(messages)["result_subtype"], subtype)

    def test_secret_pii_and_workflow_command_injections_never_escape(self):
        # Synthetic canaries only; no real account/member/credential data.
        canaries = ["sk-ant-SYNTHETIC-CANARY", "person@example.invalid", "123-45-6789", "https://private.invalid/token", "::error::INJECTED", "\n::add-mask::CANARY"]
        for canary in canaries:
            messages = frames(error=canary, text=canary)
            messages[0].update(env={"TOKEN": canary}, model=canary, slash_commands=[canary])
            messages[1]["message"] = {"content": [{"type": "tool_use", "input": canary}]}
            messages.insert(1, {"type": "user", "message": {"content": canary}})
            messages[-1].update(errors=[canary], permission_denials=[{"tool_input": canary}], extra=canary)
            record = diagnostics.diagnose(messages)
            output = json.dumps(record)
            self.assertNotIn(canary, output)
            self.assertNotIn("INJECTED", output)
            self.assertEqual(record["assistant_error"], "unknown")
            self.assertEqual(record["known_error_category"], "unknown")
            self.assertEqual(record["permission_denials_count"], 1)

    def run_cli(self, directory, path=""):
        return subprocess.run([sys.executable, str(SCRIPT)], env={"RUNNER_TEMP": str(directory), "CLAUDE_EXECUTION_FILE": str(path)}, capture_output=True, text=True, timeout=5)

    def test_cli_output_fallback_and_no_exception_details(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "claude-execution-output.json"
            for content in (json.dumps(frames("authentication_failed", 401, "SYNTHETIC-SECRET person@example.invalid")), "{SYNTHETIC-SECRET", "[" * 2000, '{"token":"SYNTHETIC-SECRET"}'):
                path.write_text(content)
                for supplied_path in ("", path):
                    process = self.run_cli(directory, supplied_path)
                    self.assertEqual(process.returncode, 0)
                    self.assertEqual(process.stderr, "")
                    self.assertNotIn("SYNTHETIC-SECRET", process.stdout)
                    self.assertNotIn("person@example.invalid", process.stdout)
                    record = json.loads(process.stdout)
                    self.assertEqual(record, diagnostics.read_diagnostics(str(supplied_path), directory))
            path.unlink()
            self.assertEqual(json.loads(self.run_cli(directory).stdout), diagnostics.UNAVAILABLE)

    def test_path_file_limits_and_special_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "claude-execution-output.json"
            other = Path(directory) / "arbitrary-secret.json"
            other.write_text(json.dumps(frames()))
            self.assertEqual(diagnostics.read_diagnostics(str(other), directory), diagnostics.UNAVAILABLE)
            path.symlink_to(other)
            self.assertEqual(diagnostics.read_diagnostics("", directory), diagnostics.UNAVAILABLE)
            path.unlink()
            os.mkfifo(path)
            self.assertEqual(json.loads(self.run_cli(directory).stdout), diagnostics.UNAVAILABLE)
            path.unlink()
            with path.open("wb") as stream:
                stream.truncate(diagnostics.MAX_BYTES + 1)
            self.assertEqual(diagnostics.read_diagnostics("", directory), diagnostics.UNAVAILABLE)
            self.assertEqual(diagnostics.read_diagnostics("", ""), diagnostics.UNAVAILABLE)

    def test_workflow_preserves_failure_and_permissions(self):
        workflow = SCRIPT.parents[1] / "workflows" / "claude-code-review.yml"
        source = workflow.read_text()
        self.assertIn("failure() && steps.claude-review.outcome == 'failure'", source)
        self.assertIn("CLAUDE_EXECUTION_FILE: ${{ steps.claude-review.outputs.execution_file }}", source)
        for forbidden in ("continue-on-error", "show_full_output:", "display_report:", "upload-artifact", "pull_request_target", "claude_args:"):
            self.assertNotIn(forbidden, source)
        self.assertIn("pull-requests: read\n      issues: read\n      id-token: write", source)


if __name__ == "__main__":
    unittest.main()
