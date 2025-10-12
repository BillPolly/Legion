#!/usr/bin/env python3
"""Shared LLM client with MongoDB logging for all graph-solver components"""
import os
from datetime import datetime
from pymongo import MongoClient
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection (singleton)
try:
    mongo_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
    mongo_db = mongo_client['legion_tools']
    llm_logs = mongo_db['llm_interactions']
except Exception as e:
    print(f"Warning: MongoDB connection failed: {e}")
    llm_logs = None


def call_llm(prompt, metadata=None):
    """
    Call LLM with prompt and log to MongoDB

    Args:
        prompt: Full prompt string
        metadata: Dict with example_id, turn, question, phase, etc.
            Required fields: example_id, turn, question, phase
            Optional fields: resolved_question, values, formula, retrieved_values, etc.

    Returns:
        LLM response text
    """
    client = Anthropic(
        api_key=os.getenv("ANTHROPIC_API_KEY"),
        base_url=os.getenv("ANTHROPIC_BASE_URL")
    )

    response = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        max_tokens=4000,
        temperature=0,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = response.content[0].text

    # Log to MongoDB
    if llm_logs is not None:
        try:
            log_entry = {
                'timestamp': datetime.utcnow(),
                'stage': metadata.get('phase', 'semantic_query') if metadata else 'semantic_query',
                'prompt': prompt,
                'response': response_text,
                'metadata': metadata or {}
            }
            llm_logs.insert_one(log_entry)
        except Exception as e:
            print(f"Warning: Failed to log to MongoDB: {e}")

    return response_text
