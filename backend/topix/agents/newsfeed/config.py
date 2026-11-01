"""Newsfeed agent configuration."""
from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel
from yaml import safe_load

from topix.agents.config import BaseAgentConfig, WebSearchConfig
from topix.config.services import service_config

NEWSFEED_DEFAULT_CONFIG_FILE = Path(__file__).parent / "config.yml"


class TopicSetupConfig(BaseAgentConfig):
    """Configuration for the Topic Setup agent."""

    web_search: WebSearchConfig | None = None


class NewsfeedCollectorConfig(BaseAgentConfig):
    """Configuration for the Newsfeed collector."""

    web_search: WebSearchConfig | None = None


class NewsfeedSynthesizerConfig(BaseAgentConfig):
    """Configuration for the Newsfeed synthesizer."""

    pass


class NewsfeedPipelineConfig(BaseModel):
    """Configuration for the Newsfeed pipeline."""

    topic_setup: TopicSetupConfig
    collector: NewsfeedCollectorConfig
    synthesizer: NewsfeedSynthesizerConfig

    @classmethod
    def from_yaml(cls, config_file: str | None = None) -> NewsfeedPipelineConfig:
        """Create an instance of NewsfeedPipelineConfig from configuration file."""
        if config_file is None:
            config_file = str(NEWSFEED_DEFAULT_CONFIG_FILE)
        with open(config_file) as f:
            cf = safe_load(f)

        if len(service_config.search) == 0:
            for section in ("topic_setup", "collector"):
                if section in cf:
                    cf[section]["web_search"] = None

        return cls.model_validate(cf)
