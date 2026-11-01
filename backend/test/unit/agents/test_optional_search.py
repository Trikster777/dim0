"""Unit tests for the optional web-search capability.

Without a configured search provider the app must still boot: the search
section is dropped from the plan instead of failing the whole startup.
"""

import pytest

from topix.agents.config import AssistantManagerConfig, WebSearchConfig
from topix.config import catalog
from topix.config.services import SearchService, service_config


@pytest.fixture
def no_search(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    """Configure no search provider at all."""
    for key in catalog.provider_env_vars():
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(service_config, "search", [])
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    return monkeypatch


def test_web_search_config_survives_without_search_provider(no_search: pytest.MonkeyPatch):
    """The engine stays as configured — the capability is optional, not broken."""
    cfg = WebSearchConfig(
        model="gpt-5.4",
        instructions_template="web_search.jinja",
        search_engine="linkup",
        search_context_size="medium",
    )

    assert cfg.search_engine == "linkup"


def test_plan_config_drops_web_search_without_search_provider(no_search: pytest.MonkeyPatch):
    """The plan loads without a web_search section when no search API is configured."""
    cfg = AssistantManagerConfig.from_yaml()

    assert cfg.plan.web_search is None


def test_plan_config_keeps_web_search_with_search_provider(no_search: pytest.MonkeyPatch):
    """With a search provider configured, the section stays as it was."""
    no_search.setattr(
        service_config,
        "search",
        [SearchService(type="search", name="linkup", provider="linkup")],
    )

    cfg = AssistantManagerConfig.from_yaml()

    assert cfg.plan.web_search is not None
    assert cfg.plan.web_search.search_engine == "linkup"


def test_set_web_engine_is_ignored_without_search_provider(no_search: pytest.MonkeyPatch):
    """Switching engines on a plan without web search does not raise."""
    cfg = AssistantManagerConfig.from_yaml()

    cfg.set_web_engine("linkup")

    assert cfg.plan.web_search is None
