"""Pure protocol helpers and mappings for Thessla Green AirPack."""

from __future__ import annotations

from datetime import date

SPECIAL_MODE_READ_MAP = {
    0: "Brak trybu",
    1: "Okap",
    2: "Kominek",
    3: "Wietrzenie",
    4: "Wietrzenie",
    5: "Wietrzenie",
    6: "Wietrzenie",
    7: "Wietrzenie",
    8: "Wietrzenie",
    9: "Wietrzenie",
    10: "Okna",
    11: "Pusty Dom",
}

SPECIAL_MODE_DETAILS = {
    0: "Brak trybu",
    1: "OKAP",
    2: "KOMINEK",
    3: "WIETRZENIE (przełącznik dzwonkowy)",
    4: "WIETRZENIE (przełącznik ON/OFF)",
    5: "H2O/WIETRZENIE (higrostat)",
    6: "JP/WIETRZENIE (czujnik jakości powietrza)",
    7: "WIETRZENIE (aktywacja ręczna)",
    8: "WIETRZENIE (tryb automatyczny)",
    9: "WIETRZENIE (harmonogram)",
    10: "OTWARTE OKNA",
    11: "PUSTY DOM",
}

OPERATION_MODES = {
    "Automatyczny": 0,
    "Manualny": 1,
    "Chwilowy": 2,
}


def decode_register(
    raw_value: int | None,
    scale: float = 1.0,
    precision: int = 0,
):
    """Decode signed int16 register; 0x8000 means no reading."""
    if raw_value is None or raw_value == 0x8000:
        return None
    raw = raw_value - 0x10000 if raw_value > 0x7FFF else raw_value
    return round(raw * scale, precision)


def decode_packed_filter_date(raw: int | None) -> date | None:
    """Decode AirPack packed date: day b0-b4, month b5-b8, year b9-b15."""
    if raw is None:
        return None
    day = raw & 0x1F
    month = (raw >> 5) & 0x0F
    year = 2000 + ((raw >> 9) & 0x7F)
    try:
        return date(year, month, day)
    except ValueError:
        return None


def bcd(value: int) -> int:
    """Decode one packed BCD byte."""
    return (value >> 4) * 10 + (value & 0x0F)


def decode_schedule_time(value: int | None) -> str | None:
    """Decode BCD HHMM schedule value and disabled sentinels."""
    if value is None or value in (0x2400, 0xA200):
        return None
    hour = bcd(value >> 8)
    minute = bcd(value & 0xFF)
    if hour > 23 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}"


def decode_schedule_season(
    holding: dict[int, int],
    time_base: int,
    value_base: int,
    airing_base: int,
) -> list[dict]:
    """Decode seven days of four AUTO slots plus daily airing."""
    days = []
    for day in range(7):
        slots = []
        for slot in range(4):
            start = decode_schedule_time(holding.get(time_base + day * 4 + slot))
            intensity_temp = holding.get(value_base + day * 4 + slot)
            if start is not None and intensity_temp is not None:
                slots.append(
                    {
                        "start": start,
                        "i": intensity_temp >> 8,
                        "t": (intensity_temp & 0xFF) / 2,
                    }
                )
        days.append(
            {
                "slots": slots,
                "airing": decode_schedule_time(
                    holding.get(airing_base + day * 4)
                ),
            }
        )
    return days


def detect_capabilities(data) -> dict[str, bool]:
    """Detect optional functions from registers present in the latest poll."""
    return {
        "cf": 271 in data.input,
        "postheater": 4704 in data.holding and 4711 in data.holding,
    }
