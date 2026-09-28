"""Short-lived optimistic state for writable Home Assistant entities.

Adapted from the MIT-licensed blakinio/thesslagreen integration. Pending values
live on the entity, never in coordinator data, and expire automatically.
"""

from __future__ import annotations

from collections.abc import Callable
from time import monotonic
from typing import Any

DEFAULT_OPTIMISTIC_TTL = 10.0


class OptimisticState:
    """Store pending entity values until confirmed by the device or expired."""

    def __init__(self, ttl: float = DEFAULT_OPTIMISTIC_TTL) -> None:
        self._ttl = ttl
        self._pending: dict[str, tuple[Any, float]] = {}

    def set_pending(self, key: str, value: Any) -> None:
        self._pending[key] = (value, monotonic())

    def get_pending(self, key: str) -> Any | None:
        entry = self._pending.get(key)
        if entry is None:
            return None
        value, timestamp = entry
        if monotonic() - timestamp > self._ttl:
            self._pending.pop(key, None)
            return None
        return value

    def clear_pending(self, key: str) -> None:
        self._pending.pop(key, None)

    def clear_if_confirmed(
        self,
        key: str,
        confirmed_value: Any,
        comparator: Callable[[Any, Any], bool] | None = None,
        *,
        tolerance: float | None = None,
    ) -> bool:
        entry = self._pending.get(key)
        if entry is None:
            return False
        pending_value, _ = entry

        if comparator is not None:
            matched = comparator(pending_value, confirmed_value)
        elif tolerance is not None:
            try:
                matched = abs(float(pending_value) - float(confirmed_value)) <= tolerance
            except (TypeError, ValueError):
                matched = pending_value == confirmed_value
        else:
            matched = pending_value == confirmed_value

        if matched:
            self._pending.pop(key, None)
        return matched
