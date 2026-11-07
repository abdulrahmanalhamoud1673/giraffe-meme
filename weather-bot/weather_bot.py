#!/usr/bin/env python3
"""بوت طقس الرابية - عمان: يجيب التوقعات من Open-Meteo ويبعتها على تيليغرام مع نصيحة اللبس.

بدون أي مكتبات خارجية (stdlib فقط).

الاستخدام:
    python weather_bot.py --dry-run        # يطبع الرسالة بس
    python weather_bot.py --dry-run --raw  # ويطبع كمان البيانات الخام ساعة بساعة (للتأكد من الدقة)
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

# مطر "حقيقي" بالساعة: احتمال >= 40% أو كمية >= 0.2 ملم
RAIN_POP, RAIN_MM = 40, 0.2

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
                  "precipitation,weather_code,wind_gusts_10m,uv_index,cloud_cover",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,"
                 "precipitation_probability_max,uv_index_max,wind_gusts_10m_max,weather_code",
    })


MODELS = {"ecmwf_ifs025": "الأوروبي ECMWF", "icon_seamless": "الألماني ICON", "gfs_seamless": "الأمريكي GFS"}


def fetch_models_rain(lat: float, lon: float) -> dict | None:
    """رأي ثاني للمطر: نفس اليوم من 3 نماذج جوية منفصلة. ثانوي، لو فشل ما بنوقف الرسالة."""
    try:
        return _get_json(FORECAST_URL, {
            "latitude": lat, "longitude": lon, "timezone": TZ, "forecast_days": 1,
            "hourly": "precipitation", "models": ",".join(MODELS),
        })
    except Exception as exc:  # noqa: BLE001
        print(f"تحذير: ما قدرت أجيب رأي النماذج التانية: {exc}", file=sys.stderr)
        return None


def models_rain_hours(mdata: dict | None, from_hour: int) -> dict[str, list[int]]:
    """لكل نموذج: الساعات القادمة اللي بتوقع فيها مطر (>= 0.3 ملم)."""
    if not mdata:
        return {}
    h = mdata["hourly"]
    today = mdata["hourly"]["time"][0][:10]
    out: dict[str, list[int]] = {}
    for key, label in MODELS.items():
        vals = h.get(f"precipitation_{key}")
        if vals is None:
            continue
        out[label] = [int(t[11:13]) for t, v in zip(h["time"], vals)
                      if t[:10] == today and int(t[11:13]) >= from_hour and _num(v) >= 0.3]
    return out


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


def _hourly_rows(data: dict) -> list[dict]:
    """كل ساعات اليوم (00-23) كقائمة."""
    today = data["current"]["time"][:10]  # بتوقيت عمان لأننا طلبنا timezone
    h = data["hourly"]
    rows = []
    for i, t in enumerate(h["time"]):
        if t[:10] != today:
            continue
        rows.append({
            "hour": int(t[11:13]),
            "temp": _num(h["temperature_2m"][i]),
            "feels": _num(h["apparent_temperature"][i]),
            "pop": _num(h["precipitation_probability"][i]),
            "rain": _num(h["precipitation"][i]),
            "code": int(_num(h["weather_code"][i])),
            "gust": _num(h["wind_gusts_10m"][i]),
            "uv": _num(h["uv_index"][i]),
            "cloud": _num(h["cloud_cover"][i]) if "cloud_cover" in h else 0.0,
        })
    return rows


def now_hour(data: dict) -> int:
    return int(data["current"]["time"][11:13])


def day_window(data: dict) -> list[dict]:
    """ساعات اليوم القادمة (من الآن أو من DAY_START، لحد DAY_END)."""
    start = max(DAY_START, now_hour(data))
    return [r for r in _hourly_rows(data) if start <= r["hour"] <= DAY_END]


def _is_rainy(r: dict) -> bool:
    return r["pop"] >= RAIN_POP or r["rain"] >= RAIN_MM or r["code"] in (SNOW_CODES | STORM_CODES)


def rain_status(data: dict) -> dict:
    """شو صار وشو رح يصير بالمطر اليوم."""
    rows = _hourly_rows(data)
    nh = now_hour(data)
    past_mm = sum(r["rain"] for r in rows if r["hour"] < nh)
    ahead = [r for r in rows if r["hour"] >= nh and _is_rainy(r)]
    return {
        "raining_now": _num(data["current"].get("precipitation")) > 0,
        "past_mm": past_mm,
        "ahead_from": ahead[0]["hour"] if ahead else None,
        "ahead_to": ahead[-1]["hour"] if ahead else None,
        "ahead_pop": max((r["pop"] for r in ahead), default=0.0),
        "ahead_mm": sum(r["rain"] for r in ahead),
    }


def air_summary(air: dict | None, today: str) -> dict:
    if not air:
        return {"pm10": 0.0, "dust": 0.0}
    h = air["hourly"]
    pm10 = [_num(v) for t, v in zip(h["time"], h["pm10"]) if t[:10] == today]
    dust = [_num(v) for t, v in zip(h["time"], h["dust"]) if t[:10] == today]
    return {"pm10": max(pm10, default=0.0), "dust": max(dust, default=0.0)}


def describe(code: int) -> tuple[str, str]:
    return WEATHER_AR.get(code, ("غير معروف", "🌡"))


def fmt_hour(h: int) -> str:
    return f"{h % 12 or 12}{'ص' if h < 12 else 'م'}"


# --------------------------------------------------------------------------- اللبس

def outfit_advice(rows: list[dict], daily: dict, air: dict) -> list[str]:
    """أول عنصر = الجواب الرئيسي (شو تلبس)، والباقي ملاحظات قصيرة بتظهر بس إذا لازمة."""
    if not rows:
        return ["ما في ساعات كافية بالتوقع لليوم."]
    lo = min(r["feels"] for r in rows)
    hi = max(r["feels"] for r in rows)
    max_pop = max(r["pop"] for r in rows)
    rain_mm = max(_num(daily["precipitation_sum"][0]), sum(r["rain"] for r in rows))
    gust = max(r["gust"] for r in rows)
    uv = max(r["uv"] for r in rows)
    codes = {r["code"] for r in rows}

    # --- الجواب الرئيسي حسب الحرارة المحسوسة
    if hi >= 36:
        tips = ["🥵 حر شديد: ملابس خفيفة فاتحة، مي وايد، وتجنب الشمس 12-4."]
    elif hi >= 30:
        tips = ["👕 حر: تيشيرت وبنطلون خفيف + كاب."]
    elif lo >= 22:
        tips = ["👕 تيشيرت بيكفي."]
    elif lo >= 17:
        tips = ["👕 تيشيرت أو قميص كم طويل، وكوفتة خفيفة للمسا."]
    elif lo >= 12:
        tips = ["🧥 جاكيت خفيف أو هودي."]
    elif lo >= 7:
        tips = ["🧥 جاكيت تقيل شوي + كنزة تحته."]
    elif lo >= 2:
        tips = ["🧥 برد: جاكيت تقيل أو معطف + كنزة صوف + شال."]
    else:
        tips = ["🥶 برد قارس: معطف تقيل + كنزة صوف + شال وقفازات وطاقية."]

    # --- ملاحظات (بس إذا لازمة)
    if hi - lo >= 7 and lo < 22:
        tips.append(f"🧅 الجو بيتغير ({lo:.0f}° ← {hi:.0f}°): البس طبقات بتقدر تقلعها.")

    if codes & SNOW_CODES:
        tips.append("❄️ ثلج: جزمة مقاومة للمي وقفازات، واحذر الطريق الزلق.")
    if codes & STORM_CODES:
        tips.append("⛈ عواصف رعدية: ابعد عن الأماكن المفتوحة.")
    if rain_mm >= 10:
        tips.append(f"☔ مطر غزير (~{rain_mm:.0f} ملم): جاكيت مقاوم للمي، وانتبه من السيول.")
    elif max_pop >= RAIN_POP or rain_mm >= 1:
        tips.append(f"☔ خذ مظلة (احتمال {max_pop:.0f}%).")
    elif max_pop >= 20:
        tips.append(f"🌂 احتمال مطر خفيف ({max_pop:.0f}%): مظلة صغيرة بالشنطة.")

    if gust >= 60:
        tips.append(f"🌪 رياح قوية جداً (هبّات {gust:.0f} كم/س): جاكيت ثابت وابعد عن الأشياء الطايرة.")
    elif gust >= 40:
        tips.append(f"💨 رياح قوية (هبّات {gust:.0f} كم/س): جاكيت بيصد الهوا.")

    if uv >= 8:
        tips.append(f"🕶 شمس قوية جداً ({uv:.0f}): واقي شمس + نظارة + كاب.")
    elif uv >= 6:
        tips.append(f"🕶 شمس قوية ({uv:.0f}): نظارة وواقي شمس.")

    if air["dust"] >= 100 or air["pm10"] >= 150:
        tips.append("😷 غبار عالي: كمامة، وسكّر الشبابيك.")

    return tips


# --------------------------------------------------------------------------- الرسالة

def rain_line(rs: dict) -> str:
    parts = []
    if rs["raining_now"]:
        parts.append("عم تشتي هلأ")
    elif rs["past_mm"] >= 0.2:
        parts.append(f"شتّت اليوم (~{rs['past_mm']:.1f} ملم)")
    if rs["ahead_from"] is not None:
        span = fmt_hour(rs["ahead_from"])
        if rs["ahead_to"] != rs["ahead_from"]:
            span = f"{fmt_hour(rs['ahead_from'])} لـ {fmt_hour(rs['ahead_to'])}"
        parts.append(f"مطر متوقع {span} (احتمال {rs['ahead_pop']:.0f}%)")
    elif parts:
        parts.append("وما في مطر كمان")
    else:
        parts.append("ما في مطر متوقع")
    return "☔ " + " · ".join(parts)


PERIODS = [("الصبح", 7, 12), ("الظهر", 12, 15), ("العصر", 15, 18), ("المسا", 18, 22)]


def feel_word(f: float) -> str:
    for limit, word in ((3, "🥶 برد قارس"), (9, "🧊 برد"), (15, "🧥 بارد شوي"), (21, "🙂 معتدل"),
                        (27, "☀️ دافي"), (32, "🥵 حر")):
        if f <= limit:
            return word
    return "🥵 حر شديد"


def period_lines(data: dict) -> list[str]:
    """سطر لكل فترة (الصبح/الظهر/العصر/المسا) لسا ما خلصت، مع وقتها."""
    nh = now_hour(data)
    rows = _hourly_rows(data)
    out = []
    for name, a, b in PERIODS:
        seg = [r for r in rows if a <= r["hour"] < b and r["hour"] >= nh]
        if not seg:
            continue
        start = max(a, nh)
        t_lo, t_hi = min(r["temp"] for r in seg), max(r["temp"] for r in seg)
        temp = f"{t_lo:.0f}°" if round(t_lo) == round(t_hi) else f"{t_lo:.0f}–{t_hi:.0f}°"
        feels = sum(r["feels"] for r in seg) / len(seg)
        codes = [r["code"] for r in seg]
        cond = describe(max(set(codes), key=lambda c: (codes.count(c), c)))[0]
        extra = ""
        if any(_is_rainy(r) for r in seg):
            extra += " · ☔ مطر"
        gust = max(r["gust"] for r in seg)
        if gust >= 40:
            extra += f" · 💨 {gust:.0f}"
        out.append(f"• <b>{name}</b> {fmt_hour(start)}–{fmt_hour(b)}: {temp} {feel_word(feels)} · {cond}{extra}")
    return out


def second_opinion(rs: dict, models: dict[str, list[int]]) -> str | None:
    """بنقارن توقع المطر الأساسي مع النماذج التانية، وبنحكي بس إذا في اختلاف."""
    if not models:
        return None
    wet = {k: v for k, v in models.items() if v}
    if rs["ahead_from"] is None and not rs["raining_now"] and wet:
        names = " و".join(wet)
        first, last = min(v[0] for v in wet.values()), max(v[-1] for v in wet.values())
        span = fmt_hour(first) if first == last else f"{fmt_hour(first)} لـ {fmt_hour(last)}"
        return f"⚠️ {names} بتوقع مطر خفيف {span} (التوقع الأساسي ما بيشوف مطر)"
    if rs["ahead_from"] is not None and not wet:
        return "ℹ️ النماذج التانية (الأوروبي والألماني والأمريكي) ما بتشوف مطر، فاحتمال أقل"
    return None


def build_message(data: dict, air: dict | None, place: str = DEFAULT_PLACE,
                  models: dict | None = None) -> str:
    cur, daily = data["current"], data["daily"]
    today = cur["time"][:10]
    rows = day_window(data)
    tips = outfit_advice(rows, daily, air_summary(air, today))
    desc, icon = describe(int(_num(cur["weather_code"])))
    rs = rain_status(data)

    lines = [
        f"<b>{html.escape(tips[0])}</b>",
        "",
        f"{icon} هلأ <b>{cur['temperature_2m']:.0f}°</b> (محسوسة {cur['apparent_temperature']:.0f}°) · {desc}",
        rain_line(rs),
    ]
    mh = models_rain_hours(models, now_hour(data))
    opinion = second_opinion(rs, mh)
    if opinion:
        lines.append(html.escape(opinion))
        # نموذجين أو أكتر متفقين على مطر = بنخلي المظلة نصيحة
        if sum(1 for v in mh.values() if v) >= 2 and not any("مظلة" in t for t in tips):
            tips.append("🌂 خذ مظلة صغيرة احتياط (أكتر من نموذج جوي بتوقع مطر).")
    periods = period_lines(data)
    if periods:
        lines += ["", "⏰ <b>خلال اليوم:</b>", *periods]
    if tips[1:]:
        lines.append("")
        lines += [html.escape(t) for t in tips[1:]]
    lines += ["", f"<i>{html.escape(place)} · Open-Meteo</i>"]
    return "\n".join(lines)


def raw_dump(data: dict) -> str:
    """ساعة بساعة، للتأكد إذا الأرقام منطقية."""
    cur = data["current"]
    out = [f"الآن {cur['time']}: temp={cur['temperature_2m']} feels={cur['apparent_temperature']} "
           f"precip={cur['precipitation']} code={cur['weather_code']} wind={cur['wind_speed_10m']} "
           f"gust={cur['wind_gusts_10m']}",
           "hr  temp feels pop%  mm  code cloud% gust  uv"]
    for r in _hourly_rows(data):
        out.append(f"{r['hour']:02d} {r['temp']:5.1f} {r['feels']:5.1f} {r['pop']:4.0f} {r['rain']:4.1f} "
                   f"{r['code']:4d} {r['cloud']:5.0f} {r['gust']:5.0f} {r['uv']:4.1f}")
    out.append(f"daily: {json.dumps(data['daily'], ensure_ascii=False)}")
    return "\n".join(out)


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
    ap.add_argument("--raw", action="store_true", help="اطبع البيانات الخام ساعة بساعة")
    ap.add_argument("--from-json", help="اقرأ بيانات الطقس من ملف بدل الإنترنت (للتجربة)")
    args = ap.parse_args(argv)

    lat = float(os.environ.get("LAT") or DEFAULT_LAT)
    lon = float(os.environ.get("LON") or DEFAULT_LON)
    place = os.environ.get("PLACE_NAME") or DEFAULT_PLACE

    if args.from_json:
        with open(args.from_json, encoding="utf-8") as f:
            data = json.load(f)
        air, models = None, None
    else:
        data = fetch_weather(lat, lon)
        air = fetch_air(lat, lon)
        models = fetch_models_rain(lat, lon)

    if args.raw:
        print(raw_dump(data))
        print("نماذج المطر (الساعات القادمة):", models_rain_hours(models, now_hour(data)))
        print()

    message = build_message(data, air, place, models)
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
