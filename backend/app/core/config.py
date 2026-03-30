from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Clargate"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://clargate:clargate_dev@localhost:5432/clargate"
    DATABASE_URL_SYNC: str = "postgresql://clargate:clargate_dev@localhost:5432/clargate"
    DB_HOST: str | None = None
    DB_PORT: int = 5432
    DB_NAME: str = "clargate"
    DB_USER: str | None = None
    DB_PASSWORD: str | None = None

    S3_ENDPOINT_URL: str | None = None
    S3_BUCKET_NAME: str = "clargate-documents"
    S3_PRESIGNED_URL_EXPIRY: int = 900  # 15 minutes

    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_DEFAULT_REGION: str = "us-east-1"

    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_JWKS_URL: str | None = None
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_JWT_ISSUER: str | None = None

    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    SES_SENDER_EMAIL: str = "noreply@clargate.com"
    SES_REGION: str = "us-east-1"

    REMINDER_DEFAULT_DAYS: int = 7
    RENEWAL_REMINDER_DAYS: int = 60

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()


def build_database_urls() -> None:
    """
    If DATABASE_URL / DATABASE_URL_SYNC are not explicitly set, allow ECS/CDK to pass
    DB_HOST/DB_USER/DB_PASSWORD and compose connection strings at runtime.
    """
    if settings.DATABASE_URL and settings.DATABASE_URL_SYNC:
        return
    if not (settings.DB_HOST and settings.DB_USER and settings.DB_PASSWORD):
        return

    settings.DATABASE_URL = (
        f"postgresql+asyncpg://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )
    settings.DATABASE_URL_SYNC = (
        f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}"
        f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    )


build_database_urls()
