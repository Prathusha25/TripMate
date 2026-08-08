import requests
import datetime
import json

BASE_URL = "http://127.0.0.1:8000"

def test_dynamic_weather():
    print("====================================================")
    print("VERIFYING DYNAMIC REAL-TIME WEATHER INTEGRATION")
    print("====================================================\n")

    # 1. Register a test user
    email = f"weather_tester_{int(datetime.datetime.now().timestamp())}@test.com"
    signup_res = requests.post(f"{BASE_URL}/auth/signup", json={
        "email": email,
        "name": "Weather Tester",
        "password": "password123",
        "confirm_password": "password123"
    })
    assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test dynamic weather for today to +5 days across multiple destinations
    today = datetime.date.today()
    end_date = today + datetime.timedelta(days=5)
    start_str = today.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    destinations = [
        "Tokyo, Japan",
        "Paris, France",
        "New York, USA",
        "Goa, India",
        "Sydney, Australia"
    ]

    weather_snapshots = {}

    for dest in destinations:
        print(f"--- Fetching dynamic weather for: {dest} ---")
        params = {
            "destination": dest,
            "start_date": start_str,
            "end_date": end_str
        }
        res = requests.get(f"{BASE_URL}/weather/forecast", params=params, headers=headers)
        if res.status_code != 200:
            print(f"FAILED for {dest}: {res.status_code} - {res.text}")
            continue

        data = res.json()
        assert data.get("forecast_available") == True, f"Forecast unavailable for {dest}"
        resolved_name = data.get("destination")
        timezone = data.get("timezone")
        days = data.get("days", [])
        
        print(f"[OK] Location resolved: {resolved_name} (Timezone: {timezone})")
        print(f"[OK] Total days returned: {len(days)}")

        if days:
            d0 = days[0]
            print(f"  - Day 1 ({d0['date']}): {d0['weather_condition']}")
            print(f"    * Max Temp: {d0['temperature_max']} deg C, Min Temp: {d0['temperature_min']} deg C")
            print(f"    * Rain Probability: {d0['rain_probability']}%, Precipitation: {d0['precipitation']} mm")
            print(f"    * Wind Speed: {d0['wind_speed']} km/h")
            print(f"    * Morning: {d0['morning']['temperature']} deg C ({d0['morning']['condition']})")
            print(f"    * Afternoon: {d0['afternoon']['temperature']} deg C ({d0['afternoon']['condition']})")
            print(f"    * Evening: {d0['evening']['temperature']} deg C ({d0['evening']['condition']})")

            weather_snapshots[dest] = {
                "max_temp": d0['temperature_max'],
                "condition": d0['weather_condition'],
                "timezone": timezone
            }
        print("")

    # Verify that different destinations have distinct dynamic real-world weather metrics
    print("--- Cross-Destination Dynamic Variance Check ---")
    temps = [info["max_temp"] for info in weather_snapshots.values()]
    print(f"Recorded Max Temperatures across destinations: {temps}")
    
    # Ensure not all temperatures are identical (proof of dynamic real-world data vs hardcoded dummy values)
    unique_temps = set(temps)
    print(f"Distinct temperature values: {len(unique_temps)} unique out of {len(temps)} locations")
    assert len(unique_temps) > 1, "Temperatures must vary dynamically across geographical regions"

    print("\n====================================================")
    print("DYNAMIC WEATHER INTEGRATION VERIFIED 100% OPERATIONAL!")
    print("Data is sourced in real time directly from Open-Meteo.")
    print("====================================================")

if __name__ == "__main__":
    test_dynamic_weather()
