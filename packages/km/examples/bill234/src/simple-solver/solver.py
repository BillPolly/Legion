"""
ConvFinQA Solver using 3-Stage Approach

Stage 0: Question Rewriting → Resolve all ambiguity (pronouns, temporal refs)
Stage 1: Question Analysis → Extract structured hints
Stage 2: Answer Generation → Use hints to generate precise answers

All interactions logged to MongoDB for inspection and iteration.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Union
from dotenv import load_dotenv

from question_rewriter import QuestionRewriter
from question_analyzer import QuestionAnalyzer
from answer_generator import AnswerGenerator
from mongo_logger import ConvFinQALogger

# Add parent directory to path for evaluator import
sys.path.insert(0, str(Path(__file__).parent.parent))


class ConvFinQASolver:
    """
    3-stage solver for ConvFinQA questions.

    Stage 0: Rewrite question to resolve ambiguity
    Stage 1: Analyze question to extract structured hints
    Stage 2: Generate answer using hints

    All stages logged to MongoDB.
    """

    def __init__(
        self,
        mongo_uri: str = None,
        database: str = "convfinqa",
        collection: str = "evaluation_runs"
    ):
        """
        Initialize the 3-stage solver with MongoDB logging.

        Args:
            mongo_uri: MongoDB connection string
            database: Database name for logging
            collection: Collection name for logging
        """
        load_dotenv()

        # Initialize components
        self.rewriter = QuestionRewriter()
        self.analyzer = QuestionAnalyzer()
        self.generator = AnswerGenerator()

        # Initialize logger (always enabled)
        self.logger = ConvFinQALogger(
            mongo_uri=mongo_uri,
            database=database,
            collection=collection
        )


    def solve_conversation(
        self,
        record: Dict[str, Any],
        gold_answers: List[Union[float, str]],
        example_id: str = None
    ) -> Dict[str, List[Union[float, str]]]:
        """
        Solve a complete conversation from a ConvFinQA record.

        Args:
            record: Record with: id, questions, doc (table), knowledge_base
            gold_answers: Gold answers for evaluation only
            example_id: Optional example ID override (defaults to record["id"])

        Returns:
            Dictionary with:
            - "turns": List of answers for each turn
        """
        example_id = example_id or record["id"]
        table = record["doc"]["table"]
        knowledge_base = record.get("knowledge_base", None)
        questions = record["questions"]

        # Initialize logging for this example
        self.logger.start_example(
            example_id=example_id,
            table=table
        )

        conversation_history = []
        answers = []

        # Solve each turn
        for turn_idx, (question, gold_answer) in enumerate(zip(questions, gold_answers)):
            try:
                # Stage 0: Rewrite question to resolve ambiguity
                rewrite_result = self.rewriter.rewrite(
                    question=question,
                    table=table,
                    conversation_history=conversation_history,
                    knowledge_base=knowledge_base
                )

                rewritten_question = rewrite_result["rewritten_question"]

                # Stage 1: Analyze question
                analysis_result = self.analyzer.analyze(
                    question=rewritten_question,
                    table=table,
                    conversation_history=conversation_history,
                    knowledge_base=knowledge_base
                )

                hints = analysis_result["hints"]

                # Stage 2: Generate answer using hints
                generation_result = self.generator.generate(
                    question=rewritten_question,
                    table=table,
                    hints=hints,
                    conversation_history=conversation_history,
                    knowledge_base=knowledge_base
                )

                answer = generation_result["answer"]
                answers.append(answer)

                # Evaluate
                from evaluator import compare_answers
                is_correct = compare_answers(gold_answer, answer)

                # Log this turn
                self.logger.log_turn(
                    example_id=example_id,
                    turn_number=turn_idx,
                    question=question,
                    gold_answer=gold_answer,
                    stage0_data={
                        "original_question": question,
                        "rewritten_question": rewritten_question,
                        "changes_made": rewrite_result["changes_made"],
                        "prompt": rewrite_result["prompt"],
                        "response": rewrite_result["response"],
                        "usage": rewrite_result["usage"]
                    },
                    stage1_data={
                        "prompt": analysis_result["prompt"],
                        "response": analysis_result["response"],
                        "hints": hints,
                        "usage": analysis_result["usage"]
                    },
                    stage2_data={
                        "prompt": generation_result["prompt"],
                        "response": generation_result["response"],
                        "answer": answer,
                        "usage": generation_result["usage"]
                    },
                    evaluation={
                        "correct": is_correct,
                        "predicted": answer,
                        "expected": gold_answer
                    }
                )

                # Add to history for next turn (use ORIGINAL question for conversational context)
                conversation_history.append({
                    "question": question,
                    "answer": answer
                })

            except Exception as e:
                print(f"Error answering question '{question}': {e}")

                # Log error
                self.logger.log_turn(
                    example_id=example_id,
                    turn_number=turn_idx,
                    question=question,
                    gold_answer=gold_answer,
                    evaluation={
                        "correct": False,
                        "predicted": None,
                        "expected": gold_answer,
                        "error": str(e)
                    }
                )

                # Append NaN to maintain alignment
                answers.append(float('nan'))
                conversation_history.append({
                    "question": question,
                    "answer": "ERROR"
                })

        # Finalize example with summary
        from evaluator import compare_answers
        correct_turns = sum(
            1 for pred, gold in zip(answers, gold_answers)
            if not (isinstance(pred, float) and pred != pred)  # Not NaN
            and compare_answers(gold, pred)
        )
        total_turns = len(gold_answers)
        accuracy = correct_turns / total_turns if total_turns > 0 else 0

        self.logger.finalize_example(
            example_id=example_id,
            summary={
                "total_turns": total_turns,
                "correct_turns": correct_turns,
                "accuracy": accuracy,
                "all_correct": accuracy == 1.0
            }
        )

        return {"turns": answers}

    def close(self):
        """Close MongoDB connection."""
        self.logger.close()


if __name__ == "__main__":
    # Quick test with example 4 (the problematic one)
    load_dotenv()

    solver = ConvFinQASolver()

    # Sample from example 4
    test_record = {
        "id": "test_example_4",
        "doc": {
            "table": {
                "2004": {"ups": 100.00, "s&p_500": 100.00},
                "2005": {"ups": 89.49, "s&p_500": 104.91},
                "2006": {"ups": 91.06, "s&p_500": 121.48},
                "2007": {"ups": 87.88, "s&p_500": 128.16},
                "2008": {"ups": 70.48, "s&p_500": 80.74},
                "2009": {"ups": 75.95, "s&p_500": 102.11}
            },
            "pre_text": "",
            "post_text": ""
        },
        "dialogue": {
            "conv_questions": [
                "what was the fluctuation of the performance price of the ups from 2004 to 2006?",
                "and how much does this fluctuation represent in relation to that price in 2004?"
            ],
            "executed_answers": [-8.94, -0.0894]
        }
    }

    print("Testing 2-Stage Solver on Example 4")
    print("=" * 80)

    result = solver.solve_conversation(test_record)

    print("\nResults:")
    for i, (q, a, expected) in enumerate(zip(
        test_record["dialogue"]["conv_questions"],
        result["turns"],
        test_record["dialogue"]["executed_answers"]
    )):
        print(f"\nTurn {i+1}:")
        print(f"  Q: {q}")
        print(f"  A: {a}")
        print(f"  Expected: {expected}")
        print(f"  ✓" if abs(float(a) - expected) < 0.001 else f"  ✗")

    print("\n✅ Test completed! Check MongoDB for logged data.")
    solver.close()
