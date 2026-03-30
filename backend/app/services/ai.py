import json
import logging
from collections.abc import AsyncGenerator
from pathlib import Path

from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text()


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def summarize_proposal(form_data: dict, title: str) -> dict:
    client = _get_client()
    system_prompt = _load_prompt("summarize_proposal")

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"Title: {title}\n\nForm Data:\n{json.dumps(form_data, indent=2)}",
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    return json.loads(response.choices[0].message.content)


async def draft_revision_letter(
    title: str,
    form_data: dict,
    reviewer_comments: list[dict],
    additional_instructions: str | None = None,
) -> str:
    client = _get_client()
    system_prompt = _load_prompt("draft_revision_letter")

    user_content = (
        f"Proposal Title: {title}\n\n"
        f"Reviewer Comments:\n{json.dumps(reviewer_comments, indent=2)}"
    )
    if additional_instructions:
        user_content += f"\n\nAdditional Instructions: {additional_instructions}"

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.4,
    )

    return response.choices[0].message.content


async def pi_assistant_stream(
    question: str,
    form_data: dict | None = None,
    section_context: str | None = None,
) -> AsyncGenerator[str, None]:
    client = _get_client()
    system_prompt = _load_prompt("pi_assistant")

    user_content = f"Question: {question}"
    if section_context:
        user_content = f"Current section: {section_context}\n\n{user_content}"
    if form_data:
        user_content += f"\n\nCurrent form data:\n{json.dumps(form_data, indent=2)}"

    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
