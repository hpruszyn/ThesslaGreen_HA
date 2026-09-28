import importlib.util
import pathlib
import unittest
from dataclasses import dataclass, field

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "custom_components" / "thessla_green" / "entity_utils.py"
spec = importlib.util.spec_from_file_location("entity_utils", PATH)
entity_utils = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(entity_utils)


@dataclass
class Data:
    holding: dict[int, int] = field(default_factory=dict)
    input: dict[int, int] = field(default_factory=dict)
    coil: dict[int, bool] = field(default_factory=dict)
    discrete: dict[int, bool] = field(default_factory=dict)


class Coordinator:
    def __init__(self, data, success=True):
        self.safe_data = data
        self.last_update_success = success


class AvailabilityTests(unittest.TestCase):
    def test_address_must_be_present(self):
        coordinator = Coordinator(Data(holding={4208: 0}))
        self.assertTrue(entity_utils.register_available(coordinator, 4208, "holding"))
        self.assertFalse(entity_utils.register_available(coordinator, 4210, "holding"))

    def test_failed_coordinator_is_unavailable(self):
        coordinator = Coordinator(Data(holding={4208: 0}), success=False)
        self.assertFalse(entity_utils.register_available(coordinator, 4208, "holding"))

    def test_each_modbus_space(self):
        coordinator = Coordinator(
            Data(input={271: 1}, coil={9: True}, discrete={6: False})
        )
        self.assertTrue(entity_utils.register_available(coordinator, 271, "input"))
        self.assertTrue(entity_utils.register_available(coordinator, 9, "coil"))
        self.assertTrue(entity_utils.register_available(coordinator, 6, "discrete"))


if __name__ == "__main__":
    unittest.main()
