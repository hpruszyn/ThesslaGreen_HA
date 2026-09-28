from __future__ import annotations

from typing import Any


def register_available(
    coordinator: Any,
    address: int,
    input_type: str = "holding",
) -> bool:
    """Return True only when the latest successful poll contains this address."""
    if not coordinator.last_update_success:
        return False

    data = coordinator.safe_data
    source = {
        "holding": data.holding,
        "input": data.input,
        "coil": data.coil,
        "discrete": data.discrete,
    }.get(input_type)
    return source is not None and address in source
