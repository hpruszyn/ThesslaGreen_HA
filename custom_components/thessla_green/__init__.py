from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, CONF_HOST, CONF_PORT, CONF_SLAVE, CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL
from .modbus_controller import ThesslaGreenModbusController
from .coordinator import ThesslaGreenCoordinator
from .protocol import detect_capabilities
from .services import async_setup_services
from .migrations import (
    async_migrate_entry,
    cleanup_obsolete_entities,
    migrate_device_identifier,
)

import logging
import os

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "switch", "binary_sensor", "select", "number", "button", "climate"]

# Lovelace card adapted from bwojtyca/ThesslaGreen_HA.
CARD_VERSION = "3.2.1-hp1"
CARD_URL = f"/{DOMAIN}/thessla-green-card.js"
CARD_PATH = os.path.join(os.path.dirname(__file__), "www", "thessla-green-card.js")


async def _register_card(hass: HomeAssistant) -> None:
    """Serve and auto-register the bundled ThesslaGreen Lovelace card."""
    if not os.path.exists(CARD_PATH):
        _LOGGER.error("ThesslaGreen card not found at %s", CARD_PATH)
        return

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, CARD_PATH, False)]
        )
    except AttributeError:
        try:
            hass.http.register_static_path(CARD_URL, CARD_PATH, False)
        except Exception as error:
            _LOGGER.error("Could not serve ThesslaGreen card: %s", error)
            return
    except Exception as error:
        _LOGGER.error("Could not serve ThesslaGreen card: %s", error)
        return

    try:
        from homeassistant.components.frontend import add_extra_js_url

        add_extra_js_url(hass, f"{CARD_URL}?v={CARD_VERSION}")
    except Exception as error:
        _LOGGER.error("Could not register ThesslaGreen card module: %s", error)
        return

    _LOGGER.info("ThesslaGreen card registered from %s", CARD_URL)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the integration, services and bundled Lovelace card."""
    await _register_card(hass)
    await async_setup_services(hass)
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Thessla Green integration from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    host = entry.data[CONF_HOST]
    port = entry.data[CONF_PORT]
    slave = entry.data[CONF_SLAVE]
    update_interval = entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL)

    # Tworzenie kontrolera Modbus
    controller = ThesslaGreenModbusController(
        host=host,
        port=port,
        slave_id=slave,
        update_interval=update_interval,
    )

    # Tworzenie koordynatora danych
    coordinator = ThesslaGreenCoordinator(
        hass=hass,
        controller=controller,
        scan_interval=update_interval,
        entry=entry,
    )

    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as e:
        _LOGGER.error("Failed to fetch initial data: %s", e)
        return False

    migrate_device_identifier(hass, entry, coordinator, slave)
    cleanup_obsolete_entities(hass, slave)

    coordinator.capabilities.update(
        detect_capabilities(coordinator.safe_data)
    )

    # Zapisywanie instancji w hass.data
    hass.data[DOMAIN][entry.entry_id] = {
        "controller": controller,
        "coordinator": coordinator,
        "slave": slave,
        "scan_interval": update_interval,
        "caps": coordinator.capabilities,
    }

    # Forward setup dla każdej platformy
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload Thessla Green integration."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    data = hass.data[DOMAIN].pop(entry.entry_id, None)
    if data:
        controller: ThesslaGreenModbusController = data["controller"]
        await controller.stop()

    return unload_ok