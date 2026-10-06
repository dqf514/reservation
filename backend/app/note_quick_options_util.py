from __future__ import annotations

import json

from sqlalchemy.orm import Session

from .models import NoteQuickOptionsSettings

DEFAULT_NOTE_QUICK_OPTIONS: list[str] = [
    "靠窗",
    "宝宝椅",
    "生日",
    "纪念日",
    "安静位",
    "不吃辣",
]
NOTE_QUICK_OPTIONS_MAX = 20
NOTE_QUICK_OPTION_MAX_LEN = 32


def normalize_note_quick_options(raw: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in raw:
        s = (item or "").strip()
        if not s or s in seen:
            continue
        if len(s) > NOTE_QUICK_OPTION_MAX_LEN:
            s = s[:NOTE_QUICK_OPTION_MAX_LEN]
        seen.add(s)
        out.append(s)
        if len(out) >= NOTE_QUICK_OPTIONS_MAX:
            break
    return out


def get_or_create_note_quick_options_settings(
    db: Session,
) -> NoteQuickOptionsSettings:
    row = db.get(NoteQuickOptionsSettings, 1)
    if row:
        return row
    row = NoteQuickOptionsSettings(
        id=1,
        options_json=json.dumps(DEFAULT_NOTE_QUICK_OPTIONS, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def read_note_quick_options(db: Session) -> list[str]:
    row = get_or_create_note_quick_options_settings(db)
    try:
        data = json.loads(row.options_json or "[]")
    except json.JSONDecodeError:
        data = []
    if not isinstance(data, list):
        data = []
    normalized = normalize_note_quick_options(
        [str(x) for x in data],
    )
    if not normalized:
        return list(DEFAULT_NOTE_QUICK_OPTIONS)
    return normalized


def write_note_quick_options(db: Session, items: list[str]) -> list[str]:
    normalized = normalize_note_quick_options(items)
    if not normalized:
        raise ValueError("请至少保留一个备注备选项")
    row = get_or_create_note_quick_options_settings(db)
    row.options_json = json.dumps(normalized, ensure_ascii=False)
    db.add(row)
    db.commit()
    db.refresh(row)
    return normalized
