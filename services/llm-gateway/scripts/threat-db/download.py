"""
CWE / NVD / ATT&CK / CAPEC 데이터 다운로드
"""
import os
import zipfile
import io
import json
import time
import httpx

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "threat-db-raw")

# NVD API 2.0
NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
NVD_KEYWORDS = [
    "automotive",
    "vehicle ECU",
    "CAN bus",
    "infotainment",
    "telematics vehicle",
    "OBD vehicle",
    "keyless entry",
    "connected car",
    "vehicle firmware",
    "AUTOSAR",
    "vehicle OTA",
    "V2X vehicle",
]


def download_cwe() -> str:
    """CWE XML 벌크 다운로드"""
    out_dir = os.path.join(DATA_DIR, "cwe")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "cwec_latest.xml")
    if os.path.exists(out):
        print(f"  [CWE] 캐시 사용: {out}")
        return out

    url = "https://cwe.mitre.org/data/xml/cwec_latest.xml.zip"
    print(f"  [CWE] 다운로드 중: {url}")
    resp = httpx.get(url, follow_redirects=True, timeout=120)
    resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        xml_names = [n for n in zf.namelist() if n.endswith(".xml")]
        if not xml_names:
            raise RuntimeError(f"ZIP에 XML 파일 없음: {zf.namelist()}")
        with open(out, "wb") as f:
            f.write(zf.read(xml_names[0]))

    size_mb = os.path.getsize(out) / (1024 * 1024)
    print(f"  [CWE] 완료: {out} ({size_mb:.1f}MB)")
    return out


def download_nvd() -> str:
    """NVD CVE 데이터 -- 키워드 검색으로 자동차 관련 CVE 수집"""
    out_dir = os.path.join(DATA_DIR, "nvd")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "automotive_cves.json")
    if os.path.exists(out):
        print(f"  [NVD] 캐시 사용: {out}")
        return out

    all_cves = []
    seen_ids = set()

    for kw in NVD_KEYWORDS:
        print(f"  [NVD] 키워드 검색: '{kw}'")
        params = {
            "keywordSearch": kw,
            "resultsPerPage": 2000,
        }
        try:
            resp = httpx.get(NVD_API_BASE, params=params, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            vulns = data.get("vulnerabilities", [])
            new_count = 0
            for v in vulns:
                cve_id = v["cve"]["id"]
                if cve_id not in seen_ids:
                    seen_ids.add(cve_id)
                    all_cves.append(v)
                    new_count += 1
            print(f"  [NVD] '{kw}': {len(vulns)}건 중 신규 {new_count}건")
        except Exception as e:
            print(f"  [NVD] '{kw}' 실패: {e}")

        # Rate limit: 5 req/30s -> 6초 간격
        time.sleep(7)

    with open(out, "w") as f:
        json.dump({"vulnerabilities": all_cves, "totalResults": len(all_cves)}, f)

    print(f"  [NVD] 완료: {len(all_cves)}건 -> {out}")
    return out


def download_attack() -> str:
    """ATT&CK ICS STIX 2.1 번들 다운로드"""
    out_dir = os.path.join(DATA_DIR, "attack")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "ics-attack.json")
    if os.path.exists(out):
        print(f"  [ATT&CK] 캐시 사용: {out}")
        return out

    url = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/ics-attack/ics-attack.json"
    print(f"  [ATT&CK] 다운로드 중: {url}")
    resp = httpx.get(url, follow_redirects=True, timeout=120)
    resp.raise_for_status()

    with open(out, "w") as f:
        f.write(resp.text)

    size_mb = os.path.getsize(out) / (1024 * 1024)
    print(f"  [ATT&CK] 완료: {out} ({size_mb:.1f}MB)")
    return out


def download_capec() -> str:
    """CAPEC XML 벌크 다운로드"""
    out_dir = os.path.join(DATA_DIR, "capec")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "capec_latest.xml")
    if os.path.exists(out):
        print(f"  [CAPEC] 캐시 사용: {out}")
        return out

    url = "https://capec.mitre.org/data/xml/capec_latest.xml"
    print(f"  [CAPEC] 다운로드 중: {url}")
    resp = httpx.get(url, follow_redirects=True, timeout=120)
    resp.raise_for_status()

    with open(out, "wb") as f:
        f.write(resp.content)

    size_mb = os.path.getsize(out) / (1024 * 1024)
    print(f"  [CAPEC] 완료: {out} ({size_mb:.1f}MB)")
    return out


def download_all() -> dict[str, str]:
    """전체 다운로드 실행"""
    print("=" * 50)
    print("  데이터 다운로드")
    print("=" * 50)

    paths = {}
    paths["cwe"] = download_cwe()
    paths["attack"] = download_attack()
    paths["capec"] = download_capec()
    # NVD는 API 호출이므로 마지막에 (rate limit)
    paths["nvd"] = download_nvd()

    print(f"\n  전체 다운로드 완료: {len(paths)}개 소스")
    return paths


if __name__ == "__main__":
    download_all()
