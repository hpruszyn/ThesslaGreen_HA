from __future__ import annotations
import logging
from datetime import date

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import UnitOfTemperature, UnitOfTime, EntityCategory
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.event import async_track_state_change_event

from . import DOMAIN
from .modbus_controller import ThesslaGreenModbusController
from .coordinator import ThesslaGreenCoordinator

_LOGGER = logging.getLogger(__name__)

SENSORS = [
    # Temperatura
    {"name": "Rekuperator Temperatura Czerpnia", "address": 16, "input_type": "input", "scale": 0.1, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer"},
    {"name": "Rekuperator Temperatura Nawiew", "address": 17, "input_type": "input", "scale": 0.1, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer"},
    {"name": "Rekuperator Temperatura Wywiew", "address": 18, "input_type": "input", "scale": 0.1, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer"},
    {"name": "Rekuperator Temperatura za FPX", "address": 19, "input_type": "input", "scale": 0.1, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer"},
    {"name": "Rekuperator Temperatura otoczenia", "address": 22, "input_type": "input", "scale": 0.1, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer"},
    # Przepływy
    {"name": "Rekuperator Strumień nawiew", "address": 256, "input_type": "holding", "scale": 1, "precision": 1, "unit": "m3/h", "icon": "mdi:fan"},
    {"name": "Rekuperator Strumień wywiew", "address": 257, "input_type": "holding", "scale": 1, "precision": 1, "unit": "m3/h", "icon": "mdi:fan"},
    {"name": "Rekuperator Strumień nominalny nawiew", "address": 4354, "input_type": "holding", "scale": 1, "precision": 0, "unit": "m3/h", "icon": "mdi:fan-chevron-up"},
    {"name": "Rekuperator Strumień nominalny wywiew", "address": 4355, "input_type": "holding", "scale": 1, "precision": 0, "unit": "m3/h", "icon": "mdi:fan-chevron-down"},

    # Wysterowanie i rozszerzona diagnostyka
    {"name": "Rekuperator Wydajność nawiew", "address": 1280, "input_type": "holding", "scale": 0.02442, "precision": 0, "unit": "%", "icon": "mdi:fan"},
    {"name": "Rekuperator Wydajność wywiew", "address": 1281, "input_type": "holding", "scale": 0.02442, "precision": 0, "unit": "%", "icon": "mdi:fan"},
    {"name": "Rekuperator Nagrzewnica", "address": 1282, "input_type": "holding", "scale": 0.02442, "precision": 0, "unit": "%", "icon": "mdi:radiator"},
    {"name": "Rekuperator Chłodnica", "address": 1283, "input_type": "holding", "scale": 0.02442, "precision": 0, "unit": "%", "icon": "mdi:snowflake"},
    {"name": "Rekuperator Status bypass", "address": 4330, "input_type": "holding", "icon": "mdi:valve"},
    {"name": "Rekuperator Kod alarmu", "address": 4384, "input_type": "holding", "icon": "mdi:alert-circle-outline"},

    # Temperatury i progi konfiguracyjne
    {"name": "Rekuperator Temperatura zadana", "address": 4212, "input_type": "holding", "scale": 0.5, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer-lines"},
    {"name": "Rekuperator Temperatura komfort", "address": 8190, "input_type": "holding", "scale": 0.5, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:home-thermometer"},
    {"name": "Rekuperator Bypass próg min", "address": 4321, "input_type": "holding", "scale": 0.5, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer-low"},
    {"name": "Rekuperator Bypass próg grzanie", "address": 4322, "input_type": "holding", "scale": 0.5, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer-plus"},
    {"name": "Rekuperator Bypass próg chłodzenie", "address": 4323, "input_type": "holding", "scale": 0.5, "precision": 1, "unit": UnitOfTemperature.CELSIUS, "icon": "mdi:thermometer-minus"},
    # Statusy i flagi
    {"name": "Rekuperator speedmanual", "address": 4210, "input_type": "holding", "unit": "%", "icon": "mdi:speedometer"},

    # Constant Flow (FC04 / input registers)
    {"name": "Rekuperator CF intensywność nawiew", "address": 272, "input_type": "input", "unit": "%", "icon": "mdi:fan", "requires_cap": "cf"},
    {"name": "Rekuperator CF intensywność wywiew", "address": 273, "input_type": "input", "unit": "%", "icon": "mdi:fan", "requires_cap": "cf"},
    {"name": "Rekuperator CF strumień nawiew", "address": 274, "input_type": "input", "unit": "m3/h", "icon": "mdi:fan", "requires_cap": "cf"},
    {"name": "Rekuperator CF strumień wywiew", "address": 275, "input_type": "input", "unit": "m3/h", "icon": "mdi:fan", "requires_cap": "cf"},
    {"name": "Rekuperator CF intensywność min", "address": 276, "input_type": "input", "unit": "%", "icon": "mdi:speedometer-slow", "requires_cap": "cf"},
    {"name": "Rekuperator CF intensywność max", "address": 277, "input_type": "input", "unit": "%", "icon": "mdi:speedometer", "requires_cap": "cf"},

    # Filtry
    {"name": "Rekuperator Filtr nawiew zużycie", "address": 4482, "input_type": "holding", "unit": "%", "icon": "mdi:air-filter"},
    {"name": "Rekuperator Filtr wywiew zużycie", "address": 4483, "input_type": "holding", "unit": "%", "icon": "mdi:air-filter"},
]

FILTER_DATE_SENSORS = [
    {"name": "Rekuperator Filtr nawiew data wymiany", "address": 4660},
    {"name": "Rekuperator Filtr wywiew data wymiany", "address": 4662},
]


def _read_device_metadata(coordinator: ThesslaGreenCoordinator) -> dict:
    """Build firmware version and serial number from AirPack input registers."""
    inp = coordinator.safe_data.input
    metadata: dict = {}

    major = inp.get(0)
    minor = inp.get(1)
    patch = inp.get(4)
    if None not in (major, minor, patch):
        metadata["sw_version"] = f"{major}.{minor}.{patch}"

    serial_regs = [inp.get(address) for address in range(24, 30)]
    if None not in serial_regs:
        hex_value = "".join(f"{value & 0xFF:02x}" for value in serial_regs)
        metadata["serial_number"] = (
            f"{hex_value[0:4]} {hex_value[4:8]} {hex_value[8:12]}"
        )

    return metadata


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    modbus_data = hass.data[DOMAIN][entry.entry_id]
    coordinator: ThesslaGreenCoordinator = modbus_data["coordinator"]
    slave = modbus_data["slave"]
    caps = modbus_data.get("caps", {})

    entities = [
        ModbusGenericSensor(
            coordinator=coordinator,
            slave=slave,
            **{key: value for key, value in sensor.items() if key != "requires_cap"},
        )
        for sensor in SENSORS
        if not sensor.get("requires_cap") or caps.get(sensor["requires_cap"], False)
    ]

    entities.extend(
        PackedFilterDateSensor(
            coordinator=coordinator,
            slave=slave,
            **sensor,
        )
        for sensor in FILTER_DATE_SENSORS
    )

    # Dodaj sensor diagnostyczny
    entities.append(ModbusUpdateIntervalSensor(coordinator=coordinator, slave=slave))

    # Metryki obliczane
    power_entity = entry.options.get("sensor_power")  # W lub kW
    if not power_entity:
        _LOGGER.warning("Nie skonfigurowano 'sensor_power' w opcjach integracji – COP będzie 'unavailable'.")

    entities.extend([
        RekuEfficiencySensor(coordinator=coordinator, slave=slave),
        RekuRecoveryPowerSensor(coordinator=coordinator, slave=slave),
        RekuCOPSensor(coordinator=coordinator, slave=slave, power_entity=power_entity),
    ])

    async_add_entities(entities)

class ModbusGenericSensor(SensorEntity):
    """Representation of a standard Modbus sensor."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, name, address, input_type="holding", scale=1.0, precision=0, unit=None, icon=None, slave=1):
        self.coordinator = coordinator
        self._address = address
        self._input_type = input_type
        self._scale = scale
        self._precision = precision
        self._unit = unit
        self._slave = slave
        self._attr_name = name
        self._attr_native_unit_of_measurement = unit
        self._attr_native_value = None
        self._attr_icon = icon
        self._attr_unique_id = f"thessla_sensor_{slave}_{address}"

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
            **_read_device_metadata(coordinator),
        }

    @property
    def available(self):
        return self.coordinator.last_update_success

    @property
    def native_value(self):
        if self._input_type == "input":
            raw_value = self.coordinator.safe_data.input.get(self._address)
        else:
            raw_value = self.coordinator.safe_data.holding.get(self._address)

        if raw_value is None or raw_value == 0x8000:
            return None

        # Konwersja na signed int16
        raw = raw_value
        if raw > 0x7FFF:
            raw -= 0x10000

        value = raw * self._scale
        return round(value, self._precision)

    async def async_update(self):
        # Brak potrzeby ręcznego update — coordinator steruje
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))


class PackedFilterDateSensor(SensorEntity):
    """Filter replacement date stored as a packed 16-bit AirPack value."""

    _attr_device_class = SensorDeviceClass.DATE
    _attr_icon = "mdi:calendar-clock"

    def __init__(
        self,
        coordinator: ThesslaGreenCoordinator,
        slave: int,
        name: str,
        address: int,
    ):
        self.coordinator = coordinator
        self._slave = slave
        self._address = address
        self._attr_name = name
        self._attr_unique_id = f"thessla_sensor_{slave}_{address}"
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
            **_read_device_metadata(coordinator),
        }

    @property
    def available(self) -> bool:
        return self.coordinator.last_update_success

    @property
    def native_value(self) -> date | None:
        """Decode day(b0-b4), month(b5-b8), year(b9-b15)."""
        raw = self.coordinator.safe_data.holding.get(self._address)
        if raw is None:
            return None

        day = raw & 0x1F
        month = (raw >> 5) & 0x0F
        year = 2000 + ((raw >> 9) & 0x7F)

        try:
            return date(year, month, day)
        except ValueError:
            _LOGGER.warning(
                "Invalid packed filter replacement date in register %d: 0x%04X",
                self._address,
                raw,
            )
            return None

    async def async_update(self):
        """No-op, data provided by coordinator."""
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(
            self.coordinator.async_add_listener(self.async_write_ha_state)
        )


class ModbusUpdateIntervalSensor(SensorEntity):
    """Diagnostic sensor showing time between full Modbus updates."""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._slave = slave
        self._attr_name = "Modbus Update Interval"
        self._attr_native_unit_of_measurement = UnitOfTime.SECONDS
        self._attr_unique_id = f"thessla_update_interval_{slave}"
        self._attr_icon = "mdi:clock-time-eight"
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self):
        return self.coordinator.last_update_success

    @property
    def native_value(self):
        return self.coordinator.safe_data.update_interval

    async def async_update(self):
        # Niepotrzebne — wszystko przez coordinator
        pass

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self.async_write_ha_state))

# =============================
#  Metryki: sprawność / moc / COP
# =============================

class _BaseComputedSensor(SensorEntity):
    """Baza dla sensorów liczonych z koordynatora."""
    _attr_should_poll = False

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        self.coordinator = coordinator
        self._slave = slave
        self._attr_native_value = None
        self._attr_device_info = {
            "identifiers": {(DOMAIN, f"{slave}")},
            "name": "Rekuperator Thessla",
            "manufacturer": "Thessla Green",
            "model": "Modbus Rekuperator",
        }

    @property
    def available(self):
        return self.coordinator.last_update_success and self._attr_native_value is not None

    async def async_added_to_hass(self):
        self.async_on_remove(self.coordinator.async_add_listener(self._handle_coordinator_update))
        self._recalc()
        self.async_write_ha_state()

    @callback
    def _handle_coordinator_update(self):
        self._recalc()
        self.async_write_ha_state()

    # Helpers (adresy „na sztywno” wg Twoich definicji):
    def _read_temp_czerpnia(self) -> float | None:
        return self._read_input_scaled(addr=16, scale=0.1, precision=1)

    def _read_temp_nawiew(self) -> float | None:
        return self._read_input_scaled(addr=17, scale=0.1, precision=1)

    def _read_temp_wywiew(self) -> float | None:
        return self._read_input_scaled(addr=18, scale=0.1, precision=1)

    def _read_flow_nawiew(self) -> float | None:
        return self._read_holding_scaled(addr=256, scale=1.0)

    def _read_input_scaled(self, addr: int, scale: float, precision: int) -> float | None:
        raw = self.coordinator.safe_data.input.get(addr)
        if raw is None or raw == 0x8000:
            return None
        if raw > 0x7FFF:
            raw -= 0x10000
        return round(raw * scale, precision)

    def _read_holding_scaled(self, addr: int, scale: float) -> float | None:
        raw = self.coordinator.safe_data.holding.get(addr)
        if raw is None:
            return None
        if raw > 0x7FFF:
            raw -= 0x10000
        return float(raw) * scale

    def _recalc(self):
        raise NotImplementedError


class RekuEfficiencySensor(_BaseComputedSensor):
    """Sprawność [%] = ((Tnawiew - Tczerpnia) / (Twywiew - Tczerpnia)) * 100"""
    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        super().__init__(coordinator, slave)
        self._attr_name = "Rekuperator Sprawność"
        self._attr_unique_id = f"thessla_efficiency_{slave}"
        self._attr_icon = "mdi:percent"
        self._attr_native_unit_of_measurement = "%"

    def _recalc(self):
        To = self._read_temp_czerpnia()
        Te = self._read_temp_wywiew()
        Ts = self._read_temp_nawiew()
        if None in (To, Te, Ts):
            self._attr_native_value = None
            return
        denom = Te - To
        if abs(denom) < 0.5:
            self._attr_native_value = None
            return
        self._attr_native_value = round(((Ts - To) / denom) * 100.0, 1)


class RekuRecoveryPowerSensor(_BaseComputedSensor):
    """Moc odzysku [kW] ≈ 0.000335 * V[m3/h] * ΔT[°C]"""
    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int):
        super().__init__(coordinator, slave)
        self._attr_name = "Rekuperator Moc Odzysku"
        self._attr_unique_id = f"thessla_recovery_power_{slave}"
        self._attr_icon = "mdi:fire"
        self._attr_native_unit_of_measurement = "kW"

    def _recalc(self):
        To = self._read_temp_czerpnia()
        Ts = self._read_temp_nawiew()
        flow = self._read_flow_nawiew()  # m3/h
        if None in (To, Ts) or flow is None or flow <= 0:
            self._attr_native_value = None
            return
        q_kw = 0.000335 * flow * (Ts - To)
        self._attr_native_value = round(q_kw, 3)


class RekuCOPSensor(_BaseComputedSensor):
    """COP = (moc odzysku [kW]) / (pobór elektryczny [kW]) – bez jednostki"""

    def __init__(self, coordinator: ThesslaGreenCoordinator, slave: int, power_entity: str | None):
        super().__init__(coordinator, slave)
        self._attr_name = "Rekuperator COP"
        self._attr_unique_id = f"thessla_cop_{slave}"
        self._attr_icon = "mdi:chart-line"
        self._attr_native_unit_of_measurement = "x"
        self._power_entity = power_entity
        self._last_power_val = None
        self._last_power_unit = None

    @property
    def extra_state_attributes(self):
        return {
            "power_entity": self._power_entity,
            "power_value_raw": self._last_power_val,
            "power_unit": self._last_power_unit,
        }

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        # nasłuch zmian sensora mocy - BEZPIECZNIE w event loop
        if self._power_entity:
            @callback
            def _on_power_change(event):
                self._recalc()
                self.async_write_ha_state()

            unsub = async_track_state_change_event(
                self.hass,
                [self._power_entity],
                _on_power_change,
            )
            self.async_on_remove(unsub)

    def _read_power_kw(self) -> float | None:
        """Czyta sensor mocy z HA, zwraca w kW (auto-konwersja W→kW)."""
        if not self._power_entity:
            return None
        st = self.hass.states.get(self._power_entity)
        if not st:
            return None

        unit = (st.attributes.get("unit_of_measurement") or "").strip()
        self._last_power_unit = unit

        try:
            val = float(st.state)
        except (TypeError, ValueError):
            self._last_power_val = st.state
            return None

        self._last_power_val = val
        u = unit.lower()

        if u in ("w", "watt"):
            return val / 1000.0
        if u == "kw":
            return val
        if "kwh" in u:
            _LOGGER.warning(
                "Wybrany sensor '%s' podaje energię (%s), a nie moc. COP wymaga mocy chwilowej w W/kW.",
                self._power_entity, unit
            )
            return None
        # Brak/inna jednostka — traktuj jako kW (log diagnostyczny)
        _LOGGER.debug("Sensor mocy '%s' ma jednostkę '%s' – przyjmuję jako kW.", self._power_entity, unit)
        return val

    def _recalc(self):
        To = self._read_temp_czerpnia()
        Ts = self._read_temp_nawiew()
        flow = self._read_flow_nawiew()
        p_kw = self._read_power_kw()

        if None in (To, Ts) or flow is None or flow <= 0 or p_kw is None or p_kw <= 0:
            self._attr_native_value = None
            return

        q_kw = 0.000335 * flow * (Ts - To)
        self._attr_native_value = round(q_kw / p_kw, 2) if q_kw > 0 else None