"""
MongoDB Logger for ConvFinQA Evaluation

Logs all evaluation runs to MongoDB for analysis and debugging.
One document per example, automatically replaces on rerun.
"""

import os
from datetime import datetime
from typing import Dict, Any, Optional
from pymongo import MongoClient
from dotenv import load_dotenv


class ConvFinQALogger:
    """
    Logger for ConvFinQA evaluation runs.

    Schema: One document per example with all turns and evaluation data.
    """

    def __init__(self, mongo_uri: str = None, database: str = "convfinqa", collection: str = "evaluation_runs"):
        """
        Initialize MongoDB logger.

        Args:
            mongo_uri: MongoDB connection string (defaults to env var)
            database: Database name
            collection: Collection name
        """
        load_dotenv()

        self.mongo_uri = mongo_uri or os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[database]
        self.collection = self.db[collection]

        # Create index on example_id for faster queries
        self.collection.create_index("example_id")
        self.collection.create_index("run_timestamp")
        self.collection.create_index("summary.accuracy")

    def start_example(self, example_id: str, table: Dict) -> None:
        """
        Start logging a new example.
        Deletes any existing record for this example (for clean reruns).

        Args:
            example_id: Unique identifier for the example
            table: Table data from preprocessed document
        """
        # Delete existing record
        self.collection.delete_one({"_id": example_id})

        # Insert new record
        self.collection.insert_one({
            "_id": example_id,
            "example_id": example_id,
            "run_timestamp": datetime.utcnow(),
            "table": table,
            "conversation_turns": [],
            "summary": {}
        })

    def log_turn(
        self,
        example_id: str,
        turn_number: int,
        question: str,
        gold_answer: Any,
        stage0_data: Optional[Dict] = None,
        stage1_data: Optional[Dict] = None,
        stage2_data: Optional[Dict] = None,
        evaluation: Optional[Dict] = None
    ) -> None:
        """
        Log a single conversation turn.

        Args:
            example_id: Example identifier
            turn_number: Turn number (0-indexed)
            question: Question text
            gold_answer: Expected answer
            stage0_data: Stage 0 rewriting data (original, rewritten, changes)
            stage1_data: Stage 1 analysis data (prompt, response, hints)
            stage2_data: Stage 2 answer data (prompt, response, answer)
            evaluation: Evaluation results (correct, predicted, expected)
        """
        turn_data = {
            "turn_number": turn_number,
            "question": question,
            "gold_answer": gold_answer
        }

        if stage0_data:
            turn_data["stage0_rewrite"] = stage0_data

        if stage1_data:
            turn_data["stage1_analysis"] = stage1_data

        if stage2_data:
            turn_data["stage2_answer"] = stage2_data

        if evaluation:
            turn_data["evaluation"] = evaluation

        # Append turn to conversation
        self.collection.update_one(
            {"_id": example_id},
            {"$push": {"conversation_turns": turn_data}}
        )

    def update_turn(
        self,
        example_id: str,
        turn_number: int,
        update_data: Dict
    ) -> None:
        """
        Update specific fields in a turn (e.g., add stage2 data after stage1).

        Args:
            example_id: Example identifier
            turn_number: Turn number to update
            update_data: Dictionary of fields to update
        """
        # Build update for specific array element
        update_fields = {
            f"conversation_turns.{turn_number}.{key}": value
            for key, value in update_data.items()
        }

        self.collection.update_one(
            {"_id": example_id},
            {"$set": update_fields}
        )

    def finalize_example(
        self,
        example_id: str,
        summary: Dict[str, Any]
    ) -> None:
        """
        Finalize example with summary statistics.

        Args:
            example_id: Example identifier
            summary: Summary dict with accuracy, correct_turns, etc.
        """
        self.collection.update_one(
            {"_id": example_id},
            {"$set": {"summary": summary}}
        )

    def get_example(self, example_id: str) -> Optional[Dict]:
        """Get logged data for an example."""
        return self.collection.find_one({"_id": example_id})

    def get_failures(self, min_accuracy: float = 1.0) -> list:
        """
        Get all examples with accuracy below threshold.

        Args:
            min_accuracy: Minimum accuracy threshold (default 1.0 = only failures)

        Returns:
            List of example documents
        """
        return list(self.collection.find({
            "summary.accuracy": {"$lt": min_accuracy}
        }))

    def get_turn_failures(self) -> list:
        """Get all individual turn failures."""
        return list(self.collection.find({
            "conversation_turns.evaluation.correct": False
        }))

    def close(self):
        """Close MongoDB connection."""
        self.client.close()


if __name__ == "__main__":
    # Quick test
    logger = ConvFinQALogger()

    # Test logging
    logger.start_example(
        "test_example_1",
        table={"2009": {"revenue": 1000}, "2008": {"revenue": 900}},
        pre_text="Test pre text",
        post_text="Test post text"
    )

    logger.log_turn(
        "test_example_1",
        turn_number=0,
        question="What was revenue in 2009?",
        gold_answer=1000,
        stage1_data={"question_type": "table_lookup"},
        stage2_data={"answer": 1000},
        evaluation={"correct": True, "predicted": 1000, "expected": 1000}
    )

    logger.finalize_example(
        "test_example_1",
        summary={"total_turns": 1, "correct_turns": 1, "accuracy": 1.0}
    )

    # Retrieve
    example = logger.get_example("test_example_1")
    print("Logged example:")
    print(f"  ID: {example['_id']}")
    print(f"  Turns: {len(example['conversation_turns'])}")
    print(f"  Accuracy: {example['summary']['accuracy']}")

    logger.close()
    print("\n✅ MongoDB logger test passed!")
