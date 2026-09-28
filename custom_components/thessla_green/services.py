"""Home Assistant services for Thessla Green maintenance actions."""

from __future__ import annotations

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from .const import DOMAIN

SERVICE_RESET_FILTERS = "reset_filters"
FILTER_RESET_REGISTER = 8191
FILTER_TYPE_MAP = {
    "presostat": 1,
    "flat_filters": 2,
    "cleanpad": 3,
    "cleanpad_pure": 4,
}


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register maintenance services once."""
    if hass.services.has_service(DOMAIN, SERVICE_RESET_FILTERS):
        return

    async def _reset_filters(call: ServiceCall) -> None:
        filter_type = str(call.data.get("filter_type", "")).strip()
        if filter_type not in FILTER_TYPE_MAP:
            raise ServiceValidationError(
                f"Nieobsługiwany typ filtra: {filter_type}"
            )

        runtimes = hass.data.get(DOMAIN, {})
        entry_id = call.data.get("entry_id")
        if entry_id:
            runtime = runtimes.get(entry_id)
            if runtime is None:
                raise ServiceValidationError(
                    f"Nie znaleziono wpisu Thessla Green: {entry_id}"
                )
            targets = [runtime]
        else:
            targets = list(runtimes.values())

        if not targets:
            raise HomeAssistantError("Brak aktywnej integracji Thessla Green")
        if len(targets) > 1 and not entry_id:
            raise ServiceValidationError(
                "Skonfigurowano wiele central. Podaj entry_id."
            )

        value = FILTER_TYPE_MAP[filter_type]
        for runtime in targets:
            coordinator = runtime["coordinator"]
            try:
                success = await coordinator.async_write_trigger_register(
                    FILTER_RESET_REGISTER,
                    value,
                )
            except Exception as error:
                raise HomeAssistantError(
                    f"Nie udało się zresetować liczników filtrów: {error}"
                ) from error
            if not success:
                raise HomeAssistantError(
                    "Centrala nie potwierdziła resetu liczników filtrów"
                )

    hass.services.async_register(
        DOMAIN,
        SERVICE_RESET_FILTERS,
        _reset_filters,
    )
