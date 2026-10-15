import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Firebase (Auth + Storage + Firestore all live under this project)
    firebase_project_id: str
    firebase_storage_bucket: str

    # Google Cloud / Vertex AI (for ADK agents) — same project as Firebase
    gcp_project_id: str
    gcp_region: str = "us-central1"

    

    # AI Backend strategy fields (used in logic below)
    ai_backend: str | None = None
    google_ai_studio_api_key: str | None = None

    # Free tier limits (BRD §4.1)
    free_tier_monthly_scan_limit: int = 5

    # Razorpay (billing — Phase 4)
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None

    # Plaid (US bank linking — Phase 3)
    plaid_client_id: str | None = None
    plaid_secret: str | None = None

    # Account Aggregator (India bank linking — Phase 3)
    aa_client_id: str | None = None
    aa_client_secret: str | None = None

    # Modern Pydantic V2 Configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",  # Ignores extraneous variables in .env without raising ValidationError
        env_file_encoding="utf-8",
    )


settings = Settings()

if settings.ai_backend == "ai_studio":
    # Free-tier stopgap for local dev before GCP billing is attached.
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "FALSE"
    if settings.google_ai_studio_api_key:
        os.environ["GOOGLE_API_KEY"] = settings.google_ai_studio_api_key
else:
    # Production default (vertex_ai) — every Gemini call routes through Vertex AI,
    # scoped to this GCP project's IAM/billing/data boundary.
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "TRUE"
    os.environ["GOOGLE_CLOUD_PROJECT"] = settings.gcp_project_id
    os.environ["GOOGLE_CLOUD_LOCATION"] = settings.gcp_region