"""
CWE / NVD / ATT&CK / CAPEC 데이터 다운로드
NVD: CWE 기반 + 기술 스택 + 자동차 키워드 3단계 전략
ATT&CK: ICS + Enterprise 듀얼 번들
"""
import functools
import os
import zipfile
import io
import json
import time
import httpx

# stdout 버퍼링 제거
print = functools.partial(print, flush=True)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "threat-db-raw")

# NVD API 2.0
NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
NVD_API_KEY = os.environ.get("NVD_API_KEY", "")
NVD_RATE_DELAY = 1.0 if NVD_API_KEY else 7.0

# Phase A: A등급 CWE — C/C++ 고유 (메모리 안전 계열만)
# 이 CWE들은 본질적으로 C/C++이므로 검색 결과 대부분이 유효
NVD_CWE_IDS = [
    "CWE-119",  # Buffer Overflow (상위)
    "CWE-120",  # Buffer Copy without Checking Size
    "CWE-121",  # Stack-based Buffer Overflow
    "CWE-122",  # Heap-based Buffer Overflow
    "CWE-125",  # Out-of-bounds Read
    "CWE-787",  # Out-of-bounds Write
    "CWE-788",  # Access of Memory Location After End of Buffer
    "CWE-416",  # Use After Free
    "CWE-415",  # Double Free
    "CWE-476",  # NULL Pointer Dereference
    "CWE-190",  # Integer Overflow
    "CWE-191",  # Integer Underflow
    "CWE-131",  # Incorrect Calculation of Buffer Size
    "CWE-134",  # Use of Externally-Controlled Format String
    "CWE-401",  # Memory Leak
    "CWE-805",  # Buffer Access with Incorrect Length Value
]
# B등급 CWE (CWE-20, 22, 78, 310, 362 등)는 범용이라 CWE 기반 검색 안 함
# → Phase B 기술 스택 키워드로만 수집

# Phase B: 기술 스택 키워드 (B등급 CWE 영역 + 임베디드 플랫폼 포괄)
NVD_TECH_KEYWORDS = [
    # 암호/TLS 라이브러리
    "openssl", "mbedtls", "wolfssl", "gnutls", "boringssl", "libressl",
    "tinydtls", "tinytls", "picotls",
    # 네트워크/HTTP/프로토콜
    "libcurl", "lwIP", "dnsmasq", "libssh", "libssh2",
    "mosquitto", "libcoap", "wakaama",
    "cpp-httplib", "civetweb", "mongoose",
    # OS/커널/부트
    "Linux kernel", "glibc", "busybox", "u-boot", "grub", "systemd",
    # RTOS/임베디드 플랫폼
    "FreeRTOS", "Zephyr", "mbed OS", "VxWorks", "NuttX", "RIOT OS",
    # 파싱/데이터 처리
    "libxml2", "expat", "zlib", "libpng", "libjpeg", "sqlite",
    "rapidjson", "protobuf", "flatbuffers", "nanopb",
    # 가상화/에뮬레이션
    "QEMU", "libvirt",
    # 산업/자동차 특화
    "AUTOSAR", "CODESYS", "OPC UA",
]

# Phase C: 자동차 키워드 (기존)
NVD_AUTO_KEYWORDS = [
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

# 후처리 제외 패턴 (웹/모바일 전용 CVE 필터)
NVD_EXCLUSION_PATTERNS = [
    "wordpress", "drupal", "joomla", "php ",
    "spring framework", "django", "ruby on rails",
    "android app", "ios app", "node.js", "npm package",
]


def _nvd_request(params: dict, seen_ids: set, all_cves: list, label: str) -> int:
    """NVD API 호출 + 중복 제거. 신규 건수를 반환한다."""
    headers = {}
    if NVD_API_KEY:
        headers["apiKey"] = NVD_API_KEY

    new_count = 0
    start_index = 0

    while True:
        params["startIndex"] = start_index
        params["resultsPerPage"] = 2000

        for attempt in range(3):
            try:
                resp = httpx.get(
                    NVD_API_BASE, params=params, headers=headers, timeout=120,
                )
                if resp.status_code == 429:
                    wait = (attempt + 1) * 10
                    print(f"  [NVD] 429 Rate limit — {wait}초 대기 후 재시도")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  [NVD] {label} 실패: {e}")
                    return new_count
                time.sleep(5)

        data = resp.json()
        vulns = data.get("vulnerabilities", [])
        total_results = data.get("totalResults", 0)

        for v in vulns:
            cve_id = v["cve"]["id"]
            if cve_id not in seen_ids:
                seen_ids.add(cve_id)
                all_cves.append(v)
                new_count += 1

        fetched = start_index + len(vulns)
        if fetched >= total_results or len(vulns) == 0:
            break
        start_index = fetched
        time.sleep(NVD_RATE_DELAY)

    return new_count


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
    """NVD CVE 데이터 -- 3단계 전략: CWE 기반 + 기술 스택 + 자동차 키워드"""
    out_dir = os.path.join(DATA_DIR, "nvd")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "embedded_system_cves.json")
    if os.path.exists(out):
        print(f"  [NVD] 캐시 사용: {out}")
        return out

    all_cves: list = []
    seen_ids: set = set()

    # Phase A: CWE 기반 검색
    print(f"\n  [NVD] Phase A: CWE 기반 검색 ({len(NVD_CWE_IDS)}개 CWE)")
    for cwe_id in NVD_CWE_IDS:
        label = f"CWE:{cwe_id}"
        print(f"  [NVD] {label}")
        new = _nvd_request({"cweId": cwe_id}, seen_ids, all_cves, label)
        print(f"  [NVD]   → 신규 {new}건 (누적 {len(all_cves)}건)")
        time.sleep(NVD_RATE_DELAY)

    # Phase B: 기술 스택 키워드 검색
    print(f"\n  [NVD] Phase B: 기술 스택 검색 ({len(NVD_TECH_KEYWORDS)}개 키워드)")
    for kw in NVD_TECH_KEYWORDS:
        label = f"Tech:{kw}"
        print(f"  [NVD] {label}")
        new = _nvd_request({"keywordSearch": kw}, seen_ids, all_cves, label)
        print(f"  [NVD]   → 신규 {new}건 (누적 {len(all_cves)}건)")
        time.sleep(NVD_RATE_DELAY)

    # Phase C: 자동차 키워드 검색 (기존)
    print(f"\n  [NVD] Phase C: 자동차 키워드 검색 ({len(NVD_AUTO_KEYWORDS)}개 키워드)")
    for kw in NVD_AUTO_KEYWORDS:
        label = f"Auto:{kw}"
        print(f"  [NVD] {label}")
        new = _nvd_request({"keywordSearch": kw}, seen_ids, all_cves, label)
        print(f"  [NVD]   → 신규 {new}건 (누적 {len(all_cves)}건)")
        time.sleep(NVD_RATE_DELAY)

    # 후처리: 웹/모바일 전용 CVE 제거
    before = len(all_cves)
    filtered = []
    for v in all_cves:
        desc = ""
        for d in v["cve"].get("descriptions", []):
            if d.get("lang") == "en":
                desc = d.get("value", "").lower()
                break
        if not any(pat in desc for pat in NVD_EXCLUSION_PATTERNS):
            filtered.append(v)
    all_cves = filtered
    excluded = before - len(all_cves)
    if excluded:
        print(f"\n  [NVD] 후처리: 웹/모바일 전용 {excluded}건 제외")

    with open(out, "w") as f:
        json.dump({"vulnerabilities": all_cves, "totalResults": len(all_cves)}, f)

    print(f"  [NVD] 완료: {len(all_cves)}건 -> {out}")
    return out


def download_attack() -> dict[str, str]:
    """ATT&CK ICS + Enterprise STIX 2.1 번들 다운로드"""
    out_dir = os.path.join(DATA_DIR, "attack")
    os.makedirs(out_dir, exist_ok=True)

    paths = {}

    # ICS (기존)
    ics_out = os.path.join(out_dir, "ics-attack.json")
    if os.path.exists(ics_out):
        print(f"  [ATT&CK] ICS 캐시 사용: {ics_out}")
    else:
        url = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/ics-attack/ics-attack.json"
        print(f"  [ATT&CK] ICS 다운로드 중: {url}")
        resp = httpx.get(url, follow_redirects=True, timeout=120)
        resp.raise_for_status()
        with open(ics_out, "w") as f:
            f.write(resp.text)
        size_mb = os.path.getsize(ics_out) / (1024 * 1024)
        print(f"  [ATT&CK] ICS 완료: {ics_out} ({size_mb:.1f}MB)")
    paths["ics"] = ics_out

    # Enterprise (신규)
    ent_out = os.path.join(out_dir, "enterprise-attack.json")
    if os.path.exists(ent_out):
        print(f"  [ATT&CK] Enterprise 캐시 사용: {ent_out}")
    else:
        url = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json"
        print(f"  [ATT&CK] Enterprise 다운로드 중: {url}")
        resp = httpx.get(url, follow_redirects=True, timeout=120)
        resp.raise_for_status()
        with open(ent_out, "w") as f:
            f.write(resp.text)
        size_mb = os.path.getsize(ent_out) / (1024 * 1024)
        print(f"  [ATT&CK] Enterprise 완료: {ent_out} ({size_mb:.1f}MB)")
    paths["enterprise"] = ent_out

    return paths


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


def download_all(*, include_nvd: bool = False) -> dict:
    """전체 다운로드 실행.

    include_nvd=False: CWE + ATT&CK + CAPEC만 (기본 — CVE는 실시간 조회)
    include_nvd=True:  NVD CVE도 사전 적재 (레거시)
    """
    print("=" * 50)
    print("  데이터 다운로드")
    print("=" * 50)

    paths = {}
    paths["cwe"] = download_cwe()
    paths["attack"] = download_attack()      # dict[str, str]
    paths["capec"] = download_capec()

    if include_nvd:
        paths["nvd"] = download_nvd()
    else:
        paths["nvd"] = None
        print("  [NVD] 스킵 — CVE는 프로젝트 분석 시 실시간 조회")

    print(f"\n  전체 다운로드 완료")
    return paths


if __name__ == "__main__":
    download_all()
