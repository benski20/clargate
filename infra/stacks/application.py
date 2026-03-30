from aws_cdk import (
    Stack,
    Duration,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_rds as rds,
    aws_s3 as s3,
    aws_kms as kms,
    aws_certificatemanager as acm,
    aws_secretsmanager as secretsmanager,
    aws_logs as logs,
)
from constructs import Construct


class ApplicationStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        vpc: ec2.Vpc,
        rds: rds.DatabaseInstance,
        bucket: s3.Bucket,
        kms_key: kms.Key,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        cluster = ecs.Cluster(
            self, "ClarGateCluster", vpc=vpc, container_insights_v2=ecs.ContainerInsights.ENABLED
        )

        db_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "DBSecret", "clargate/database"
        )
        supabase_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "SupabaseSecret", "clargate/supabase-service-key"
        )
        openai_secret = secretsmanager.Secret.from_secret_name_v2(
            self, "OpenAISecret", "clargate/openai-api-key"
        )

        task_def = ecs.FargateTaskDefinition(
            self,
            "ApiTaskDef",
            memory_limit_mib=1024,
            cpu=512,
        )

        container = task_def.add_container(
            "ApiContainer",
            image=ecs.ContainerImage.from_asset("../backend"),
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix="clargate-api",
                log_retention=logs.RetentionDays.THIRTY_DAYS,
                mode=ecs.AwsLogDriverMode.NON_BLOCKING,
            ),
            environment={
                "S3_BUCKET_NAME": bucket.bucket_name,
                "AWS_DEFAULT_REGION": self.region,
                "CORS_ORIGINS": '["https://clargate.com","https://www.clargate.com"]',
            },
            secrets={
                "DATABASE_URL": ecs.Secret.from_secrets_manager(db_secret, "url"),
                "SUPABASE_JWT_SECRET": ecs.Secret.from_secrets_manager(
                    supabase_secret, "jwt_secret"
                ),
                "SUPABASE_SERVICE_KEY": ecs.Secret.from_secrets_manager(
                    supabase_secret, "service_key"
                ),
                "OPENAI_API_KEY": ecs.Secret.from_secrets_manager(openai_secret),
            },
            health_check=ecs.HealthCheck(
                command=["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""],
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                retries=3,
            ),
        )

        container.add_port_mappings(ecs.PortMapping(container_port=8000))

        service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self,
            "ApiService",
            cluster=cluster,
            task_definition=task_def,
            desired_count=2,
            task_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            public_load_balancer=True,
            listener_port=443,
        )

        service.target_group.configure_health_check(
            path="/health",
            healthy_http_codes="200",
            interval=Duration.seconds(30),
        )

        scaling = service.service.auto_scale_task_count(
            min_capacity=2, max_capacity=10
        )
        scaling.scale_on_cpu_utilization(
            "CpuScaling", target_utilization_percent=70
        )

        bucket.grant_read_write(task_def.task_role)
        kms_key.grant_decrypt(task_def.task_role)
        rds.connections.allow_from(
            service.service, ec2.Port.tcp(5432), "ECS to RDS"
        )
