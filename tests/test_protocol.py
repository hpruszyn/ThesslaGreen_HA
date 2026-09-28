import importlib.util
import pathlib
import unittest
from dataclasses import dataclass, field

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROTOCOL_PATH = ROOT / "custom_components" / "thessla_green" / "protocol.py"
spec = importlib.util.spec_from_file_location("thessla_protocol", PROTOCOL_PATH)
protocol = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(protocol)


@dataclass
class Data:
    holding: dict[int, int] = field(default_factory=dict)
    input: dict[int, int] = field(default_factory=dict)


class ProtocolTests(unittest.TestCase):
    def test_packed_filter_date(self):
        self.assertEqual(
            protocol.decode_packed_filter_date(14651).isoformat(),
            "2028-09-27",
        )

    def test_invalid_packed_filter_date(self):
        self.assertIsNone(protocol.decode_packed_filter_date(0))

    def test_missing_temperature_sentinel(self):
        self.assertIsNone(protocol.decode_register(0x8000, 0.1, 1))

    def test_signed_temperature(self):
        self.assertEqual(protocol.decode_register(0xFFF6, 0.1, 1), -1.0)

    def test_schedule_time(self):
        self.assertEqual(protocol.decode_schedule_time(0x1530), "15:30")
        self.assertIsNone(protocol.decode_schedule_time(0x2400))
        self.assertIsNone(protocol.decode_schedule_time(0xA200))
        self.assertIsNone(protocol.decode_schedule_time(0x2560))

    def test_schedule_season(self):
        holding = {
            16: 0x0600,
            72: (55 << 8) | 42,  # 55%, 21.0 C
            128: 0x1500,
        }
        days = protocol.decode_schedule_season(holding, 16, 72, 128)
        self.assertEqual(days[0]["slots"], [{"start": "06:00", "i": 55, "t": 21.0}])
        self.assertEqual(days[0]["airing"], "15:00")
        self.assertEqual(len(days), 7)

    def test_special_mode_map(self):
        self.assertEqual(protocol.SPECIAL_MODE_READ_MAP[5], "Wietrzenie")
        self.assertEqual(protocol.SPECIAL_MODE_DETAILS[5], "H2O/WIETRZENIE (higrostat)")
        self.assertEqual(protocol.SPECIAL_MODE_READ_MAP[10], "Okna")

    def test_operation_modes(self):
        self.assertEqual(
            protocol.OPERATION_MODES,
            {"Automatyczny": 0, "Manualny": 1, "Chwilowy": 2},
        )

    def test_capabilities(self):
        self.assertEqual(
            protocol.detect_capabilities(
                Data(holding={4704: 0, 4711: 1}, input={271: 1})
            ),
            {"cf": True, "postheater": True},
        )
        self.assertEqual(
            protocol.detect_capabilities(Data()),
            {"cf": False, "postheater": False},
        )


if __name__ == "__main__":
    unittest.main()
