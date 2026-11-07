import unittest

import weather_bot as wb


def make_data(temps, feels=None, pop=0, rain=0.0, code=0, gust=15, uv=3, now_hour=6):
    """بيانات تجريبية بنفس شكل رد Open-Meteo ليوم واحد (24 ساعة)."""
    feels = feels or temps
    times = [f"2026-11-07T{h:02d}:00" for h in range(24)]
    return {
        "current": {"time": f"2026-11-07T{now_hour:02d}:00", "temperature_2m": temps[now_hour],
                    "apparent_temperature": feels[now_hour], "relative_humidity_2m": 55,
                    "precipitation": 0, "weather_code": code, "wind_speed_10m": 12, "wind_gusts_10m": gust},
        "hourly": {"time": times, "temperature_2m": temps, "apparent_temperature": feels,
                   "precipitation_probability": [pop] * 24, "precipitation": [rain] * 24,
                   "weather_code": [code] * 24, "wind_gusts_10m": [gust] * 24, "uv_index": [uv] * 24},
        "daily": {"temperature_2m_max": [max(temps)], "temperature_2m_min": [min(temps)],
                  "precipitation_sum": [rain * 24], "precipitation_probability_max": [pop],
                  "uv_index_max": [uv], "wind_gusts_10m_max": [gust], "weather_code": [code]},
    }


def curve(lo, hi):
    """منحنى حرارة بسيط: أدنى الصبح، أعلى الساعة 15."""
    return [lo + (hi - lo) * max(0.0, 1 - abs(h - 15) / 9) for h in range(24)]


def advice(data, air=None):
    rows = wb.day_window(data)
    return " ".join(wb.outfit_advice(rows, data["daily"], wb.air_summary(air, "2026-11-07")))


class OutfitTests(unittest.TestCase):
    def test_freezing(self):
        self.assertIn("قفازات", advice(make_data(curve(-2, 3))))

    def test_cold_day_needs_heavy_jacket(self):
        self.assertIn("جاكيت تقيل", advice(make_data(curve(5, 10))))

    def test_hot_day(self):
        text = advice(make_data(curve(24, 38)))
        self.assertIn("حر", text)
        self.assertNotIn("جاكيت", text)

    def test_rain_umbrella(self):
        self.assertIn("مظلة", advice(make_data(curve(10, 14), pop=80, rain=0.1, code=63)))

    def test_heavy_rain_flood_warning(self):
        self.assertIn("السيول", advice(make_data(curve(10, 14), pop=95, rain=1.5, code=65)))

    def test_no_rain_no_umbrella(self):
        self.assertNotIn("مظلة", advice(make_data(curve(15, 22))))

    def test_wind_and_uv_and_snow(self):
        text = advice(make_data(curve(0, 3), gust=65, uv=9, code=73))
        self.assertIn("رياح قوية جداً", text)
        self.assertIn("ثلج", text)
        text = advice(make_data(curve(25, 33), uv=9))
        self.assertIn("واقي شمس", text)

    def test_big_swing_suggests_layers(self):
        self.assertIn("طبقات", advice(make_data(curve(6, 22))))

    def test_dust_mask(self):
        air = {"hourly": {"time": ["2026-11-07T12:00"], "pm10": [300], "dust": [250]}}
        self.assertIn("كمامة", advice(make_data(curve(20, 28)), air))


class MessageTests(unittest.TestCase):
    def test_message_builds_and_escapes(self):
        msg = wb.build_message(make_data(curve(9, 18), pop=10, code=2), None, "الرابية & عمان")
        self.assertIn("الرابية &amp; عمان", msg)
        self.assertIn("شو تلبس", msg)
        self.assertIn("خلال اليوم", msg)
        self.assertLessEqual(len(msg), 4096)  # حد تيليغرام

    def test_late_run_skips_past_hours(self):
        rows = wb.day_window(make_data(curve(9, 18), now_hour=19))
        self.assertEqual([r["hour"] for r in rows], [19, 20, 21, 22])

    def test_after_hours_still_builds(self):
        msg = wb.build_message(make_data(curve(9, 18), now_hour=23), None)
        self.assertIn("شو تلبس", msg)

    def test_null_values_dont_crash(self):
        d = make_data(curve(9, 18))
        d["hourly"]["precipitation_probability"][10] = None
        d["daily"]["precipitation_sum"] = [None]
        wb.build_message(d, None)


if __name__ == "__main__":
    unittest.main()
