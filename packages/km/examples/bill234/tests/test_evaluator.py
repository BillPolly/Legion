"""
Tests for ConvFinQA evaluator
"""

import pytest
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from evaluator import str_to_num, compare_answers, evaluate


class TestStrToNum:
    """Test string-to-number conversion with flexible formatting"""

    def test_already_number(self):
        assert str_to_num(123) == 123.0
        assert str_to_num(45.67) == 45.67

    def test_simple_string(self):
        assert str_to_num("123") == 123.0
        assert str_to_num("45.67") == 45.67

    def test_with_commas(self):
        assert str_to_num("1,000") == 1000.0
        assert str_to_num("1,234,567.89") == 1234567.89

    def test_percentages(self):
        assert str_to_num("10%") == 0.1
        assert str_to_num("50%") == 0.5
        assert str_to_num("100%") == 1.0

    def test_special_constants(self):
        assert str_to_num("const_100") == 100.0
        assert str_to_num("const_1000") == 1000.0
        assert str_to_num("const_m1") == -1.0

    def test_invalid_inputs(self):
        assert str_to_num("abc") == "n/a"
        assert str_to_num("$$$") == "n/a"


class TestCompareAnswers:
    """Test answer comparison with 5 decimal precision"""

    def test_exact_match(self):
        assert compare_answers(100, 100) == True
        assert compare_answers("100", "100") == True

    def test_format_differences(self):
        # Same value, different formats
        assert compare_answers("1,000", 1000) == True
        assert compare_answers("10%", 0.1) == True

    def test_precision_rounding(self):
        # Should round to 5 decimals
        assert compare_answers(0.14136, 0.141359999) == True
        assert compare_answers(0.14136, 0.14137) == False

    def test_mismatch(self):
        assert compare_answers(100, 200) == False
        assert compare_answers(2022, 2014) == False

    def test_yes_no_strings(self):
        assert compare_answers("yes", "yes") == True
        assert compare_answers("no", "no") == True
        assert compare_answers("yes", "no") == False

    def test_invalid_values(self):
        assert compare_answers("abc", 100) == False
        assert compare_answers(100, "xyz") == False


class TestEvaluate:
    """Test full evaluation pipeline"""

    @pytest.fixture
    def sample_ground_truth(self):
        return [
            {
                "id": "test_1",
                "dialogue": {
                    "conv_questions": [
                        "What was revenue in 2010?",
                        "What was it in 2009?",
                        "What was the change?",
                        "What was the percent change?"
                    ],
                    "executed_answers": [
                        206588.0,
                        181001.0,
                        25587.0,
                        0.14136
                    ]
                }
            },
            {
                "id": "test_2",
                "dialogue": {
                    "conv_questions": [
                        "What were revenues in 2008?",
                        "What were they in 2007?"
                    ],
                    "executed_answers": [
                        9362.2,
                        9244.9
                    ]
                }
            }
        ]

    def test_perfect_predictions(self, sample_ground_truth):
        predictions = {
            "test_1": {
                "turns": [206588.0, 181001.0, 25587.0, 0.14136]
            },
            "test_2": {
                "turns": [9362.2, 9244.9]
            }
        }

        results = evaluate(sample_ground_truth, predictions)

        assert results["turn_accuracy"] == 1.0
        assert results["conversation_accuracy"] == 1.0
        assert results["correct_turns"] == 6
        assert results["total_turns"] == 6
        assert results["perfect_conversations"] == 2
        assert results["total_conversations"] == 2

    def test_partial_correct(self, sample_ground_truth):
        predictions = {
            "test_1": {
                "turns": [206588.0, 181001.0, 25587.0, 0.99999]  # Last one wrong
            },
            "test_2": {
                "turns": [9362.2, 9244.9]  # All correct
            }
        }

        results = evaluate(sample_ground_truth, predictions)

        assert results["turn_accuracy"] == 5/6  # 5 out of 6 correct
        assert results["conversation_accuracy"] == 0.5  # 1 out of 2 perfect
        assert results["correct_turns"] == 5
        assert results["perfect_conversations"] == 1

    def test_wrong_answer_from_question(self, sample_ground_truth):
        """Test the actual error from the dataset: 2014 instead of 2041"""
        # Simulate: question asks "what is 2031 + 10?"
        # Correct answer: 2041
        # Dataset has: 2014 (wrong!)

        gt = [{
            "id": "test_bad_data",
            "dialogue": {
                "conv_questions": ["what is that value plus 10?"],
                "executed_answers": [2014]  # Wrong in dataset
            }
        }]

        predictions = {
            "test_bad_data": {
                "turns": [2041]  # Our correct answer
            }
        }

        results = evaluate(gt, predictions)

        # This should fail - our correct answer doesn't match wrong dataset
        assert results["turn_accuracy"] == 0.0
        assert results["correct_turns"] == 0

    def test_missing_predictions(self, sample_ground_truth):
        predictions = {
            "test_1": {
                "turns": [206588.0, 181001.0, 25587.0, 0.14136]
            }
            # test_2 missing
        }

        results = evaluate(sample_ground_truth, predictions)

        assert len(results["errors"]) == 1
        assert results["errors"][0]["id"] == "test_2"

    def test_wrong_number_of_turns(self, sample_ground_truth):
        predictions = {
            "test_1": {
                "turns": [206588.0, 181001.0]  # Only 2 instead of 4
            },
            "test_2": {
                "turns": [9362.2, 9244.9]
            }
        }

        results = evaluate(sample_ground_truth, predictions)

        assert len(results["errors"]) == 1
        assert "Expected 4 turns, got 2" in results["errors"][0]["error"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
