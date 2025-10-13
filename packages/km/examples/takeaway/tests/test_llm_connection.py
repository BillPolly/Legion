"""
Test LLM connection with ZAI/Anthropic API
"""

import os
from dotenv import load_dotenv
from anthropic import Anthropic


def test_simple_query():
    """Test basic LLM query"""
    # Load environment variables
    load_dotenv()

    # Initialize client with ZAI endpoint
    client = Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        base_url=os.getenv("ANTHROPIC_BASE_URL")
    )

    # Simple test query
    message = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
        max_tokens=100,
        messages=[
            {"role": "user", "content": "What is 2 + 2? Reply with just the number."}
        ]
    )

    response_text = message.content[0].text
    print(f"Response: {response_text}")

    # Check that we got a response
    assert response_text is not None
    assert len(response_text) > 0
    assert "4" in response_text

    print("✅ LLM connection test passed!")


def test_financial_query():
    """Test financial reasoning capability"""
    load_dotenv()

    client = Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        base_url=os.getenv("ANTHROPIC_BASE_URL")
    )

    # Financial question
    message = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": """Given:
- Revenue in 2022: $1,000,000
- Revenue in 2023: $1,200,000

What is the percent change from 2022 to 2023?
Reply with just the numerical answer (e.g., 0.20 for 20%)."""
            }
        ]
    )

    response_text = message.content[0].text
    print(f"Financial query response: {response_text}")

    # Check that we got a reasonable response
    assert response_text is not None
    assert any(x in response_text.lower() for x in ["0.2", "20%", "0.20", ".2"])

    print("✅ Financial reasoning test passed!")


if __name__ == "__main__":
    print("Testing LLM connection with ZAI/Anthropic API...\n")
    test_simple_query()
    print()
    test_financial_query()
    print("\n✅ All connection tests passed!")
