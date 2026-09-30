"""Diagnostic buttons for Thessla Green."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import DOMAIN
from .coordinator import ThesslaGreenCoordinator
from .device_info import build_device_info

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        ValidateKnownRegistersButton(
            runtime["coordinator"],
            runtime["slave"],
        )
    ])


class ValidateKnownRegistersButton(ButtonEntity):
    """Validate only the Modbus addresses known by the integration."""

    _attr_name = "Rekuperator Waliduj znane rejestry"
    _attr_icon = "mdi:database-check"
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._attr_unique_id = f"thessla_validate_known_registers_{slave}"
        self._attr_device_info = build_device_info(coordinator, slave)

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    async def async_press(self) -> None:
        report = await self.coordinator.async_validate_known_registers()
        supported = sum(len(v["supported"]) for v in report.values())
        unsupported = sum(len(v["unsupported"]) for v in report.values())
        indeterminate = sum(len(v["indeterminate"]) for v in report.values())
        _LOGGER.info(
            "Known-register validation finished: supported=%d unsupported=%d indeterminate=%d",
            supported,
            unsupported,
            indeterminate,
        )
