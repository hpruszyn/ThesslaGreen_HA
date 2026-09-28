import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT, CONF_SCAN_INTERVAL
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, CONF_SLAVE


class ThesslaGreenConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Thessla Green."""

    VERSION = 1
    CONNECTION_CLASS = config_entries.CONN_CLASS_LOCAL_POLL

    async def async_step_user(self, user_input=None) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Thessla Green", data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST): str,
                vol.Required(CONF_PORT, default=8899): int,
                vol.Required(CONF_SLAVE, default=10): int,
                vol.Optional(CONF_SCAN_INTERVAL, default=30): int,
            })
        )

    async def async_step_reconfigure(self, user_input=None) -> FlowResult:
        """Allow connection settings to be changed without re-adding the integration."""
        entry = self.hass.config_entries.async_get_entry(self.context["entry_id"])

        if user_input is not None:
            return self.async_update_reload_and_abort(
                entry,
                data={**entry.data, **user_input},
            )

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=vol.Schema({
                vol.Required(
                    CONF_HOST,
                    default=entry.data.get(CONF_HOST),
                ): str,
                vol.Required(
                    CONF_PORT,
                    default=entry.data.get(CONF_PORT, 8899),
                ): int,
                vol.Required(
                    CONF_SLAVE,
                    default=entry.data.get(CONF_SLAVE, 10),
                ): int,
                vol.Optional(
                    CONF_SCAN_INTERVAL,
                    default=entry.data.get(CONF_SCAN_INTERVAL, 30),
                ): int,
            }),
        )

    @staticmethod
    def async_get_options_flow(config_entry):
        """Link to options flow handler."""
        from .options_flow import ThesslaGreenOptionsFlowHandler
        return ThesslaGreenOptionsFlowHandler()