#!/usr/bin/env python3
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "graph-solver"))
from semantic_stage import SemanticUnderstandingStage
from query_stage_llm import QueryStageLLM
from calculation_stage import CalculationStage
from rdflib import Graph as RDFGraph, Namespace

example_id = sys.argv[1]
data_file = Path(__file__).parent.parent / "data" / "convfinqa_dataset.json"
with open(data_file) as f:
    data = json.load(f)
all_examples = []
for split in ['train', 'dev', 'test']:
    if split in data:
        all_examples.extend(data[split])

example_data = all_examples[int(example_id)]
print(f"Example {example_id}: {example_data['id']}")
print("=" * 80)

data_dir = Path(__file__).parent.parent / "data" / "preprocessed"
graph_file = data_dir / f"{example_id}_kg.ttl"

# Build schema from ontology
rdf_graph = RDFGraph()
rdf_graph.parse(graph_file, format='turtle')
kg_ns = Namespace("http://example.org/convfinqa/")

extracted_metrics_with_props = []
financial_metrics = {'row_labels': set(), 'column_labels': set()}

for subj in rdf_graph.subjects(predicate=kg_ns.label):
    entity_type = rdf_graph.value(subj, predicate=kg_ns['type']) or list(rdf_graph.objects(subj, predicate=None))[0]
    if 'FinancialMetric' in str(entity_type):
        label = str(rdf_graph.value(subj, predicate=kg_ns.label))
        table_row = rdf_graph.value(subj, predicate=kg_ns.tableRow)
        table_col = rdf_graph.value(subj, predicate=kg_ns.tableColumn)
        has_year = rdf_graph.value(subj, predicate=kg_ns.forTimePeriod) is not None

        if table_row and table_col:
            financial_metrics['row_labels'].add(str(table_row))
            financial_metrics['column_labels'].add(str(table_col))
        elif not table_row and not table_col:
            extracted_metrics_with_props.append({'label': label, 'hasYear': has_year})

schema = {
    "entity_types": ["Company", "FinancialMetric", "Category", "Year"],
    "attribute_types": ["numericValue", "hasScale", "tableRow", "tableColumn"],
    "relationship_types": ["hasMetric", "hasValue", "forTimePeriod", "inCategory"],
    "sample_entities": {
        "extracted_metrics": [m['label'] + (' [has year]' if m['hasYear'] else ' [no year]') for m in extracted_metrics_with_props],
        "financial_metrics": {
            "row_labels": sorted(financial_metrics['row_labels']),
            "column_labels": sorted(financial_metrics['column_labels'])
        }
    }
}

stages = {
    'semantic': SemanticUnderstandingStage(),
    'query': QueryStageLLM(),
    'calc': CalculationStage()
}

questions = example_data['dialogue']['conv_questions']
gold_answers_str = example_data['dialogue']['executed_answers']

gold_answers = []
for ans_str in gold_answers_str:
    try:
        if '%' in ans_str:
            gold_answers.append(float(ans_str.replace('%', '')))
        else:
            gold_answers.append(float(ans_str))
    except:
        gold_answers.append(ans_str)

conversation_history = []
results = []
correct_count = 0

for turn_idx, question in enumerate(questions):
    turn_num = turn_idx + 1
    print(f"\nTurn {turn_num}: {question}")

    semantic_output = stages['semantic'].analyze_question(
        question=question, schema=schema, conversation_history=conversation_history,
        example_id=example_id, turn=turn_num
    )

    query_output = stages['query'].generate_and_execute(
        question=question, semantic_output=semantic_output, schema=schema,
        graph_file=str(graph_file), conversation_history=conversation_history,
        debug=False, example_id=example_id, turn=turn_num
    )

    calc_output = stages['calc'].calculate(
        semantic_output=semantic_output, query_results=query_output['raw_results'],
        conversation_history=conversation_history
    )

    our_answer = calc_output['answer']
    gold_answer = gold_answers[turn_idx]
    match = our_answer == gold_answer

    if match:
        correct_count += 1
        print(f"  ✓ {our_answer}")
    else:
        print(f"  ✗ Our: {our_answer} Gold: {gold_answer}")
        print(f"    Calc: {calc_output['calculation_type']}, Values: {calc_output['values_used']}")

    results.append({'turn': turn_num, 'match': match})

    result_value_object = calc_output.get('result_value_object')
    conversation_history.append({
        'question': question, 'answer': our_answer, 'value_object': result_value_object
    })

print("\n" + "=" * 80)
print(f"Example {example_id}: {correct_count}/{len(questions)} correct")
for r in results:
    print(f"  Turn {r['turn']}: {'✓' if r['match'] else '✗'}")

if correct_count == len(questions):
    print(f"\n✓✓✓ 100% CORRECT! ✓✓✓")
else:
    print(f"\n✗ {len(questions) - correct_count} failures")
    sys.exit(1)
