from __future__ import annotations
import logging

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry

from . import DOMAIN
from .coordinator import ThesslaGreenCoordinator
from .entity_utils import register_available
from .protocol import OPERATION_MODES, SPECIAL_MODE_DETAILS, SPECIAL_MODE_READ_MAP
from .optimistic import OptimisticState

_LOGGER = logging.getLogger(__name__)

MODES = {
    "Brak trybu": 0,
    "Kominek": 2,
    "Wietrzenie": 7,
    "Okna": 10,
    "Pusty Dom": 11,
}

MODE_READ_MAP = SPECIAL_MODE_READ_MAP

SEASONS = {
    "Lato": 0,
    "Zima": 1,
}

ERV_MODES = {
    "ERV nieaktywny": 0,
    "ERV tryb 1": 1,
    "ERV tryb 2": 2,
}

COMFORT_MODES = {
    "EKO": 0,
    "KOMFORT": 1,
}

class _OptimisticSelectEntity(SelectEntity):
    """Select helper with short-lived per-entity optimistic state."""

    @callback
    def _handle_coordinator_update(self):
        self._optimistic.clear_if_confirmed(
            str(self._address),
            self.coordinator.safe_data.holding.get(self._address),
        )
        self.async_write_ha_state()


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up select entities."""
    modbus_data = hass.data[DOMAIN][entry.entry_id]
    coordinator: ThesslaGreenCoordinator = modbus_data["coordinator"]
    slave = modbus_data["slave"]
    caps = modbus_data.get("caps", {})

    entities = [
        RekuperatorOperationModeSelect(coordinator=coordinator, slave=slave),
        RekuperatorTrybSelect(coordinator=coordinator, slave=slave),
        RekuperatorSezonSelect(coordinator=coordinator, slave=slave),
        RekuperatorKomfortSelect(coordinator=coordinator, slave=slave),
    ]
    if caps.get("postheater", False):
        entities.append(
            RekuperatorErvTrybSelect(coordinator=coordinator, slave=slave)
        )

    async_add_entities(entities)


class RekuperatorOperationModeSelect(_OptimisticSelectEntity):
    """AirPack operating mode from holding register 4208."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4208
        self._slave = slave
        self._optimistic = OptimisticState()
        self._attr_name = "Rekuperator Tryb pracy"
        self._attr_options = list(OPERATION_MODES.keys())
        self._value_map = {value: name for name, value in OPERATION_MODES.items()}
        self._reverse_map = OPERATION_MODES
        self._attr_unique_id = f"thessla_operation_mode_select_{slave}_{self._address}"
        self._attr_icon = "mdi:cog"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return register_available(self.coordinator, self._address, "holding")

    @property
    def current_option(self) -> str | None:
        value = self._optimistic.get_pending(str(self._address))
        if value is None:
            value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        code = self._reverse_map.get(option)
        if code is None:
            _LOGGER.error("Unknown operating mode selected: %s", option)
            return

        try:
            success = await self.coordinator.controller.write_register(
                self._address, code
            )
            if success:
                self._optimistic.set_pending(str(self._address), code)
                self.async_write_ha_state()
                await self.coordinator.async_request_refresh()
        except Exception as e:
            _LOGGER.exception("Exception during operating mode selection: %s", e)

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )


class RekuperatorTrybSelect(_OptimisticSelectEntity):
    """Representation of Rekuperator Tryb Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4224
        self._slave = slave
        self._optimistic = OptimisticState()
        self._attr_name = "Rekuperator Tryb"
        self._attr_options = list(MODES.keys())
        self._value_map = MODE_READ_MAP
        self._reverse_map = MODES
        self._attr_unique_id = f"thessla_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return register_available(self.coordinator, self._address, "holding")

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self._optimistic.get_pending(str(self._address))
        if value is None:
            value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(self._address, code)
            if success:
                self._optimistic.set_pending(str(self._address), code)
                self.async_write_ha_state()
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during tryb selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    @property
    def extra_state_attributes(self):
        """Expose the raw special-mode code and documented trigger variant."""
        value = self._optimistic.get_pending(str(self._address))
        if value is None:
            value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return {}
        return {
            "special_code": value,
            "special_mode_detail": SPECIAL_MODE_DETAILS.get(value, "Nieznany"),
        }

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self._handle_coordinator_update))

class RekuperatorSezonSelect(_OptimisticSelectEntity):
    """Representation of Rekuperator Sezon Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4209
        self._slave = slave
        self._optimistic = OptimisticState()
        self._attr_name = "Rekuperator Sezon"
        self._attr_options = list(SEASONS.keys())
        self._value_map = {v: k for k, v in SEASONS.items()}
        self._reverse_map = SEASONS
        self._attr_unique_id = f"thessla_sezon_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return register_available(self.coordinator, self._address, "holding")

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self._optimistic.get_pending(str(self._address))
        if value is None:
            value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(self._address, code)
            if success:
                self._optimistic.set_pending(str(self._address), code)
                self.async_write_ha_state()
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during sezon selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self._handle_coordinator_update))

class RekuperatorErvTrybSelect(_OptimisticSelectEntity):
    """Representation of ERV mode Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4711
        self._slave = slave
        self._optimistic = OptimisticState()
        self._attr_name = "Rekuperator ERV tryb"
        self._attr_options = list(ERV_MODES.keys())
        self._value_map = {v: k for k, v in ERV_MODES.items()}
        self._reverse_map = ERV_MODES
        self._attr_unique_id = f"thessla_erv_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return register_available(self.coordinator, self._address, "holding")

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self._optimistic.get_pending(str(self._address))
        if value is None:
            value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown ERV option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(
                self._address, code
            )
            if success:
                self._optimistic.set_pending(str(self._address), code)
                self.async_write_ha_state()
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during ERV mode selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )


class RekuperatorKomfortSelect(_OptimisticSelectEntity):
    """Representation of ECO/KOMFORT Select."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._address = 4304
        self._slave = slave
        self._optimistic = OptimisticState()
        self._attr_name = "Rekuperator ECO/KOMFORT"
        self._attr_options = list(COMFORT_MODES.keys())
        self._value_map = {v: k for k, v in COMFORT_MODES.items()}
        self._reverse_map = COMFORT_MODES
        self._attr_unique_id = f"thessla_komfort_select_{slave}_{self._address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return register_available(self.coordinator, self._address, "holding")

    @property
    def current_option(self) -> str | None:
        """Return the current selected option."""
        value = self._optimistic.get_pending(str(self._address))
        if value is None:
            value = self.coordinator.safe_data.holding.get(self._address)
        if value is None:
            return None
        return self._value_map.get(value)

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        try:
            code = self._reverse_map.get(option)
            if code is None:
                _LOGGER.error(f"Unknown ECO/KOMFORT option selected: {option}")
                return

            success = await self.coordinator.controller.write_register(
                self._address, code
            )
            if success:
                self._optimistic.set_pending(str(self._address), code)
                self.async_write_ha_state()
                await self.coordinator.async_request_refresh()

        except Exception as e:
            _LOGGER.exception(f"Exception during ECO/KOMFORT selection: {e}")

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )
