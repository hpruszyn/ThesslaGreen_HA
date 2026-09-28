"""Stable device identity helpers for Thessla Green."""

from __future__ import annotations

from .const import DOMAIN


def _serial_hex(coordinator) -> str | None:
    registers = [coordinator.safe_data.input.get(address) for address in range(24, 30)]
    if any(value is None for value in registers):
        return None
    return "".join(f"{int(value) & 0xFF:02x}" for value in registers)


def serial_number(coordinator) -> str | None:
    raw = _serial_hex(coordinator)
    if raw is None:
        return None
    return f"{raw[0:4]} {raw[4:8]} {raw[8:12]}"


def firmware_version(coordinator) -> str | None:
    data = coordinator.safe_data.input
    values = (data.get(0), data.get(1), data.get(4))
    if any(value is None for value in values):
        return None
    return ".".join(str(int(value)) for value in values)


def stable_device_identifier(coordinator, slave: int) -> str:
    """Prefer physical serial identity; preserve legacy slave ID as fallback."""
    raw = _serial_hex(coordinator)
    return f"serial:{raw}" if raw else str(slave)


def build_device_info(coordinator, slave: int) -> dict:
    info = {
        "identifiers": {(DOMAIN, stable_device_identifier(coordinator, slave))},
        "name": "Rekuperator Thessla",
        "manufacturer": "Thessla Green",
        "model": "Modbus Rekuperator",
    }
    firmware = firmware_version(coordinator)
    serial = serial_number(coordinator)
    if firmware:
        info["sw_version"] = firmware
    if serial:
        info["serial_number"] = serial
    return info
