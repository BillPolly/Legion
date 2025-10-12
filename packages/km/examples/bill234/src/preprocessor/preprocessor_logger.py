"""
MongoDB Logger for Document Preprocessing

Logs all document preprocessing runs with prompts, responses, and extracted knowledge bases.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from pymongo import MongoClient


class PreprocessorLogger:
    """
    Logs document preprocessing runs to MongoDB.

    Collection: document_preprocessing

    Document structure:
    {
        example_id: str,
        run_timestamp: datetime,
        prompt: str,
        llm_response: str,
        knowledge_base: dict,
        usage: {input_tokens, output_tokens, ...},
        error: str (optional)
    }
    """

    def __init__(
        self,
        mongo_uri: Optional[str] = None,
        database: str = "convfinqa",
        collection: str = "document_preprocessing"
    ):
        """
        Initialize the preprocessor logger.

        Args:
            mongo_uri: MongoDB connection string (default: from MONGO_URI env var)
            database: Database name (default: "convfinqa")
            collection: Collection name (default: "document_preprocessing")
        """
        # Load .env from project root
        project_root = Path(__file__).parent.parent.parent
        load_dotenv(dotenv_path=project_root / ".env")

        if mongo_uri is None:
            mongo_uri = os.getenv('MONGO_URI')
            if not mongo_uri:
                raise ValueError("MONGO_URI environment variable not set")

        self.client = MongoClient(mongo_uri)
        self.db = self.client[database]
        self.collection = self.db[collection]

    def log_preprocessing(
        self,
        example_id: str,
        prompt: str,
        llm_response: str,
        knowledge_base: Dict[str, Any],
        usage: Dict[str, Any],
        error: Optional[str] = None
    ) -> None:
        """
        Log a preprocessing run for an example.

        Args:
            example_id: The example ID being preprocessed
            prompt: The full prompt sent to the LLM
            llm_response: The raw response from the LLM
            knowledge_base: The parsed knowledge base dictionary
            usage: Token usage information
            error: Optional error message if preprocessing failed
        """
        document = {
            "example_id": example_id,
            "run_timestamp": datetime.utcnow(),
            "prompt": prompt,
            "llm_response": llm_response,
            "knowledge_base": knowledge_base,
            "usage": usage
        }

        if error:
            document["error"] = error

        self.collection.insert_one(document)

    def close(self) -> None:
        """Close MongoDB connection."""
        self.client.close()
