"""Unit tests for base agent model setting adjustments and client selection."""

import openai
import pytest

from agents import ModelSettings
from agents.extensions.models.litellm_model import LitellmModel
from agents.models.openai_chatcompletions import OpenAIChatCompletionsModel

from topix.agents.base import BaseAgent
from topix.config import catalog

# Stub values for the custom OpenAI-compatible provider (no real key or address).
CUSTOM_BASE_URL = "https://example.test/v1"


class _FakeAsyncOpenAI:
    """Stand-in for the OpenAI SDK client: records how it was built, no network."""

    instances: list["_FakeAsyncOpenAI"] = []

    def __init__(self, api_key=None, base_url=None, **kwargs):
        """Record the constructor arguments instead of talking to any API."""
        self.api_key = api_key
        self.base_url = base_url
        _FakeAsyncOpenAI.instances.append(self)


@pytest.fixture
def provider_env(monkeypatch):
    """Clear every provider variable so each test configures only what it needs."""
    for key in catalog.provider_env_vars():
        monkeypatch.delenv(key, raising=False)
    _FakeAsyncOpenAI.instances.clear()
    monkeypatch.setattr(openai, "AsyncOpenAI", _FakeAsyncOpenAI)
    return monkeypatch


def test_agent_uses_native_client_for_custom_provider(provider_env):
    """A custom provider is called through the native SDK, with its own model string."""
    provider_env.setenv("ANYMODEL_API_KEY", "test-key")
    provider_env.setenv("ANYMODEL_BASE_URL", CUSTOM_BASE_URL)

    agent = BaseAgent(name="test_agent", model="gpt-6-luna")

    assert isinstance(agent.model, OpenAIChatCompletionsModel)
    # The provider receives its own model string, not the canonical catalog id.
    assert agent.model.model == "cx/gpt-6-luna"
    # The client points at the provider's endpoint and carries the provider's key.
    client = _FakeAsyncOpenAI.instances[-1]
    assert str(client.base_url).rstrip("/") == CUSTOM_BASE_URL
    assert client.api_key == "test-key"


def test_agent_keeps_litellm_for_openrouter_model(provider_env):
    """OpenRouter models keep going through LiteLLM (unchanged behaviour)."""
    provider_env.setenv("OPENROUTER_API_KEY", "test-key")

    agent = BaseAgent(name="test_agent", model="gpt-5.4")

    assert isinstance(agent.model, LitellmModel)
    assert agent.model.model == "openrouter/openai/gpt-5.4"


def test_agent_keeps_native_openai_model(provider_env):
    """Native OpenAI models keep the plain string model (unchanged behaviour)."""
    provider_env.setenv("OPENAI_API_KEY", "test-key")

    agent = BaseAgent(name="test_agent", model="gpt-5.4")

    assert agent.model == "openai/gpt-5.4"


def test_adjust_model_settings_supports_native_chat_completions_model(provider_env):
    """Capability detection reads the bare name off the native model object."""
    provider_env.setenv("ANYMODEL_API_KEY", "test-key")
    provider_env.setenv("ANYMODEL_BASE_URL", CUSTOM_BASE_URL)

    agent = BaseAgent.__new__(BaseAgent)
    model = OpenAIChatCompletionsModel(
        model="cx/gpt-6-luna",
        openai_client=_FakeAsyncOpenAI(api_key="test-key", base_url=CUSTOM_BASE_URL),
    )

    settings = agent._adjust_model_settings(model, ModelSettings())

    # "cx/gpt-6-luna" -> bare "gpt-6-luna": not a reasoning model, temperature allowed.
    assert settings.reasoning is None
    assert settings.temperature == 0.01
    assert settings.max_tokens == 8000
    # LiteLLM-only tweaks stay out of the native client's request.
    assert settings.extra_args is None
    assert settings.extra_body is None


def test_adjust_model_settings_enables_openai_prompt_cache_retention():
    """OpenAI string models should enable 24h prompt cache retention."""
    agent = BaseAgent.__new__(BaseAgent)
    agent.name = "planner_agent"

    settings = agent._adjust_model_settings(
        "openai/gpt-5.4-mini",
        ModelSettings(extra_args={"existing": "value"}),
    )

    assert settings.extra_body == {
        "prompt_cache_retention": "24h",
    }
    assert settings.extra_args == {
        "existing": "value",
    }


def test_adjust_model_settings_keeps_litellm_specific_extra_args():
    """LiteLLM models should keep the provider-specific dropped-params config."""
    agent = BaseAgent.__new__(BaseAgent)

    settings = agent._adjust_model_settings(
        LitellmModel("anthropic/claude-3-5-sonnet"),
        ModelSettings(),
    )

    assert settings.extra_args == {
        "drop_params": True,
        "additional_drop_params": ["frequency_penalty", "presence_penalty"],
    }


def test_adjust_model_settings_detects_reasoning_for_openrouter_routed_model():
    """An OpenAI reasoning model routed via OpenRouter must keep reasoning settings.

    Regression: capability detection used to match only bare "openai/..." codes,
    so the routed code "openrouter/openai/gpt-5.4" (wrapped in LitellmModel) was
    mis-classified — reasoning dropped and temperature wrongly forced on.
    """
    agent = BaseAgent.__new__(BaseAgent)

    settings = agent._adjust_model_settings(
        LitellmModel("openrouter/openai/gpt-5.4"),
        ModelSettings(),
    )

    assert settings.reasoning is not None
    assert settings.temperature is None


def test_adjust_model_settings_routed_matches_native_for_reasoning_model():
    """Routed and native addressing of the same model yield the same capabilities."""
    agent = BaseAgent.__new__(BaseAgent)

    native = agent._adjust_model_settings("openai/gpt-5.4", ModelSettings())
    routed = agent._adjust_model_settings(
        LitellmModel("openrouter/openai/gpt-5.4"), ModelSettings()
    )

    assert (native.reasoning is None) == (routed.reasoning is None)
    assert (native.temperature is None) == (routed.temperature is None)
