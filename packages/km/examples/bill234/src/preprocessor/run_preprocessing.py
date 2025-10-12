"""
Script to preprocess ConvFinQA dataset.

This script extracts structured knowledge bases from financial documents,
creating an augmented dataset that improves downstream solver performance.

Usage:
  # Preprocess entire dataset
  uv run python src/preprocessor/run_preprocessing.py

  # Preprocess single example (by index, 0-indexed)
  uv run python src/preprocessor/run_preprocessing.py --example-num 11

  # Preprocess range
  uv run python src/preprocessor/run_preprocessing.py --start 0 --end 30

  # Output to custom path
  uv run python src/preprocessor/run_preprocessing.py --output data/my_preprocessed.json

  # Disable MongoDB logging
  uv run python src/preprocessor/run_preprocessing.py --no-logging
"""

import argparse
from pathlib import Path
from document_preprocessor import DocumentPreprocessor


def main():
    parser = argparse.ArgumentParser(
        description="Preprocess ConvFinQA dataset to extract structured knowledge bases"
    )
    parser.add_argument(
        '--data',
        type=str,
        default='../../data/convfinqa_dataset.json',
        help='Path to input ConvFinQA dataset JSON (default: ../../data/convfinqa_dataset.json)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='../../data/preprocessed_dataset.json',
        help='Path to output preprocessed dataset JSON (default: ../../data/preprocessed_dataset.json)'
    )
    parser.add_argument(
        '--start',
        type=int,
        default=0,
        help='Starting index for batch processing (default: 0)'
    )
    parser.add_argument(
        '--end',
        type=int,
        default=None,
        help='Ending index for batch processing (default: None = process to end)'
    )
    parser.add_argument(
        '--example-num',
        type=int,
        default=None,
        help='Process a single example by number (0-indexed, overrides --start and --end)'
    )
    parser.add_argument(
        '--no-logging',
        action='store_true',
        help='Disable MongoDB logging'
    )

    args = parser.parse_args()

    # Resolve paths relative to script location
    script_dir = Path(__file__).parent
    input_path = (script_dir / args.data).resolve()

    # If processing single example, default output to preprocessed/{num}.json
    if args.example_num is not None and args.output == '../../data/preprocessed_dataset.json':
        output_path = (script_dir / f"../../data/preprocessed/{args.example_num}.json").resolve()
    else:
        output_path = (script_dir / args.output).resolve()

    print("="*80)
    print("ConvFinQA Document Preprocessing")
    print("="*80)
    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print(f"Logging: {'Enabled' if not args.no_logging else 'Disabled'}")
    print("="*80)
    print()

    # Initialize preprocessor
    preprocessor = DocumentPreprocessor(enable_logging=not args.no_logging)

    try:
        if args.example_num is not None:
            # Single example mode by number
            print(f"Mode: Single example (index {args.example_num})")
            print()
            preprocessor.preprocess_single_by_index(
                input_path=str(input_path),
                example_index=args.example_num,
                output_path=str(output_path)
            )
        else:
            # Batch mode
            end_str = str(args.end) if args.end else "end"
            print(f"Mode: Batch processing (examples {args.start} to {end_str})")
            print()
            preprocessor.preprocess_dataset(
                input_path=str(input_path),
                output_path=str(output_path),
                start_idx=args.start,
                end_idx=args.end
            )
    finally:
        preprocessor.close()


if __name__ == "__main__":
    main()
