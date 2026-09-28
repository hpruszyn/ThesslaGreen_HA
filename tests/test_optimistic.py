import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / "custom_components" / "thessla_green" / "optimistic.py"
spec = importlib.util.spec_from_file_location("optimistic", PATH)
optimistic = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(optimistic)


class OptimisticStateTests(unittest.TestCase):
    def test_pending_and_confirmed(self):
        state = optimistic.OptimisticState(ttl=10)
        state.set_pending("x", 7)
        self.assertEqual(state.get_pending("x"), 7)
        self.assertFalse(state.clear_if_confirmed("x", 6))
        self.assertEqual(state.get_pending("x"), 7)
        self.assertTrue(state.clear_if_confirmed("x", 7))
        self.assertIsNone(state.get_pending("x"))

    def test_expired_value_is_dropped(self):
        state = optimistic.OptimisticState(ttl=-1)
        state.set_pending("x", 7)
        self.assertIsNone(state.get_pending("x"))

    def test_tolerance(self):
        state = optimistic.OptimisticState()
        state.set_pending("temp", 21.0)
        self.assertTrue(
            state.clear_if_confirmed("temp", 21.2, tolerance=0.5)
        )


if __name__ == "__main__":
    unittest.main()
