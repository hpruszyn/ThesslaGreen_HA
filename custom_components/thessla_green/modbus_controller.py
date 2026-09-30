import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Dict

from pymodbus.client import AsyncModbusTcpClient

_LOGGER = logging.getLogger(__name__)


@dataclass
class ControllerData:
    holding: Dict[int, int] = field(default_factory=dict)
    input: Dict[int, int] = field(default_factory=dict)
    coil: Dict[int, bool] = field(default_factory=dict)
    discrete: Dict[int, bool] = field(default_factory=dict)
    update_interval: float = 0.0


class ControllerException(Exception):
    def __init__(self, message):
        super().__init__(message)


class ThesslaGreenModbusController:

    def __init__(self, host: str, port: int, slave_id: int, update_interval: int = 30):
        self._host = host
        self._port = port
        self._slave = slave_id
        self._update_interval = update_interval

        self._client = AsyncModbusTcpClient(
            host=self._host,
            port=self._port,
            reconnect_delay=1,
            reconnect_delay_max=300,
            retries=10,
        )
        self._controller_lock = asyncio.Lock()

        self._last_update_timestamp: float = 0
        self._last_update_interval: float = 0

        self._holding_blocks = [
            (256, 2), (1280, 4),
            (4192, 2), (4198, 1), (4208, 4), (4212, 2),
            (4224, 1), (4228, 1), (4230, 1), (4232, 2), (4237, 1), (4239, 1),
            (4320, 4), (4330, 1), (4354, 2), (4384, 1), (4387, 1),
            (4482, 2), (4660, 1), (4662, 1),
            (8190, 1), (8192, 2), (8208, 1), (8222, 2), (8330, 2), (4704, 1), (4711, 1), (8444, 1), (4304, 2)
        ]
        self._input_blocks = [(0, 2), (4, 1), (16, 4), (22, 1), (24, 6), (271, 7)]
        self._coil_blocks = [(9, 3)]
        self._discrete_blocks = [(0, 22)]

        # Weekly AUTO schedule, read on a slow cadence and cached. The schedule
        # is configuration data, so there is no need to add ~11 extra Modbus
        # requests to every normal poll.
        self._schedule_blocks = [
            (16, 16), (32, 16), (48, 16), (64, 16), (80, 16),
            (96, 16), (112, 16), (128, 16), (144, 16), (160, 16),
            (176, 5),
        ]
        self._schedule_cache: dict[int, int] = {}
        self._poll_count = 0

        # Addresses explicitly used by this integration. Validation probes these
        # one-by-one on demand; it never brute-forces unknown Modbus ranges.
        self._known_addresses = {
            "holding": sorted({
                16, 44, 72, 100, 128, 156, 180,
                256, 257, 1280, 1281, 1282, 1283,
                4192, 4198, 4208, 4209, 4210, 4211, 4212, 4213,
                4224, 4228, 4230, 4232, 4233, 4237, 4239,
                4304, 4305, 4320, 4321, 4322, 4323, 4330,
                4354, 4355, 4384, 4387, 4482, 4483, 4660, 4662,
                4704, 4711, 8190, 8191, 8192, 8193, 8208,
                8222, 8223, 8330, 8331, 8444,
            }),
            "input": sorted({
                0, 1, 4, 16, 17, 18, 19, 22,
                24, 25, 26, 27, 28, 29,
                271, 272, 273, 274, 275, 276, 277,
            }),
            "coil": [9, 10, 11],
            "discrete": list(range(22)),
        }

    async def stop(self):
        async with self._controller_lock:
            _LOGGER.info("Stopping Modbus controller for %s:%d", self._host, self._port)
            self._client.close()

    async def _try_read_registers(self, func, start: int, count: int):
        """Read one Modbus register block and return values or None on failure."""
        try:
            result = await func(
                address=start,
                count=count,
                device_id=self._slave,
            )
        except Exception as e:
            _LOGGER.debug(
                "Read %d-%d raised an exception and will be skipped: %s",
                start,
                start + count - 1,
                e,
            )
            return None

        if result is None or result.isError():
            _LOGGER.debug(
                "Read %d-%d failed and will be skipped",
                start,
                start + count - 1,
            )
            return None

        return result.registers

    async def fetch_data(self) -> ControllerData:
        async with self._controller_lock:
            await self._ensure_connected()

            data_holding: dict[int, int] = {}
            data_input: dict[int, int] = {}
            data_coil: dict[int, bool] = {}
            data_discrete: dict[int, bool] = {}

            now = time.time()
            if self._last_update_timestamp:
                self._last_update_interval = now - self._last_update_timestamp
                _LOGGER.debug("Time since last update: %.2f seconds", self._last_update_interval)
            self._last_update_timestamp = now

            _LOGGER.debug("Reading all register blocks for slave %d", self._slave)

            # Tolerate unsupported or temporarily failing blocks. Different
            # AirPack variants/firmware revisions may expose slightly different
            # register ranges, so one failed block should not invalidate the
            # complete update if the rest of the unit is still reachable.
            read_ok = 0

            # Read holding registers
            for start, count in self._holding_blocks:
                registers = await self._try_read_registers(
                    self._client.read_holding_registers,
                    start,
                    count,
                )
                if registers is None:
                    continue

                for i, val in enumerate(registers):
                    data_holding[start + i] = val
                read_ok += len(registers)
                _LOGGER.debug(
                    "Holding registers %d-%d read: %s",
                    start,
                    start + count - 1,
                    registers,
                )

            # Weekly AUTO schedule: read on the first successful poll and then
            # approximately every 10 minutes at the default 30 s scan interval.
            # Partial schedule reads are tolerated and cached.
            self._poll_count += 1
            if not self._schedule_cache or self._poll_count % 20 == 0:
                for start, count in self._schedule_blocks:
                    registers = await self._try_read_registers(
                        self._client.read_holding_registers,
                        start,
                        count,
                    )
                    if registers is None:
                        continue
                    for i, val in enumerate(registers):
                        self._schedule_cache[start + i] = val

            for address, value in self._schedule_cache.items():
                data_holding.setdefault(address, value)

            # Read input registers
            for start, count in self._input_blocks:
                registers = await self._try_read_registers(
                    self._client.read_input_registers,
                    start,
                    count,
                )
                if registers is None:
                    continue

                for i, val in enumerate(registers):
                    data_input[start + i] = val
                read_ok += len(registers)
                _LOGGER.debug(
                    "Input registers %d-%d read: %s",
                    start,
                    start + count - 1,
                    registers,
                )

            # Read coils
            for start, count in self._coil_blocks:
                try:
                    result = await self._client.read_coils(
                        address=start,
                        count=count,
                        device_id=self._slave,
                    )
                except Exception as e:
                    _LOGGER.debug(
                        "Coils %d-%d raised an exception and will be skipped: %s",
                        start,
                        start + count - 1,
                        e,
                    )
                    continue

                if result is None or result.isError():
                    _LOGGER.debug(
                        "Coils %d-%d failed and will be skipped",
                        start,
                        start + count - 1,
                    )
                    continue

                for i, val in enumerate(result.bits[:count]):
                    data_coil[start + i] = bool(val)
                read_ok += count
                _LOGGER.debug(
                    "Coils %d-%d read: %s",
                    start,
                    start + count - 1,
                    result.bits[:count],
                )

            # Read discrete inputs (FC02) for physical input states.
            for start, count in self._discrete_blocks:
                try:
                    result = await self._client.read_discrete_inputs(
                        address=start,
                        count=count,
                        device_id=self._slave,
                    )
                except Exception as e:
                    _LOGGER.debug(
                        "Discrete inputs %d-%d raised an exception and will be skipped: %s",
                        start,
                        start + count - 1,
                        e,
                    )
                    continue

                if result is None or result.isError():
                    _LOGGER.debug(
                        "Discrete inputs %d-%d failed and will be skipped",
                        start,
                        start + count - 1,
                    )
                    continue

                for i, val in enumerate(result.bits[:count]):
                    data_discrete[start + i] = bool(val)
                read_ok += count
                _LOGGER.debug(
                    "Discrete inputs %d-%d read: %s",
                    start,
                    start + count - 1,
                    result.bits[:count],
                )

            if read_ok == 0:
                raise ControllerException(
                    "No Modbus data could be read; device may be unreachable"
                )

            return ControllerData(
                holding=data_holding,
                input=data_input,
                coil=data_coil,
                discrete=data_discrete,
                update_interval=round(self._last_update_interval, 2)
            )

    async def validate_known_registers(self) -> dict[str, dict[str, list[int]]]:
        """Validate only Modbus addresses already known to the integration."""
        async with self._controller_lock:
            await self._ensure_connected()

            report = {
                kind: {"supported": [], "unsupported": [], "indeterminate": []}
                for kind in self._known_addresses
            }
            functions = {
                "holding": self._client.read_holding_registers,
                "input": self._client.read_input_registers,
                "coil": self._client.read_coils,
                "discrete": self._client.read_discrete_inputs,
            }

            for kind, addresses in self._known_addresses.items():
                func = functions[kind]
                for address in addresses:
                    try:
                        result = await func(
                            address=address,
                            count=1,
                            device_id=self._slave,
                        )
                    except Exception as error:
                        _LOGGER.debug(
                            "Validation %s %d indeterminate: %s",
                            kind,
                            address,
                            error,
                        )
                        report[kind]["indeterminate"].append(address)
                        continue

                    if result is None or result.isError():
                        report[kind]["unsupported"].append(address)
                    else:
                        report[kind]["supported"].append(address)

            return report

    async def write_register_with_readback(
        self,
        address: int,
        value: int,
    ) -> int | None:
        """Write one holding register and immediately read back that address.

        The write and read-back share the controller lock so a normal poll cannot
        interleave between them. A successful write with an unavailable read-back
        returns None; the entity keeps its short-lived optimistic state until the
        next regular poll confirms the value.
        """
        async with self._controller_lock:
            await self._ensure_connected()

            try:
                _LOGGER.debug(
                    "Writing register %d = %s with targeted read-back (slave=%d)",
                    address,
                    value,
                    self._slave,
                )
                result = await self._client.write_register(
                    address=address,
                    value=value,
                    device_id=self._slave,
                )
                if result is None or result.isError():
                    raise ControllerException(
                        f"Failed to write register {address} with value {value}"
                    )

                readback = await self._client.read_holding_registers(
                    address=address,
                    count=1,
                    device_id=self._slave,
                )
                if readback is None or readback.isError() or not readback.registers:
                    _LOGGER.warning(
                        "Register %d write succeeded but targeted read-back failed",
                        address,
                    )
                    return None

                confirmed = int(readback.registers[0])
                _LOGGER.debug(
                    "Register %d targeted read-back confirmed value %s",
                    address,
                    confirmed,
                )
                return confirmed
            except ControllerException:
                raise
            except Exception as error:
                raise ControllerException(
                    f"Exception writing register {address} = {value}: {error}"
                ) from error

    async def write_register(self, address: int, value: int) -> bool:
        async with self._controller_lock:
            await self._ensure_connected()

            try:
                _LOGGER.debug("Writing register %d = %s (slave=%d)", address, value, self._slave)
                result = await self._client.write_register(address=address, value=value, device_id=self._slave)
                if result.isError():
                    raise ControllerException(f"Failed to write register {address} with value {value}")
                _LOGGER.info("Successfully wrote register %d = %s", address, value)
                return True
            except Exception as e:
                raise ControllerException(f"Exception writing register {address} = {value}: {e}") from e

    async def _ensure_connected(self):
        if self._client.connected:
            return

        _LOGGER.info("Attempting connection to Modbus server %s:%d", self._host, self._port)
        try:
            if await self._client.connect():
                _LOGGER.info("Successfully connected to Modbus server %s:%d", self._host, self._port)
                return
        except Exception as e:
            raise ControllerException(f"Exception during Modbus connection to {self._host}:{self._port}: {e}") from e

        raise ControllerException(f"Failed to connect to Modbus server {self._host}:{self._port}")
