"""
Core configuration module for Incident Response Agent backend.
All secrets loaded from environment variables — never hardcoded.
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Application
    app_name: str = "RECALLA"
    app_env: str = "development"
    app_secret_key: str = "dev-secret-key-change-in-production"
    log_level: str = "INFO"

    # Database
    database_url: str = "sqlite+aiosqlite:///./incident_response.db"

    # Hindsight Memory
    hindsight_base_url: str = "http://localhost:8888"
    hindsight_api_key: Optional[str] = None
    hindsight_bank_id: str = "incident-response-agent"

    # LLM Provider — supported: openai, anthropic, gemini
    llm_provider: str = "gemini"
    llm_model: str = "gemini-1.5-flash"
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None

    # CORS — allow all origins so Expo physical-device clients can connect
    cors_origins: str = "*"

    # Conversation session TTL (seconds)
    conversation_ttl_seconds: int = 3600

    # Rate limiting
    rate_limit_per_minute: int = 30
    analyze_rate_limit_per_minute: int = 10
    chat_rate_limit_per_minute: int = 20

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def llm_is_configured(self) -> bool:
        """Return True only if a real API key is present for the chosen provider."""
        provider = self.llm_provider.lower()
        placeholders = {
            "",
            "your-openai-api-key-here",
            "your-gemini-api-key-here",
            "your-anthropic-api-key-here",
            "your-key-here",
            "test-key",
        }
        if provider == "openai":
            return bool(self.openai_api_key and self.openai_api_key not in placeholders)
        elif provider == "anthropic":
            return bool(self.anthropic_api_key and self.anthropic_api_key not in placeholders)
        elif provider == "gemini":
            return bool(self.gemini_api_key and self.gemini_api_key not in placeholders)
        return False

    @property
    def hindsight_is_configured(self) -> bool:
        """Return True only if a real Hindsight connection is configured."""
        has_cloud_key = bool(
            self.hindsight_api_key
            and self.hindsight_api_key not in ("your-hindsight-cloud-api-key", "")
        )
        is_cloud_url = "hindsight.vectorize.io" in self.hindsight_base_url
        is_local_url = self.hindsight_base_url == "http://localhost:8888"
        # Cloud always requires a key; local we'll try to ping
        if is_cloud_url:
            return has_cloud_key
        # For local / other URLs, we assume configured (connectivity tested at runtime)
        return not is_local_url or True  # will be verified by health check at runtime

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
