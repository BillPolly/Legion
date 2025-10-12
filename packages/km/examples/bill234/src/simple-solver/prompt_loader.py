"""
Prompt Loader using Jinja2 Templates

Manages and renders prompt templates for the 2-stage solver.
"""

from pathlib import Path
from typing import Dict, Any
from jinja2 import Environment, FileSystemLoader, TemplateNotFound


class PromptLoader:
    """
    Loads and renders Jinja2 prompt templates.

    Templates should be stored in the prompts/ directory with .j2 extension.
    """

    def __init__(self, prompts_dir: str = "prompts"):
        """
        Initialize the prompt loader.

        Args:
            prompts_dir: Directory containing Jinja2 templates (relative to this file)
        """
        # Get absolute path to prompts directory
        current_file = Path(__file__)
        self.prompts_path = current_file.parent / prompts_dir

        # Initialize Jinja2 environment
        self.env = Environment(
            loader=FileSystemLoader(str(self.prompts_path)),
            autoescape=False,  # Don't escape for text prompts
            trim_blocks=True,   # Remove first newline after template tag
            lstrip_blocks=True  # Strip leading spaces/tabs from blocks
        )

    def render(self, template_name: str, variables: Dict[str, Any]) -> str:
        """
        Render a template with the given variables.

        Args:
            template_name: Name of the template file (e.g., 'stage1_analyze.j2')
            variables: Dictionary of variables to pass to the template

        Returns:
            Rendered prompt string

        Raises:
            TemplateNotFound: If the template file doesn't exist
        """
        try:
            template = self.env.get_template(template_name)
            return template.render(**variables)
        except TemplateNotFound as e:
            raise FileNotFoundError(
                f"Template '{template_name}' not found in {self.prompts_path}"
            ) from e

    def list_templates(self):
        """List all available templates."""
        return list(self.env.list_templates())


if __name__ == "__main__":
    # Quick test
    loader = PromptLoader()

    print("PromptLoader initialized")
    print(f"Prompts directory: {loader.prompts_path}")
    print(f"Available templates: {loader.list_templates()}")
