from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_kms as kms,
    aws_cloudtrail as cloudtrail,
    aws_s3 as s3,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct


class SecurityStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs) -> None:
        super().__init__(scope, id, **kwargs)

        self.kms_key = kms.Key(
            self,
            "ClarGateCMK",
            alias="alias/clargate",
            enable_key_rotation=True,
            description="Clargate customer-managed encryption key",
        )

        trail_bucket = s3.Bucket(
            self,
            "CloudTrailBucket",
            encryption=s3.BucketEncryption.KMS,
            encryption_key=self.kms_key,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.RETAIN,
            enforce_ssl=True,
        )

        cloudtrail.Trail(
            self,
            "ClarGateTrail",
            bucket=trail_bucket,
            encryption_key=self.kms_key,
            is_multi_region_trail=False,
            include_global_service_events=True,
            send_to_cloud_watch_logs=True,
        )

        secretsmanager.Secret(
            self,
            "DatabaseCredentials",
            secret_name="clargate/database",
            description="RDS database credentials",
            encryption_key=self.kms_key,
        )

        secretsmanager.Secret(
            self,
            "SupabaseServiceKey",
            secret_name="clargate/supabase-service-key",
            description="Supabase service role key",
            encryption_key=self.kms_key,
        )

        secretsmanager.Secret(
            self,
            "OpenAIApiKey",
            secret_name="clargate/openai-api-key",
            description="OpenAI API key for AI features",
            encryption_key=self.kms_key,
        )
