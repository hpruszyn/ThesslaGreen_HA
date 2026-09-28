import logging
from datetime import timedelta

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN
from .modbus_controller import ThesslaGreenModbusController, ControllerData
from .repairs import clear_write_failure_issue, create_write_failure_issue

_LOGGER = logging.getLogger(__name__)


class ThesslaGreenCoordinator(DataUpdateCoordinator[ControllerData]):

    def __init__(
        self,
        hass,
        controller: ThesslaGreenModbusController,
        scan_interval: int,
        entry=None,
    ):
        super().__init__(
            hass=hass,
            logger=_LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=scan_interval),
        )
        self.controller = controller
        self.config_entry = entry
        self.last_validation_report: dict | None = None

    async def _async_update_data(self):
        try:
            return await self.controller.fetch_data()
        except Exception as error:
            raise UpdateFailed(error)

    @property
    def safe_data(self) -> ControllerData:
        return self.data or ControllerData()

    async def async_validate_known_registers(self) -> dict:
        """Run the safe, non-brute-force register validation."""
        report = await self.controller.validate_known_registers()
        self.last_validation_report = report
        return report


    async def async_write_register(self, address: int, value: int) -> int | None:
        """Write, read back, publish confirmed state and manage Repairs."""
        try:
            confirmed = await self.controller.write_register_with_readback(
                address, value
            )
        except Exception:
            create_write_failure_issue(
                self.hass,
                self.config_entry,
                register=str(address),
            )
            raise

        clear_write_failure_issue(self.hass, self.config_entry)

        if confirmed is None or self.data is None:
            return confirmed

        current = self.data
        holding = dict(current.holding)
        holding[address] = confirmed
        self.async_set_updated_data(
            ControllerData(
                holding=holding,
                input=dict(current.input),
                coil=dict(current.coil),
                discrete=dict(current.discrete),
                update_interval=current.update_interval,
            )
        )
        return confirmed
