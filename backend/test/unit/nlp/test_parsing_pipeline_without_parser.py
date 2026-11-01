"""Unit tests for the parsing pipeline running without a document parser.

A missing parsing provider must not break the backend startup: the pipeline is
built anyway and the methods that need a parser fail with a clear error.
"""

import pytest

from topix.nlp.pipeline import parsing as parsing_mod
from topix.nlp.pipeline.parsing import PARSER_UNAVAILABLE_MESSAGE, ParsingPipeline


class _FakeContentStore:
    """ContentStore stand-in that needs no configuration."""

    def __init__(self) -> None:
        """Create the capture list for stored elements."""
        self.added: list[object] = []

    @classmethod
    def from_config(cls) -> "_FakeContentStore":
        """Build the stand-in the way the pipeline expects."""
        return cls()

    async def add(self, elements: list[object]) -> None:
        """Record the stored elements."""
        self.added = elements


def _patch_dependencies(monkeypatch) -> None:
    """Replace the pipeline's heavy dependencies with local stand-ins."""
    monkeypatch.setattr(parsing_mod, "ContentStore", _FakeContentStore)
    monkeypatch.setattr(parsing_mod, "DocumentMindmapAgent", lambda: object())
    monkeypatch.setattr(parsing_mod, "AgentRunner", lambda: object())


def test_pipeline_is_built_without_a_parser(monkeypatch, caplog):
    """A parser that cannot be configured leaves the pipeline usable."""

    class _UnavailableParser:
        """Parser stand-in that fails the way a missing key does."""

        @classmethod
        def from_config(cls):
            """Fail like the real parser does without an API key."""
            raise ValueError("API key is required, got None")

    _patch_dependencies(monkeypatch)
    monkeypatch.setattr(parsing_mod, "MistralParser", _UnavailableParser)

    with caplog.at_level("WARNING", logger="topix.nlp.pipeline.parsing"):
        pipeline = ParsingPipeline()

    assert pipeline.parser is None
    assert "parsing is unavailable" in caplog.text.lower()


async def test_process_file_fails_clearly_without_a_parser():
    """The parser-dependent method raises a comprehensible error."""
    pipeline = ParsingPipeline.__new__(ParsingPipeline)
    pipeline.parser = None

    with pytest.raises(RuntimeError) as excinfo:
        await pipeline.process_file("document.pdf")

    assert PARSER_UNAVAILABLE_MESSAGE in str(excinfo.value)
