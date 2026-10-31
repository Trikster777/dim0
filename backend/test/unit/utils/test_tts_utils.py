"""Unit tests for the TTS text helpers in ``topix.utils.tts``."""

from __future__ import annotations

import re

import pytest

from topix.utils.tts import (
    assemble_wav,
    has_speakable_content,
    prepare_tts_text,
    split_text_for_tts,
    transliterate_latin,
)

CDATA_MARKER_RE = re.compile(r"<!\[CDATA\[.*?\]\]>")

# Every abbreviation of the owner's list. The second item holds the spellings
# that mean the abbreviation was cut apart: «т.е.» → «т. е.» when the inner dot
# becomes a sentence boundary, «др.» → «др .» when the only dot becomes one.
OWNER_ABBREVIATIONS = (
    ("т.е.", ("т. е.",)),
    ("и т.д.", ("и т. д.", "т. д.")),
    ("т.п.", ("т. п.",)),
    ("т.к.", ("т. к.",)),
    ("др.", ("др .",)),
    ("см.", ("см .",)),
    ("стр.", ("стр .",)),
    ("напр.", ("напр .",)),
    ("руб.", ("руб .",)),
    ("тыс.", ("тыс .",)),
    ("млн.", ("млн .",)),
    ("г.", ("г .",)),
    ("гг.", ("гг .",)),
    ("вв.", ("вв .",)),
)

OWNER_ABBREVIATION_IDS = [abbreviation for abbreviation, _ in OWNER_ABBREVIATIONS]

# Long comma-free filler: without a soft separator the chunker has to cut the
# text on a space, so an abbreviation may land right on the chunk boundary.
BOUNDARY_FILLER = (
    "Это очень длинный текст про отчёт агента который описывает все детали работы "
    "над проектом и планы на будущее без единой запятой чтобы чанкер резал его по пробелу "
    "иначе сокращение внутри текста никогда не окажется на границе двух кусков речи"
).split() * 3
BOUNDARY_TAIL = "и так далее конец отчёта"


def _has_latin(text: str) -> bool:
    """Tell whether the text still contains a latin letter."""
    return any(char.isascii() and char.isalpha() for char in text)


def _wav(pcm: bytes, *, sample_rate: int = 48000, channels: int = 1, bits: int = 16) -> bytes:
    """Build a canonical 44 byte header WAV file around the given PCM payload."""
    byte_rate = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    header = (
        b"RIFF"
        + (36 + len(pcm)).to_bytes(4, "little")
        + b"WAVEfmt "
        + (16).to_bytes(4, "little")
        + (1).to_bytes(2, "little")
        + channels.to_bytes(2, "little")
        + sample_rate.to_bytes(4, "little")
        + byte_rate.to_bytes(4, "little")
        + block_align.to_bytes(2, "little")
        + bits.to_bytes(2, "little")
        + b"data"
        + len(pcm).to_bytes(4, "little")
    )
    return header + pcm


def _data_payload(wav: bytes) -> bytes:
    """Extract the PCM payload out of a RIFF/WAVE blob."""
    assert wav[:4] == b"RIFF"
    assert wav[8:12] == b"WAVE"
    offset = 12
    while offset + 8 <= len(wav):
        chunk_id = wav[offset : offset + 4]
        size = int.from_bytes(wav[offset + 4 : offset + 8], "little")
        if chunk_id == b"data":
            return wav[offset + 8 : offset + 8 + size]
        offset += 8 + size + (size % 2)
    raise AssertionError("no data chunk found")


def _without_spaces(text: str) -> str:
    """Drop whitespace so chunk joins can be compared against the source."""
    return "".join(text.split())


def _abbreviation_chunk_span(text: str, chunks: list[str], abbreviation: str) -> set[int]:
    """Return the indexes of the chunks the abbreviation is spread over.

    A single index means the abbreviation stayed whole inside one chunk. The
    check is done per character, so it also catches a cut between the words of
    a two word abbreviation such as «и т.д.».
    """
    flat_text = _without_spaces(text)
    flat_chunks = _without_spaces(" ".join(chunks))
    assert flat_text == flat_chunks, "the chunker must not change the text"
    chunk_map = [index for index, chunk in enumerate(chunks) for char in chunk if not char.isspace()]
    token = _without_spaces(abbreviation)
    spans: set[int] = set()
    position = text.find(abbreviation)
    assert position != -1, f"{abbreviation!r} is missing from the text"
    while position != -1:
        flat_start = len(_without_spaces(text[:position]))
        spans.update(chunk_map[flat_start : flat_start + len(token)])
        position = text.find(abbreviation, position + 1)
    return spans


def _long_text_with_abbreviation(abbreviation: str, offset: int) -> str:
    """Build a long comma-free text where the abbreviation starts at ``offset``."""
    prefix = ""
    for word in BOUNDARY_FILLER:
        candidate = f"{prefix} {word}" if prefix else word
        if len(candidate) + 1 > offset:
            # Pad with a truncated word so the abbreviation starts exactly at the
            # requested offset and every character position is tried.
            room = offset - len(prefix) - 1
            if room > 0:
                prefix = f"{prefix} {word[:room]}"
            break
        prefix = candidate
    return f"{prefix} {abbreviation} {BOUNDARY_TAIL}"


def test_split_empty_text_returns_no_chunks():
    """Empty text produces no chunks at all."""
    assert split_text_for_tts("") == []


def test_split_blank_text_returns_no_chunks():
    """Whitespace-only text produces no chunks at all."""
    assert split_text_for_tts("   \n  ") == []


def test_split_single_long_sentence_respects_chunk_limit():
    """A sentence longer than the limit is cut into chunks of at most 250 chars."""
    sentence = ", ".join(["фраза про длинный ответ агента"] * 20)

    chunks = split_text_for_tts(sentence)

    assert len(chunks) > 1
    assert all(len(chunk) <= 250 for chunk in chunks)
    assert _without_spaces(" ".join(chunks)) == _without_spaces(sentence)


def test_split_many_short_sentences_merges_them():
    """Short sentences are glued to the next one instead of forming chunks of their own."""
    text = "Привет. Как дела? Хорошо. Отлично!"

    chunks = split_text_for_tts(text)

    assert chunks == ["Привет. Как дела? Хорошо. Отлично!"]


def test_split_keeps_numbers_intact():
    """Numbers stay in the chunk they belong to."""
    text = "В 2026 году вышло 1500 обновлений. Их число растёт."

    chunks = split_text_for_tts(text)

    assert "".join(chunks).count("2026") == 1
    assert "".join(chunks).count("1500") == 1
    assert _without_spaces(" ".join(chunks)) == _without_spaces(text)


def test_split_keeps_emoji_intact():
    """Emoji are not treated as sentence boundaries and survive the split."""
    text = "Готово 🎉 Смотри результат 🚀"

    chunks = split_text_for_tts(text)

    assert "🎉" in chunks[0]
    assert "🚀" in chunks[-1]


def test_split_does_not_break_abbreviations():
    """Abbreviations like «т.е.» and «и т.д.» stay whole inside a chunk."""
    text = "Он сказал т.е. это важно. И т.д. всё понятно."

    chunks = split_text_for_tts(text)
    joined = " ".join(chunks)

    assert "т.е." in joined
    assert "и т.д." in joined.lower()
    # The abbreviation was not cut into two pieces.
    assert "т. е." not in joined
    assert "т. д." not in joined
    assert _without_spaces(joined) == _without_spaces(text)


@pytest.mark.parametrize(
    ("abbreviation", "broken_forms"),
    OWNER_ABBREVIATIONS,
    ids=OWNER_ABBREVIATION_IDS,
)
def test_split_keeps_every_owner_abbreviation_whole(abbreviation: str, broken_forms: tuple[str, ...]):
    """Every abbreviation of the owner's list keeps its exact shape in the chunks.

    The assertion is on the shape of the abbreviation and not on the number of
    chunks, so a broken abbreviation can never be baked into the test as the
    expected behaviour.
    """
    text = f"Он ответил {abbreviation} это важный момент и мы его учли."

    chunks = split_text_for_tts(text)
    joined = " ".join(chunks)

    # The abbreviation is present with the spelling it was written with.
    assert abbreviation.lower() in joined.lower()
    # The abbreviation was not pulled apart into separate pieces.
    for broken in broken_forms:
        assert broken not in joined, f"{abbreviation!r} was split into {broken!r}"
    # The abbreviation did not cross a chunk boundary either.
    assert len(_abbreviation_chunk_span(text, chunks, abbreviation)) == 1
    # Nothing of the text was lost on the way.
    assert _without_spaces(joined) == _without_spaces(text)


@pytest.mark.parametrize(
    ("abbreviation", "broken_forms"),
    OWNER_ABBREVIATIONS,
    ids=OWNER_ABBREVIATION_IDS,
)
def test_split_keeps_every_owner_abbreviation_whole_at_chunk_boundary(
    abbreviation: str,
    broken_forms: tuple[str, ...],
):
    """An abbreviation standing around the chunk border is not cut in two.

    The abbreviation is placed at every character offset around the limit of
    250 characters, so the chunk border crosses it again and again.
    """
    for offset in range(230, 271):
        text = _long_text_with_abbreviation(abbreviation, offset)

        chunks = split_text_for_tts(text)
        joined = " ".join(chunks)

        assert abbreviation.lower() in joined.lower(), offset
        for broken in broken_forms:
            assert broken not in joined, f"{abbreviation!r} was split into {broken!r} at {offset}"
        assert len(_abbreviation_chunk_span(text, chunks, abbreviation)) == 1, (
            f"{abbreviation!r} was cut across a chunk boundary at {offset}"
        )
        assert _without_spaces(joined) == _without_spaces(text), offset


def test_split_paragraph_break_is_a_boundary():
    """A blank line separates paragraphs and never ends up inside a chunk."""
    text = "Первый абзац.\n\nВторой абзац."

    chunks = split_text_for_tts(text)

    assert all("\n" not in chunk for chunk in chunks)
    assert _without_spaces(" ".join(chunks)) == _without_spaces(text)


# ---------------------------------------------------------------------------
# Transliteration
# ---------------------------------------------------------------------------


def test_transliterate_latin_converts_latin_letters():
    """Latin letters are replaced by their Cyrillic counterparts."""
    result = transliterate_latin("Отдел R&D отчитался")

    assert result == "Отдел Р&Д отчитался"
    assert not _has_latin(result)


def test_transliterate_latin_covers_the_whole_alphabet():
    """Every latin letter of the 52 letter alphabet is transliterated."""
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

    result = transliterate_latin(alphabet)

    assert not _has_latin(result)


def test_transliterate_latin_leaves_cyrillic_untouched():
    """Cyrillic text is not modified at all."""
    assert transliterate_latin("Привет, мир!") == "Привет, мир!"


def test_transliterate_latin_handles_known_agent_words():
    """Words that used to break the synthesis become Cyrillic."""
    for word in ("workflow", "PowerShell", "XML", "API", "JSON", "R&D", "Q&A", "Qwen"):
        assert not _has_latin(transliterate_latin(word)), word


# ---------------------------------------------------------------------------
# Text preparation
# ---------------------------------------------------------------------------


def test_prepare_tts_text_keeps_plain_text_untouched():
    """Plain Russian text is not modified."""
    assert prepare_tts_text("Привет, мир!") == "Привет, мир!"


def test_prepare_tts_text_escapes_xml_specials_with_cdata():
    """Ampersand, less-than and greater-than become per character CDATA sections."""
    result = prepare_tts_text("Цена & наличие < остаток > нуля")

    assert "<![CDATA[&]]>" in result
    assert "<![CDATA[<]]>" in result
    assert "<![CDATA[>]]>" in result
    # Named and numeric entities are destroyed by the service normalizer.
    assert "&amp;" not in result
    assert "&#38;" not in result


def test_prepare_tts_text_transliterates_before_escaping():
    """The transliteration step runs first, so the CDATA marker survives it."""
    result = prepare_tts_text("CDATA & тест")

    assert "ЦДАТА" in result
    assert "<![CDATA[&]]>" in result


def test_prepare_tts_text_result_has_no_latin_letters_outside_markers():
    """After stripping the CDATA markers the text holds no latin letter."""
    result = prepare_tts_text("workflow & PowerShell")

    stripped = CDATA_MARKER_RE.sub("", result)

    assert not _has_latin(stripped)


# ---------------------------------------------------------------------------
# Speakable content
# ---------------------------------------------------------------------------


def test_has_speakable_content_is_false_without_letter_or_digit():
    """Text without a letter and without a digit has nothing to speak."""
    assert has_speakable_content(">") is False
    assert has_speakable_content("---") is False
    assert has_speakable_content("***") is False
    assert has_speakable_content("🎉🚀") is False
    assert has_speakable_content("") is False


def test_has_speakable_content_is_true_with_letter_or_digit():
    """A letter or a digit is enough to speak."""
    assert has_speakable_content("Привет") is True
    assert has_speakable_content("5") is True
    assert has_speakable_content("🎉 7") is True


# ---------------------------------------------------------------------------
# WAV assembly
# ---------------------------------------------------------------------------


def test_assemble_wav_of_empty_list_is_empty():
    """No chunks means no audio."""
    assert assemble_wav([]) == b""


def test_assemble_wav_of_single_chunk_keeps_the_file():
    """A single chunk is returned unchanged."""
    wav = _wav(b"\x01\x02" * 8)

    assert assemble_wav([wav]) == wav


def test_assemble_wav_concatenates_pcm_payloads():
    """PCM payloads are concatenated under the header of the first chunk."""
    first = _wav(b"\x01\x02" * 10)
    second = _wav(b"\x03\x04" * 5)

    result = assemble_wav([first, second])

    assert result[:4] == b"RIFF"
    assert result[8:12] == b"WAVE"
    assert int.from_bytes(result[4:8], "little") == len(result) - 8
    assert _data_payload(result) == b"\x01\x02" * 10 + b"\x03\x04" * 5


def test_assemble_wav_keeps_the_format_of_the_first_chunk():
    """The header (48 kHz, mono, 16 bit) is taken from the first chunk."""
    first = _wav(b"\x01\x02" * 4, sample_rate=48000, channels=1, bits=16)
    second = _wav(b"\x03\x04" * 4, sample_rate=16000, channels=2, bits=8)

    result = assemble_wav([first, second])

    assert result[12:16] == b"fmt "
    assert int.from_bytes(result[24:28], "little") == 48000
    assert int.from_bytes(result[22:24], "little") == 1
    assert int.from_bytes(result[34:36], "little") == 16
