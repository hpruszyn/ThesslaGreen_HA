"""Config-entry, device-registry and obsolete-entity migrations."""

from __future__ import annotations

import logging
from collections.abc import Collection

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .device_info import stable_device_identifier

_LOGGER = logging.getLogger(__name__)

CURRENT_ENTRY_VERSION = 2


async def async_migrate_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
) -> bool:
    """Migrate legacy config-entry schema versions."""
    if config_entry.version > CURRENT_ENTRY_VERSION:
        _LOGGER.error(
            "Config entry version %s is newer than supported version %s",
            config_entry.version,
            CURRENT_ENTRY_VERSION,
        )
        return False

    if config_entry.version < CURRENT_ENTRY_VERSION:
        hass.config_entries.async_update_entry(
            config_entry,
            version=CURRENT_ENTRY_VERSION,
        )
        _LOGGER.info(
            "Migrated Thessla Green config entry %s to version %s",
            config_entry.entry_id,
            CURRENT_ENTRY_VERSION,
        )
    return True


def _belongs_to_entry(device, entry_id: str) -> bool:
    if getattr(device, "config_entry_id", None) == entry_id:
        return True
    entries: Collection[str] = getattr(device, "config_entries", set())
    try:
        return entry_id in entries
    except TypeError:
        return False


def migrate_device_identifier(
    hass: HomeAssistant,
    entry: ConfigEntry,
    coordinator,
    slave: int,
) -> None:
    """Replace legacy slave-only identity with serial identity when available."""
    stable_value = stable_device_identifier(coordinator, slave)
    legacy_value = str(slave)
    if stable_value == legacy_value:
        return

    registry = dr.async_get(hass)
    stable = (DOMAIN, stable_value)
    legacy = (DOMAIN, legacy_value)

    stable_device = registry.async_get_device(identifiers={stable})
    legacy_device = registry.async_get_device(identifiers={legacy})
    device = stable_device or legacy_device
    if device is None or not _belongs_to_entry(device, entry.entry_id):
        return

    current = set(getattr(device, "identifiers", set()))
    desired = {identifier for identifier in current if identifier[0] != DOMAIN}
    desired.add(stable)
    if current == desired:
        return

    registry.async_update_device(device.id, new_identifiers=desired)
    _LOGGER.info(
        "Migrated Thessla Green device identity to serial for entry %s",
        entry.entry_id,
    )


def cleanup_obsolete_entities(
    hass: HomeAssistant,
    slave: int,
) -> None:
    """Remove registry entries from entity models replaced by this branch."""
    registry = er.async_get(hass)
    obsolete = (
        ("switch", f"thessla_switch_{slave}_4208"),
        ("sensor", f"thessla_sensor_{slave}_4208"),
        ("sensor", f"thessla_filter_date_{slave}_4660"),
        ("sensor", f"thessla_filter_date_{slave}_4662"),
    )

    for entity_domain, unique_id in obsolete:
        entity_id = registry.async_get_entity_id(
            entity_domain,
            DOMAIN,
            unique_id,
        )
        if entity_id:
            registry.async_remove(entity_id)
            _LOGGER.info("Removed obsolete Thessla Green entity %s", entity_id)
