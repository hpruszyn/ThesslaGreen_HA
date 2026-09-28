import logging
from datetime import timedelta

from homeassistant.core import callback

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN
from .modbus_controller import ThesslaGreenModbusController, ControllerData

_LOGGER = logging.getLogger(__name__)


class ThesslaGreenCoordinator(DataUpdateCoordinator[ControllerData]):

    def __init__(self, hass, controller: ThesslaGreenModbusController, scan_interval: int):
        super().__init__(
            hass=hass,
            logger=_LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=scan_interval),
        )
        self.controller = controller

    async def _async_update_data(self):
        try:
            return await self.controller.fetch_data()
        except Exception as error:
            raise UpdateFailed(error)

    @property
    def safe_data(self) -> ControllerData:
        return self.data or ControllerData()


    @callback
    def apply_optimistic(
        self,
        address: int,
        value,
        input_type: str = "holding",
    ) -> None:
        """Update cached Modbus data immediately after a successful write."""
        current = self.data
        if current is None:
            return

        updated = ControllerData(
            holding=dict(current.holding),
            input=dict(current.input),
            coil=dict(current.coil),
            discrete=dict(current.discrete),
            update_interval=current.update_interval,
        )

        if input_type == "coil":
            updated.coil[address] = bool(value)
        elif input_type == "input":
            updated.input[address] = int(value)
        elif input_type == "discrete":
            updated.discrete[address] = bool(value)
        else:
            updated.holding[address] = int(value)

        self.async_set_updated_data(updated)
