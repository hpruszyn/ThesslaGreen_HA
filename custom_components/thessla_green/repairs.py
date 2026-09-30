"""Repairs support for persistent Modbus write failures.

Pattern adapted from the MIT-licensed blakinio/thesslagreen integration.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.repairs import ConfirmRepairFlow, RepairsFlow
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import DOMAIN

_WRITE_FAILURE_KEY = "modbus_write_failed"


def write_failure_issue_id(entry: Any | None) -> str:
    entry_id = getattr(entry, "entry_id", None)
    return f"{_WRITE_FAILURE_KEY}_{entry_id}" if entry_id else _WRITE_FAILURE_KEY


def create_write_failure_issue(
    hass: HomeAssistant,
    entry: Any | None,
    *,
    register: str | None = None,
) -> None:
    """Create an actionable repair after a final Modbus write failure."""
    ir.async_create_issue(
        hass,
        DOMAIN,
        write_failure_issue_id(entry),
        data={"register": register} if register else None,
        is_fixable=False,
        is_persistent=False,
        severity=ir.IssueSeverity.ERROR,
        translation_key=_WRITE_FAILURE_KEY,
        translation_placeholders={"register": register or "unknown"},
    )


def clear_write_failure_issue(hass: HomeAssistant, entry: Any | None) -> None:
    """Clear the issue after the next confirmed successful write."""
    ir.async_delete_issue(hass, DOMAIN, write_failure_issue_id(entry))


async def async_create_fix_flow(
    hass: HomeAssistant,
    issue_id: str,
    data: dict | None,
) -> RepairsFlow:
    """Compatibility confirmation flow for any legacy fixable issue."""
    return ConfirmRepairFlow()
