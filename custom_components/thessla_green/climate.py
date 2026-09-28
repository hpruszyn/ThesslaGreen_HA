"""Climate entity aggregating the primary Thessla Green controls."""

from __future__ import annotations

import logging

from homeassistant.components.climate import (
    ClimateEntity,
    ClimateEntityFeature,
    HVACAction,
    HVACMode,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_TEMPERATURE, UnitOfTemperature
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import DOMAIN
from .coordinator import ThesslaGreenCoordinator
from .entity_utils import register_available
from .optimistic import OptimisticState
from .protocol import decode_register

_LOGGER = logging.getLogger(__name__)

PRESETS = {
    "Brak trybu": 0,
    "Kominek": 2,
    "Wietrzenie": 7,
    "Okna": 10,
    "Pusty Dom": 11,
}

SPECIAL_READ_MAP = {
    0: "Brak trybu",
    1: "Brak trybu",  # physical hood input; never exposed as writable preset
    2: "Kominek",
    3: "Wietrzenie",
    4: "Wietrzenie",
    5: "Wietrzenie",
    6: "Wietrzenie",
    7: "Wietrzenie",
    8: "Wietrzenie",
    9: "Wietrzenie",
    10: "Okna",
    11: "Pusty Dom",
}


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    runtime = hass.data[DOMAIN][entry.entry_id]
    coordinator: ThesslaGreenCoordinator = runtime["coordinator"]

    if not (
        register_available(coordinator, 4387, "holding")
        and register_available(coordinator, 4208, "holding")
    ):
        _LOGGER.info("Climate entity skipped: basic control registers unavailable")
        return

    async_add_entities([
        ThesslaGreenClimate(
            coordinator=coordinator,
            slave=runtime["slave"],
        )
    ])


class ThesslaGreenClimate(ClimateEntity):
    """Combined power/mode/airflow/target-temperature control."""

    _attr_name = "Rekuperator"
    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_min_temp = 16.0
    _attr_max_temp = 30.0
    _attr_target_temperature_step = 0.5
    _attr_hvac_modes = [HVACMode.OFF, HVACMode.AUTO, HVACMode.FAN_ONLY]
    _attr_preset_modes = list(PRESETS.keys())
    _attr_supported_features = (
        ClimateEntityFeature.TARGET_TEMPERATURE
        | ClimateEntityFeature.FAN_MODE
        | ClimateEntityFeature.PRESET_MODE
        | ClimateEntityFeature.TURN_ON
        | ClimateEntityFeature.TURN_OFF
    )

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._slave = slave
        self._optimistic = OptimisticState()
        self._attr_unique_id = f"thessla_climate_{slave}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self) -> bool:
        return (
            self.coordinator.last_update_success
            and 4387 in self.coordinator.safe_data.holding
            and 4208 in self.coordinator.safe_data.holding
        )

    @property
    def current_temperature(self) -> float | None:
        return decode_register(
            self.coordinator.safe_data.input.get(17),
            scale=0.1,
            precision=1,
        )

    def _confirmed_target_temperature(self) -> float | None:
        return decode_register(
            self.coordinator.safe_data.holding.get(4212),
            scale=0.5,
            precision=1,
        )

    @property
    def target_temperature(self) -> float | None:
        pending = self._optimistic.get_pending("target_temperature")
        return (
            float(pending)
            if pending is not None
            else self._confirmed_target_temperature()
        )

    def _confirmed_hvac_mode(self) -> HVACMode:
        holding = self.coordinator.safe_data.holding
        if holding.get(4387) == 0:
            return HVACMode.OFF
        return HVACMode.AUTO if holding.get(4208) == 0 else HVACMode.FAN_ONLY

    @property
    def hvac_mode(self) -> HVACMode:
        pending = self._optimistic.get_pending("hvac_mode")
        return pending if pending is not None else self._confirmed_hvac_mode()

    @property
    def hvac_action(self) -> HVACAction:
        if self._confirmed_hvac_mode() == HVACMode.OFF:
            return HVACAction.OFF
        if self.coordinator.safe_data.coil.get(11):
            return HVACAction.FAN
        return HVACAction.IDLE

    def _fan_limits(self) -> tuple[int, int]:
        data = self.coordinator.safe_data.input
        minimum = data.get(276, 10)
        maximum = data.get(277, 100)
        try:
            minimum = max(10, int(minimum))
        except (TypeError, ValueError):
            minimum = 10
        try:
            maximum = min(100, int(maximum))
        except (TypeError, ValueError):
            maximum = 100
        return minimum, max(minimum, maximum)

    @property
    def fan_modes(self) -> list[str]:
        minimum, maximum = self._fan_limits()
        values = list(range(minimum, maximum + 1, 10))
        if not values or values[-1] != maximum:
            values.append(maximum)
        return [f"{value}%" for value in sorted(set(values))]

    def _confirmed_fan_mode(self) -> str | None:
        value = self.coordinator.safe_data.holding.get(4210)
        return None if value is None else f"{int(value)}%"

    @property
    def fan_mode(self) -> str | None:
        pending = self._optimistic.get_pending("fan_mode")
        return str(pending) if pending is not None else self._confirmed_fan_mode()

    def _confirmed_preset_mode(self) -> str:
        raw = self.coordinator.safe_data.holding.get(4224, 0)
        return SPECIAL_READ_MAP.get(raw, "Brak trybu")

    @property
    def preset_mode(self) -> str:
        pending = self._optimistic.get_pending("preset_mode")
        return str(pending) if pending is not None else self._confirmed_preset_mode()

    async def _write(self, address: int, value: int) -> int | None:
        try:
            return await self.coordinator.async_write_register(address, value)
        except Exception as error:
            raise HomeAssistantError(
                f"Nie udało się zapisać rejestru {address}: {error}"
            ) from error

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        if hvac_mode == HVACMode.OFF:
            confirmed = await self._write(4387, 0)
            if confirmed is None:
                self._optimistic.set_pending("hvac_mode", HVACMode.OFF)
        elif hvac_mode in (HVACMode.AUTO, HVACMode.FAN_ONLY):
            await self._write(4387, 1)
            mode = 0 if hvac_mode == HVACMode.AUTO else 1
            confirmed = await self._write(4208, mode)
            if confirmed is None:
                self._optimistic.set_pending("hvac_mode", hvac_mode)
        else:
            raise ServiceValidationError(f"Nieobsługiwany tryb HVAC: {hvac_mode}")
        self.async_write_ha_state()

    async def async_turn_on(self) -> None:
        await self.async_set_hvac_mode(HVACMode.AUTO)

    async def async_turn_off(self) -> None:
        await self.async_set_hvac_mode(HVACMode.OFF)

    async def async_set_temperature(self, **kwargs) -> None:
        value = kwargs.get(ATTR_TEMPERATURE)
        if value is None:
            return
        temperature = float(value)
        if not self._attr_min_temp <= temperature <= self._attr_max_temp:
            raise ServiceValidationError(
                f"Temperatura musi być w zakresie {self._attr_min_temp}-"
                f"{self._attr_max_temp} °C"
            )
        confirmed = await self._write(4212, round(temperature * 2))
        if confirmed is None:
            self._optimistic.set_pending("target_temperature", temperature)
        self.async_write_ha_state()

    async def async_set_fan_mode(self, fan_mode: str) -> None:
        try:
            airflow = int(fan_mode.rstrip("%"))
        except (AttributeError, ValueError) as error:
            raise ServiceValidationError(f"Nieprawidłowa intensywność: {fan_mode}") from error
        minimum, maximum = self._fan_limits()
        if not minimum <= airflow <= maximum:
            raise ServiceValidationError(
                f"Intensywność musi być w zakresie {minimum}-{maximum}%"
            )
        confirmed = await self._write(4210, airflow)
        if confirmed is None:
            self._optimistic.set_pending("fan_mode", f"{airflow}%")
        self.async_write_ha_state()

    async def async_set_preset_mode(self, preset_mode: str) -> None:
        if preset_mode not in PRESETS:
            raise ServiceValidationError(f"Nieobsługiwany preset: {preset_mode}")
        confirmed = await self._write(4224, PRESETS[preset_mode])
        if confirmed is None:
            self._optimistic.set_pending("preset_mode", preset_mode)
        self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict:
        data = self.coordinator.safe_data
        return {
            "outside_temperature": decode_register(
                data.input.get(16), scale=0.1, precision=1
            ),
            "exhaust_temperature": decode_register(
                data.input.get(18), scale=0.1, precision=1
            ),
            "supply_airflow": data.holding.get(256),
            "exhaust_airflow": data.holding.get(257),
            "special_code": data.holding.get(4224),
        }

    @callback
    def _handle_coordinator_update(self) -> None:
        self._optimistic.clear_if_confirmed(
            "target_temperature",
            self._confirmed_target_temperature(),
            tolerance=0.25,
        )
        self._optimistic.clear_if_confirmed(
            "hvac_mode",
            self._confirmed_hvac_mode(),
        )
        self._optimistic.clear_if_confirmed(
            "fan_mode",
            self._confirmed_fan_mode(),
        )
        self._optimistic.clear_if_confirmed(
            "preset_mode",
            self._confirmed_preset_mode(),
        )
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self.coordinator.async_add_listener(self._handle_coordinator_update)
        )
