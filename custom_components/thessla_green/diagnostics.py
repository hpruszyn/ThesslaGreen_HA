"""Diagnostics support for the Thessla Green integration."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from . import DOMAIN
from .const import CONF_HOST

TO_REDACT = {CONF_HOST}


def _firmware(input_registers: dict[int, int]) -> str | None:
    major = input_registers.get(0)
    minor = input_registers.get(1)
    patch = input_registers.get(4)
    if None in (major, minor, patch):
        return None
    return f"{major}.{minor}.{patch}"


def _safe_holding(registers: dict[int, int]) -> dict[int, int]:
    """Exclude weekly schedule registers because they can reveal occupancy."""
    return {
        address: value
        for address, value in registers.items()
        if not 16 <= address <= 180
    }


def _safe_input(registers: dict[int, int]) -> dict[int, int]:
    """Exclude controller serial-number registers 24-29."""
    return {
        address: value
        for address, value in registers.items()
        if not 24 <= address <= 29
    }


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> dict[str, Any]:
    """Return privacy-conscious diagnostics for a config entry."""
    runtime = hass.data[DOMAIN][entry.entry_id]
    coordinator = runtime["coordinator"]
    data = coordinator.safe_data

    return {
        "entry": {
            "title": entry.title,
            "data": async_redact_data(dict(entry.data), TO_REDACT),
            "options": dict(entry.options),
        },
        "device": {
            "firmware": _firmware(data.input),
            "slave": runtime["slave"],
            "scan_interval": runtime["scan_interval"],
            "capabilities": dict(runtime.get("caps", {})),
        },
        "poll": {
            "last_update_success": coordinator.last_update_success,
            "update_interval_seconds": data.update_interval,
            "holding_count": len(data.holding),
            "input_count": len(data.input),
            "coil_count": len(data.coil),
            "discrete_count": len(data.discrete),
        },
        "validation": coordinator.last_validation_report,
        "modbus": {
            "holding": _safe_holding(data.holding),
            "input": _safe_input(data.input),
            "coil": dict(data.coil),
            "discrete": dict(data.discrete),
        },
    }
