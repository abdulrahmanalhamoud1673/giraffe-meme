#!/usr/bin/env python3
"""بوت طقس الرابية - عمان: يجيب التوقعات من Open-Meteo ويبعتها على تيليغرام مع نصيحة اللبس.

بدون أي مكتبات خارجية (stdlib فقط).

الاستخدام:
    python weather_bot.py --dry-run        # يطبع الرسالة بس
    python weather_bot.py                  # يبعتها على تيليغرام

المتغيرات (environment):
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   # مطلوبة للإرسال
    LAT, LON                               # اختياري: إحداثيات مكانك (الافتراضي: الرابية)
    PLACE_NAME                             # اختياري: الاسم اللي بيطلع بالرسالة
"""
from __future__ import annotations

import argparse
import html
import json
import os
import sys
import urllib.parse
import urllib.request

# الرابية / شارع تبريز تقريباً. غيّرها من Google Maps (كبس يمين على بيتك وانسخ الأرقام) لدقة أعلى.
DEFAULT_LAT = 31.9700
DEFAULT_LON = 35.8650
DEFAULT_PLACE = "الرابية - عمان"
TZ = "Asia/Amman"

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# ساعات النهار اللي بنحسب عليها اللبس (لما تكون برا البيت)
DAY_START, DAY_END = 7, 22

WEATHER_AR = {
    0: ("صافي", "☀️"), 1: ("صافي غالباً", "🌤"), 2: ("غائم جزئياً", "⛅"), 3: ("غائم", "☁️"),
    45: ("ضباب", "🌫"), 48: ("ضباب متجمد", "🌫"),
    51: ("رذاذ خفيف", "🌦"), 53: ("رذاذ", "🌦"), 55: ("رذاذ كثيف", "🌧"),
    56: ("رذاذ متجمد", "🌧"), 57: ("رذاذ متجمد كثيف", "🌧"),
    61: ("مطر خفيف", "🌦"), 63: ("مطر", "🌧"), 65: ("مطر غزير", "🌧"),
    66: ("مطر متجمد", "🌧"), 67: ("مطر متجمد غزير", "🌧"),
    71: ("ثلج خفيف", "🌨"), 73: ("ثلج", "🌨"), 75: ("ثلج كثيف", "❄️"), 77: ("حبيبات ثلج", "🌨"),
    80: ("زخات مطر خفيفة", "🌦"), 81: ("زخات مطر", "🌧"), 82: ("زخات مطر قوية", "⛈"),
    85: ("زخات ثلج", "🌨"), 86: ("زخات ثلج كثيفة", "❄️"),
    95: ("عواصف رعدية", "⛈"), 96: ("عواصف رعدية مع برد", "⛈"), 99: ("عواصف رعدية قوية مع برد", "⛈"),
}
SNOW_CODES = {71, 73, 75, 77, 85, 86}
STORM_CODES = {95, 96, 99}
RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82} | STORM_CODES


# --------------------------------------------------------------------------- جلب البيانات

def _get_json(url: str, params: dict, timeout: int = 20) -> dict:
    full = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full, headers={"User-Agent": "rabiyeh-weather-bot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def fetch_weather(lat: float, lon: float) -> dict:
    return _get_json(FORECAST_URL, {
        "latitude": lat, "longitude": lon, "timezone": TZ, "forecast_days": 1,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
                   "precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
        "hourly": "temperature_2m,apparent_temperature,precipitation_probability,"
                  "precipitation,weather_code,wind_gusts_10m,uv_index",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
                 "precipitation_probability_max,uv_index_max,wind_gusts_10m_max,weather_code",
    })


def fetch_air(lat: float, lon: float) -> dict | None:
    """الغبار/التلوث: ثانوي، لو فشل ما بنوقف الرسالة."""
    try:
        return _get_json(AIR_URL, {
            "latitude": lat, "longitude": lon, "timezone": TZ, "forecast_days": 1,
            "hourly": "pm10,dust",
        })
    except Exception as exc:  # noqa: BLE001
        print(f"تحذير: ما قدرت أجيب جودة الهواء: {exc}", file=sys.stderr)
        return None


# --------------------------------------------------------------------------- التحليل

def _num(x, default=0.0) -> float:
    return default if x is None else float(x)


def day_window(data: dict) -> list[dict]:
    """ساعات اليوم القادمة (من الآن أو من DAY_START، لحد DAY_END)."""
    now = data["current"]["time"]  # بتوقيت عمان لأننا طلبنا timezone
    today, now_hour = now[:10], int(now[11:13])
    start = max(DAY_START, now_hour)
    h = data["hourly"]
    rows = []
    for i, t in enumerate(h["time"]):
        if t[:10] != today:
            continue
        hour = int(t[11:13])
        if not (start <= hour <= DAY_END):
            continue
        rows.append({
            "hour": hour,
            "temp": _num(h["temperature_2m"][i]),
            "feels": _num(h["apparent_temperature"][i]),
            "pop": _num(h["precipitation_probability"][i]),
            "rain": _num(h["precipitation"][i]),
            "code": int(_num(h["weather_code"][i])),
            "gust": _num(h["wind_gusts_10m"][i]),
            "uv": _num(h["uv_index"][i]),
        })
    return rows


def air_summary(air: dict | None, today: str) -> dict:
    if not air:
        return {"pm10": 0.0, "dust": 0.0}
    h = air["hourly"]
    pm10 = [_num(v) for t, v in zip(h["time"], h["pm10"]) if t[:10] == today]
    dust = [_num(v) for t, v in zip(h["time"], h["dust"]) if t[:10] == today]
    return {"pm10": max(pm10, default=0.0), "dust": max(dust, default=0.0)}


def describe(code: int) -> tuple[str, str]:
    return WEATHER_AR.get(code, ("غير معروف", "🌡"))


def worst_code(rows: list[dict]) -> int:
    """أسوأ حالة بالفترة (عواصف > ثلج > مطر > غيره)."""
    codes = [r["code"] for r in rows]
    for group in (STORM_CODES, SNOW_CODES, RAIN_CODES):
        hit = [c for c in codes if c in group]
        if hit:
            return max(hit)
    return max(set(codes), key=codes.count)


# --------------------------------------------------------------------------- اللبس

def outfit_advice(rows: list[dict], daily: dict, air: dict) -> list[str]:
    """بترجع قائمة نصايح لبس مرتبة حسب الأهمية."""
    if not rows:
        return ["ما في ساعات كافية بالتوقع لليوم."]
    lo = min(r["feels"] for r in rows)
    hi = max(r["feels"] for r in rows)
    max_pop = max(r["pop"] for r in rows)
    rain_mm = max(_num(daily["precipitation_sum"][0]), sum(r["rain"] for r in rows))
    gust = max(r["gust"] for r in rows)
    uv = max(r["uv"] for r in rows)
    codes = {r["code"] for r in rows}

    tips: list[str] = []

    # --- الأساس حسب الحرارة المحسوسة
    if hi >= 36:
        tips.append("🥵 حر شديد: البس أخف وأفتح اللبس (قطن/كتان)، وخذ مي وايد وتجنب الشمس 12-4.")
    elif hi >= 30:
        tips.append("👕 حر: تيشيرت وبنطلون/شورت خفيف، ألوان فاتحة، وكاب أو نظارة شمس.")
    elif lo >= 22:
        tips.append("👕 دافي: تيشيرت وبنطلون خفيف بيكفّوا.")
    elif lo >= 17:
        tips.append("👕 تيشيرت أو قميص كم طويل خفيف، وخذ كوفتة خفيفة للمسا.")
    elif lo >= 12:
        tips.append("🧥 جاكيت خفيف أو هودي فوق تيشيرت/قميص كم طويل.")
    elif lo >= 7:
        tips.append("🧥 جاكيت تقيل شوي + كنزة تحته، وبنطلون طويل.")
    elif lo >= 2:
        tips.append("🧥 برد: جاكيت تقيل أو معطف + كنزة صوف، وشال.")
    else:
        tips.append("🥶 برد قارس: معطف تقيل، كنزة صوف، شال، قفازات وطاقية، وجرابات دافية.")

    # --- فرق الحرارة خلال النهار
    if hi - lo >= 7 and lo < 22:
        tips.append(f"🧅 الجو بيتغير ({lo:.0f}° ← {hi:.0f}° محسوسة): البس طبقات بتقدر تقلعها وقت الظهر.")

    # --- المطر / الثلج / العواصف
    if codes & SNOW_CODES:
        tips.append("❄️ في ثلج: جزمة مقاومة للمي، قفازات، واحذر الطريق الزلق.")
    if codes & STORM_CODES:
        tips.append("⛈ عواصف رعدية: ابعد عن الأماكن المفتوحة، وخذ جاكيت مقاوم للمي.")
    if max_pop >= 40 or rain_mm >= 1:
        if rain_mm >= 10:
            tips.append(f"☔ مطر غزير متوقع (~{rain_mm:.0f} ملم): جاكيت مقاوم للمي + حذاء ما بيتبلل، "
                        "وانتبه من السيول وتجمّع المي بالشوارع.")
        else:
            tips.append(f"☔ خذ مظلة أو جاكيت مقاوم للمي (احتمال المطر {max_pop:.0f}%)، وحذاء ما بيتبلل.")
    elif max_pop >= 20:
        tips.append(f"🌂 احتمال مطر خفيف ({max_pop:.0f}%): مظلة صغيرة بالشنطة ما بتضر.")

    # --- الهوا
    if gust >= 60:
        tips.append(f"🌪 رياح قوية جداً (هبّات {gust:.0f} كم/س): البس جاكيت ثابت وابعد عن الأشياء الطايرة.")
    elif gust >= 40:
        tips.append(f"💨 رياح قوية (هبّات {gust:.0f} كم/س): جاكيت بيصد الهوا بيفرق معك.")

    # --- الشمس
    if uv >= 8:
        tips.append(f"🕶 أشعة فوق بنفسجية عالية جداً ({uv:.0f}): واقي شمس ونظارة وكاب.")
    elif uv >= 6:
        tips.append(f"🕶 أشعة قوية ({uv:.0f}): نظارة شمس وواقي شمس لو رح تكون برا كتير.")

    # --- الغبار
    if air["dust"] >= 100 or air["pm10"] >= 150:
        tips.append("😷 غبار عالي بالجو: كمامة، وسكّر الشبابيك، وخفف الجهد برا لو عندك حساسية.")

    return tips


# --------------------------------------------------------------------------- الرسالة

def _segment(rows: list[dict], lo_h: int, hi_h: int, name: str) -> str | None:
    seg = [r for r in rows if lo_h <= r["hour"] < hi_h]
    if not seg:
        return None
    desc, icon = describe(worst_code(seg))
    t = sum(r["temp"] for r in seg) / len(seg)
    f = sum(r["feels"] for r in seg) / len(seg)
    pop = max(r["pop"] for r in seg)
    rain = f" · ☔ {pop:.0f}%" if pop >= 20 else ""
    return f"• {name}: {t:.0f}° (محسوسة {f:.0f}°) {icon} {desc}{rain}"


def build_message(data: dict, air: dict | None, place: str = DEFAULT_PLACE) -> str:
    cur, daily = data["current"], data["daily"]
    today = cur["time"][:10]
    rows = day_window(data)
    air_s = air_summary(air, today)

    desc, icon = describe(int(_num(cur["weather_code"])))
    lines = [
        f"{icon} <b>طقس {html.escape(place)}</b>",
        "",
        f"🌡 هلأ: <b>{cur['temperature_2m']:.0f}°</b> (محسوسة {cur['apparent_temperature']:.0f}°) · {desc}",
        f"📊 اليوم: من <b>{daily['temperature_2m_min'][0]:.0f}°</b> لـ <b>{daily['temperature_2m_max'][0]:.0f}°</b>",
        f"💧 رطوبة {cur['relative_humidity_2m']:.0f}% · 💨 رياح {cur['wind_speed_10m']:.0f} كم/س "
        f"(هبّات لحد {daily['wind_gusts_10m_max'][0]:.0f})",
    ]
    pop_max = _num(daily["precipitation_probability_max"][0])
    rain_sum = _num(daily["precipitation_sum"][0])
    if pop_max >= 20 or rain_sum >= 0.2:
        lines.append(f"☔ احتمال المطر {pop_max:.0f}% (حوالي {rain_sum:.1f} ملم)")
    else:
        lines.append("☔ ما في مطر متوقع")

    segs = [s for s in (
        _segment(rows, 7, 12, "الصبح"),
        _segment(rows, 12, 17, "الظهر والعصر"),
        _segment(rows, 17, DAY_END + 1, "المسا"),
    ) if s]
    if segs:
        lines += ["", "⏰ <b>خلال اليوم:</b>", *segs]

    lines += ["", "👔 <b>شو تلبس؟</b>"]
    lines += [html.escape(t) for t in outfit_advice(rows, daily, air_s)]
    lines += ["", "<i>المصدر: Open-Meteo</i>"]
    return "\n".join(lines)


# --------------------------------------------------------------------------- تيليغرام

def send_telegram(token: str, chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({
        "chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=20) as resp:
        result = json.load(resp)
    if not result.get("ok"):
        raise RuntimeError(f"تيليغرام رفض الرسالة: {result}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="اطبع الرسالة بدون إرسال")
    ap.add_argument("--from-json", help="اقرأ بيانات الطقس من ملف بدل الإنترنت (للتجربة)")
    args = ap.parse_args(argv)

    lat = float(os.environ.get("LAT") or DEFAULT_LAT)
    lon = float(os.environ.get("LON") or DEFAULT_LON)
    place = os.environ.get("PLACE_NAME") or DEFAULT_PLACE

    if args.from_json:
        with open(args.from_json, encoding="utf-8") as f:
            data = json.load(f)
        air = None
    else:
        data = fetch_weather(lat, lon)
        air = fetch_air(lat, lon)

    message = build_message(data, air, place)
    if args.dry_run:
        print(message)
        return 0

    token, chat_id = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("ناقص TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID", file=sys.stderr)
        return 2
    send_telegram(token, chat_id, message)
    print("تم الإرسال ✅")
    return 0


if __name__ == "__main__":
    sys.exit(main())
