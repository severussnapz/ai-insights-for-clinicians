import os
import unittest
from unittest.mock import patch

from backend.app import app


class AppRoutesTestCase(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_health_ok(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["service"], "ai-insights-proxy")

    def test_generate_requires_prompt(self):
        response = self.client.post("/api/generate", json={})

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"], "Prompt is required.")

    def test_disallowed_origin_rejected(self):
        old_origins = os.environ.get("ALLOWED_ORIGINS")
        os.environ["ALLOWED_ORIGINS"] = "https://allowed.example"
        try:
            response = self.client.get("/health", headers={"Origin": "https://blocked.example"})
            self.assertEqual(response.status_code, 403)
            payload = response.get_json()
            self.assertFalse(payload["ok"])
            self.assertEqual(payload["error"], "Request origin is not allowed.")
        finally:
            if old_origins is None:
                os.environ.pop("ALLOWED_ORIGINS", None)
            else:
                os.environ["ALLOWED_ORIGINS"] = old_origins

    @patch("backend.app._call_provider")
    def test_generate_success_shape(self, mock_call_provider):
        mock_call_provider.return_value = {
            "ok": True,
            "provider": "openai",
            "providerLabel": "OpenAI",
            "model": "gpt-4o-mini",
            "message": "{\"suggestedEntrySummary\":\"ok\"}",
        }

        response = self.client.post(
            "/api/generate",
            json={
                "prompt": "Generate a reflection.",
                "provider": "openai",
                "endpoint": "https://api.openai.com/v1/chat/completions",
                "model": "gpt-4o-mini",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["provider"], "openai")
        self.assertIn("requestId", payload)


if __name__ == "__main__":
    unittest.main()
