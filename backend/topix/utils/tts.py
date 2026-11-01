"""Pure text helpers for the TTS module: chunking, transliteration, CDATA escaping."""

import re

from bisect import bisect_left
from collections import deque

# Latin to Cyrillic table covering all 52 latin letters. The ru model of the
# TTS service has no extended alphabet, so a single latin letter breaks the
# synthesis — the backend has to remove latin on its own.
_LATIN_TO_CYRILLIC = {
    "a": "а",
    "b": "б",
    "c": "ц",
    "d": "д",
    "e": "е",
    "f": "ф",
    "g": "г",
    "h": "х",
    "i": "и",
    "j": "дж",
    "k": "к",
    "l": "л",
    "m": "м",
    "n": "н",
    "o": "о",
    "p": "п",
    "q": "к",
    "r": "р",
    "s": "с",
    "t": "т",
    "u": "у",
    "v": "в",
    "w": "в",
    "x": "кс",
    "y": "й",
    "z": "з",
}

_TRANSLATION_TABLE = {ord(latin): cyrillic for latin, cyrillic in _LATIN_TO_CYRILLIC.items()}
_TRANSLATION_TABLE.update(
    {ord(latin.upper()): cyrillic.capitalize() for latin, cyrillic in _LATIN_TO_CYRILLIC.items()},
)

# The service does not escape XML and its normalizer destroys named and numeric
# entities, so every dangerous character becomes its own CDATA section.
_CDATA_ESCAPES = {
    "&": "<![CDATA[&]]>",
    "<": "<![CDATA[<]]>",
    ">": "<![CDATA[>]]>",
}

# Maximum characters per synthesized chunk.
MAX_CHUNK_CHARS = 250
# Sentences shorter than this are glued to the next one instead of standing alone.
MIN_MERGE_CHARS = 50

# Characters that end a sentence.
SENTENCE_TERMINATORS = ".!?…"

# Soft split points used only when a single sentence exceeds MAX_CHUNK_CHARS.
# COMPROMISE: the brief allows cutting by comma/semicolon/colon/dash only in this
# edge case — everywhere else the text is cut strictly on sentence boundaries.
SOFT_SPLIT_SEPARATORS = (", ", "; ", ": ", " — ", " – ", " - ")

# Our own CDATA markers must survive the chunker as whole pieces: the «!» of
# «<![CDATA[» looks like the end of a sentence, and a chunk border inside a
# marker would send invalid XML to the service (400 → 502 to the client).
_CDATA_MARKER_RE = re.compile(r"<!\[CDATA\[.*?\]\]>")

# Abbreviations whose dots must not be treated as sentence boundaries.
# Every dot inside a matched abbreviation is excluded from the boundaries, so
# «т.е.» and «и т.д.» stay whole instead of being cut into «т.» + «е.».
_ABBREVIATION_RE = re.compile(
    r"(?<![\wЀ-ӿ])"
    r"(?:и\s+)?"
    r"(?:т\.[а-яё]\.|др\.|см\.|стр\.|рис\.|напр\.|проч\.|тыс\.|млн\.|руб\.|коп\.|г\.|гг\.|вв\.)",
    flags=re.IGNORECASE,
)


def _abbreviation_dot_positions(text: str) -> set[int]:
    """Collect the indices of the dots that belong to an abbreviation."""
    positions: set[int] = set()
    for match in _ABBREVIATION_RE.finditer(text):
        for index in range(match.start(), match.end()):
            if text[index] == ".":
                positions.add(index)
    return positions


def _abbreviation_spans(text: str) -> list[tuple[int, int]]:
    """Collect the index ranges the known abbreviations occupy in the text.

    A chunk border must not fall inside such a range: «и т.д.» holds a space
    between its parts, so a cut on that space would pull the abbreviation apart
    into two chunks.
    """
    return [(match.start(), match.end()) for match in _ABBREVIATION_RE.finditer(text)]


def _cdata_spans(text: str) -> list[tuple[int, int]]:
    """Collect the index ranges the CDATA markers occupy in the text.

    A marker is a piece of XML markup and not a word: a chunk border inside
    it would send a half section to the service, which answers 400.
    """
    return [(match.start(), match.end()) for match in _CDATA_MARKER_RE.finditer(text)]


def _cdata_inner_positions(text: str) -> bytearray:
    """Mark the positions that lie strictly inside a CDATA marker.

    A terminator inside a marker is markup, not the end of a sentence. The
    mask is built once per text, so the check on every terminator is a single
    lookup instead of a walk through the whole list of markers.
    """
    mask = bytearray(len(text))
    for start, end in _cdata_spans(text):
        if end - start > 1:
            mask[start + 1 : end] = b"\x01" * (end - start - 1)
    return mask


def _holds(starts: list[int], ranges: list[tuple[int, int]], position: int) -> bool:
    """Tell whether the position lies strictly inside one of the sorted ranges.

    The ranges do not overlap, so the only candidate is the last one that
    starts before the position.
    """
    index = bisect_left(starts, position) - 1
    if index < 0:
        return False
    return position < ranges[index][1]


class _ProtectedRanges:
    """The ranges a chunk border must not fall into, prepared for fast lookups.

    Two kinds of ranges are protected: the known abbreviations (a cut inside
    «и т.д.» would pull it apart) and our own CDATA markers (a cut inside
    «<![CDATA[&]]>» would send invalid XML to the service).

    The ranges are read once per piece of text and kept sorted, so the chunker
    looks a position up with a binary search instead of walking the whole list
    on every cut.
    """

    def __init__(self, text: str, offset: int = 0) -> None:
        """Read the ranges of the text; ``offset`` shifts them into the frame of a larger text."""
        self._abbreviations = [(start + offset, end + offset) for start, end in _abbreviation_spans(text)]
        self._markers = [(start + offset, end + offset) for start, end in _cdata_spans(text)]
        self._abbreviation_starts = [start for start, _ in self._abbreviations]
        self._marker_starts = [start for start, _ in self._markers]

    def holds(self, position: int) -> bool:
        """Tell whether the position lies strictly inside a protected range."""
        return _holds(self._abbreviation_starts, self._abbreviations, position) or _holds(self._marker_starts, self._markers, position)

    def holder(self, position: int, after: int) -> int | None:
        """Find the protected range that holds the position, if any.

        Only a range that begins after ``after`` counts — a range that starts
        at the very beginning of the rest cannot be moved in front of. The
        abbreviations come first: they decide which range the cut moves in
        front of.
        """
        for starts, ranges in (
            (self._abbreviation_starts, self._abbreviations),
            (self._marker_starts, self._markers),
        ):
            index = bisect_left(starts, position) - 1
            if index < 0:
                continue
            start, end = ranges[index]
            if after < start and position < end:
                return start
        return None


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences on ``.`` ``!`` ``?`` ``…`` and blank lines only.

    A terminator inside a known abbreviation or inside a CDATA marker never
    ends a sentence, so neither of them is ever cut in two.
    """
    sentences: list[str] = []
    abbreviation_dots = _abbreviation_dot_positions(text)
    marker_positions = _cdata_inner_positions(text)
    start = 0
    index = 0
    length = len(text)

    while index < length:
        char = text[index]
        if char == "\n" and text.startswith("\n\n", index):
            piece = text[start:index].strip()
            if piece:
                sentences.append(piece)
            while index < length and text[index] == "\n":
                index += 1
            start = index
            continue
        if char in SENTENCE_TERMINATORS:
            if char == "." and index in abbreviation_dots:
                index += 1
                continue
            # The «!» of «<![CDATA[» is markup, not the end of a sentence.
            if marker_positions[index]:
                index += 1
                continue
            piece = text[start : index + 1].strip()
            if piece:
                sentences.append(piece)
            start = index + 1
        index += 1

    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


def _choose_cut(text: str, start: int, limit: int, ranges: _ProtectedRanges) -> tuple[int, int]:
    """Pick the place where a too long piece is cut.

    The offsets are relative to the beginning of the rest that starts at
    ``start``. Soft boundaries are preferred; a word is cut only when there is
    no boundary left. The cut never falls inside a known abbreviation or
    inside a CDATA marker.
    """
    window = text[start : start + limit]
    cut = -1
    separator_length = 0
    for separator in SOFT_SPLIT_SEPARATORS:
        found = window.rfind(separator)
        if found > cut:
            cut = found
            separator_length = len(separator)
    if cut > 0:
        return cut, separator_length

    space = window.rfind(" ")
    # A space inside an abbreviation must not become a chunk border.
    while space > 0 and ranges.holds(start + space):
        space = window.rfind(" ", 0, space)
    if space > 0:
        return space, 1

    # The word is cut in half, so the cut may land inside an abbreviation or
    # inside a CDATA marker: move it in front of the protected range instead.
    holder = ranges.holder(start + limit, start)
    if holder is not None:
        return holder - start, 0
    return limit, 0


def _split_long_text(text: str, limit: int) -> list[str]:
    """Cut a too long piece into parts of at most ``limit`` characters.

    Soft boundaries (comma, semicolon, colon, dash) are preferred; a word is
    cut only when there is no boundary left. The protected ranges are read
    once for the whole piece, so the cost of the cut stays linear in the
    length of the text.
    """
    if limit <= 0 or len(text) <= limit:
        return [text] if text else []

    parts: list[str] = []
    ranges = _ProtectedRanges(text)
    start = 0
    end = len(text)
    while end - start > limit:
        cut, separator_length = _choose_cut(text, start, limit, ranges)
        border = start + cut + separator_length
        parts.append(text[start:border].strip())
        start = border
        while start < end and text[start].isspace():
            start += 1
        while end > start and text[end - 1].isspace():
            end -= 1
        if ranges.holds(start):
            # The rest begins inside a protected range: the ranges of the
            # remaining text are read again, because the text around the
            # border is not the one they were read from.
            ranges = _ProtectedRanges(text[start:end], offset=start)

    tail = text[start:end]
    if tail:
        parts.append(tail)
    return [part for part in parts if part]


def split_text_for_tts(text: str) -> list[str]:
    """Split text into chunks of at most 250 characters, cut on sentence boundaries.

    Short sentences are merged with the following one; a single sentence longer
    than the limit is cut on soft boundaries as a compromise. A CDATA marker is
    never cut in two: every chunk leaves for the service with whole sections.
    """
    if not text or not text.strip():
        return []

    pieces: list[str] = []
    for sentence in _split_sentences(text):
        pieces.extend(_split_long_text(sentence, MAX_CHUNK_CHARS))

    chunks: list[str] = []
    current = ""
    pending = deque(pieces)
    while pending:
        piece = pending.popleft()
        candidate = f"{current} {piece}".strip() if current else piece
        if len(candidate) <= MAX_CHUNK_CHARS:
            current = candidate
            continue
        if not current:
            chunks.append(piece)
            continue
        if len(current) < MIN_MERGE_CHARS:
            # A short chunk must not stand alone: split the next piece so that it fits.
            room = MAX_CHUNK_CHARS - len(current) - 1
            parts = _split_long_text(piece, room)
            head = parts[0]
            tail = " ".join(parts[1:])
            if head:
                current = f"{current} {head}".strip()
            chunks.append(current)
            current = ""
            if tail:
                pending = deque(_split_long_text(tail, MAX_CHUNK_CHARS)) + pending
            continue
        chunks.append(current)
        current = piece

    if current:
        chunks.append(current)
    return chunks


def transliterate_latin(text: str) -> str:
    """Replace every latin letter with its Cyrillic counterpart.

    Internal step of :func:`prepare_tts_text`; it is only public so that the
    pure function can be tested on its own.
    """
    return text.translate(_TRANSLATION_TABLE)


def prepare_tts_text(text: str) -> str:
    """Prepare text for the TTS service.

    The order is fixed and must not change: first the latin letters are
    transliterated, then the XML specials are escaped. Reversing the steps
    would rewrite our own ``CDATA`` marker and break the XML of the service.
    """
    transliterated = transliterate_latin(text)
    return "".join(_CDATA_ESCAPES.get(char, char) for char in transliterated)


def has_speakable_content(text: str) -> bool:
    """Tell whether the text holds at least one letter or one digit.

    The service normalizes texts like ``>`` or ``---`` into an empty string
    and answers with a silent file, so such texts are rejected beforehand.
    """
    return any(char.isalpha() or char.isdigit() for char in text)


def _wav_data_offset(wav: bytes) -> int | None:
    """Return the offset of the data chunk payload inside a RIFF/WAVE blob."""
    if len(wav) < 12 or wav[:4] != b"RIFF" or wav[8:12] != b"WAVE":
        return None
    offset = 12
    while offset + 8 <= len(wav):
        chunk_id = wav[offset : offset + 4]
        size = int.from_bytes(wav[offset + 4 : offset + 8], "little")
        if chunk_id == b"data":
            return offset + 8
        offset += 8 + size + (size % 2)
    return None


def _wav_payload(wav: bytes) -> bytes:
    """Return the PCM payload of a RIFF/WAVE blob."""
    offset = _wav_data_offset(wav)
    if offset is None:
        return b""
    size = int.from_bytes(wav[offset - 4 : offset], "little")
    return wav[offset : offset + size]


def assemble_wav(chunks: list[bytes]) -> bytes:
    """Join several WAV chunks into a single file.

    The PCM payloads are concatenated, the header is taken from the first
    chunk and the data length is recalculated.
    """
    if not chunks:
        return b""
    first = chunks[0]
    data_offset = _wav_data_offset(first)
    if data_offset is None:
        return b"".join(chunks)
    payload = b"".join(_wav_payload(chunk) for chunk in chunks)
    header = bytearray(first[:data_offset])
    header[4:8] = (len(header) - 8 + len(payload)).to_bytes(4, "little")
    header[-4:] = len(payload).to_bytes(4, "little")
    return bytes(header) + payload
