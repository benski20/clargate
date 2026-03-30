import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import ai, audit, messages, proposals, reviews, users
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered IRB platform API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(proposals.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
