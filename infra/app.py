#!/usr/bin/env python3
import aws_cdk as cdk

from stacks.network import NetworkStack
from stacks.data import DataStack
from stacks.security import SecurityStack
from stacks.application import ApplicationStack

app = cdk.App()

env = cdk.Environment(region="us-east-1")

network = NetworkStack(app, "ClarGate-Network", env=env)
security = SecurityStack(app, "ClarGate-Security", env=env)
data = DataStack(
    app, "ClarGate-Data", vpc=network.vpc, kms_key=security.kms_key, env=env
)
application = ApplicationStack(
    app,
    "ClarGate-App",
    vpc=network.vpc,
    rds=data.rds_instance,
    bucket=data.document_bucket,
    kms_key=security.kms_key,
    env=env,
)

app.synth()
