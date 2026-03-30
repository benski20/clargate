import logging
from pathlib import Path

import boto3
from jinja2 import Environment, FileSystemLoader

from app.core.config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent / "email_templates"
_jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)


def _get_ses_client():
    kwargs: dict = {"region_name": settings.SES_REGION}
    if settings.AWS_ACCESS_KEY_ID:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("ses", **kwargs)


async def send_email(
    to_email: str,
    subject: str,
    template_name: str,
    template_data: dict,
) -> bool:
    try:
        template = _jinja_env.get_template(f"{template_name}.html")
        html_body = template.render(**template_data)

        client = _get_ses_client()
        client.send_email(
            Source=settings.SES_SENDER_EMAIL,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Html": {"Data": html_body}},
            },
        )
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to_email)
        return False


async def send_submission_confirmation(to_email: str, pi_name: str, proposal_title: str) -> bool:
    return await send_email(
        to_email,
        f"Submission Received: {proposal_title}",
        "submission_confirmation",
        {"pi_name": pi_name, "proposal_title": proposal_title},
    )


async def send_reviewer_assignment(
    to_email: str, reviewer_name: str, proposal_title: str, proposal_id: str
) -> bool:
    return await send_email(
        to_email,
        f"New Review Assignment: {proposal_title}",
        "reviewer_assignment",
        {
            "reviewer_name": reviewer_name,
            "proposal_title": proposal_title,
            "proposal_id": proposal_id,
        },
    )


async def send_revision_request(
    to_email: str, pi_name: str, proposal_title: str, letter_content: str
) -> bool:
    return await send_email(
        to_email,
        f"Revisions Requested: {proposal_title}",
        "revision_request",
        {"pi_name": pi_name, "proposal_title": proposal_title, "letter_content": letter_content},
    )
