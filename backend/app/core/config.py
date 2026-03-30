from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Clargate"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://clargate:clargate_dev@localhost:5432/clargate"
    DATABASE_URL_SYNC: str = "postgresql://clargate:clargate_dev@localhost:5432/clargate"

    S3_ENDPOINT_URL: str | None = None
    S3_BUCKET_NAME: str = "clargate-documents"
    S3_PRESIGNED_URL_EXPIRY: int = 900  # 15 minutes

    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_DEFAULT_REGION: str = "us-east-1"

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    SES_SENDER_EMAIL: str = "noreply@clargate.com"
    SES_REGION: str = "us-east-1"

    REMINDER_DEFAULT_DAYS: int = 7
    RENEWAL_REMINDER_DAYS: int = 60

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
