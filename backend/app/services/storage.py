import uuid

import boto3
from botocore.config import Config

from app.core.config import settings


def _get_s3_client():
    kwargs: dict = {
        "region_name": settings.AWS_DEFAULT_REGION,
        "config": Config(signature_version="s3v4"),
    }
    if settings.S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    if settings.AWS_ACCESS_KEY_ID:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **kwargs)


def generate_s3_key(proposal_id: uuid.UUID, file_name: str) -> str:
    unique = uuid.uuid4().hex[:8]
    return f"proposals/{proposal_id}/{unique}_{file_name}"


def create_presigned_upload_url(s3_key: str) -> str:
    client = _get_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET_NAME,
            "Key": s3_key,
            "ServerSideEncryption": "aws:kms",
        },
        ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY,
    )


def create_presigned_download_url(s3_key: str) -> str:
    client = _get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
        ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY,
    )
