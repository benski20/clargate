from aws_cdk import (
    Stack,
    RemovalPolicy,
    Duration,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_s3 as s3,
    aws_kms as kms,
)
from constructs import Construct


class DataStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        vpc: ec2.Vpc,
        kms_key: kms.Key,
        **kwargs,
    ) -> None:
        super().__init__(scope, id, **kwargs)

        db_sg = ec2.SecurityGroup(
            self, "DatabaseSG", vpc=vpc, description="RDS security group"
        )

        self.rds_instance = rds.DatabaseInstance(
            self,
            "ClarGateDB",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_16
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MEDIUM
            ),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_ISOLATED
            ),
            security_groups=[db_sg],
            database_name="clargate",
            storage_encrypted=True,
            storage_encryption_key=kms_key,
            multi_az=False,
            allocated_storage=50,
            max_allocated_storage=200,
            backup_retention=Duration.days(14),
            deletion_protection=True,
            removal_policy=RemovalPolicy.RETAIN,
        )

        self.document_bucket = s3.Bucket(
            self,
            "DocumentBucket",
            bucket_name=f"clargate-documents-{self.account}",
            encryption=s3.BucketEncryption.KMS,
            encryption_key=kms_key,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            versioned=True,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.RETAIN,
        )
