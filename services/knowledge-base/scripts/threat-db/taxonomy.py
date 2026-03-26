"""
도메인 공격 표면 택소노미 + 분류기
키워드 매칭(폴백) + 임베딩 유사도(기본) + CWE 계층 구조
자동차 + C/C++ 임베디드 + 시스템 프로그래밍 포괄
"""
from __future__ import annotations

import numpy as np
from fastembed import TextEmbedding

# 11개 공격 표면 분류체계 (자동차 8 + 임베디드/시스템 3)
AUTOMOTIVE_ATTACK_SURFACES: dict[str, list[str]] = {
    # ── 자동차 도메인 (기존 8개) ──
    "CAN Bus/차량 내부 네트워크": [
        "can bus", "can message", "can frame", "can-bus", "controller area network",
        "obd-ii", "obd2", "obd-2", "j1939", "uds", "diagnostic", "doip",
        "lin bus", "flexray", "most bus", "automotive ethernet",
    ],
    "IVI/헤드유닛": [
        "infotainment", "ivi", "head unit", "headunit", "android auto", "carplay",
        "bluetooth", "wifi", "wi-fi", "usb", "media player", "navigation",
        "display audio", "touchscreen",
    ],
    "V2X/텔레매틱스": [
        "v2x", "v2v", "v2i", "vehicle-to", "dsrc", "c-v2x",
        "telematic", "connected vehicle", "cellular", "5g", "lte", "4g",
        "tcu", "tbox", "t-box", "mqtt", "vehicle cloud",
    ],
    "OTA/펌웨어 업데이트": [
        "ota", "firmware update", "software update", "fota", "sota",
        "bootloader", "secure boot", "firmware image", "code signing",
        "update package", "delta update",
    ],
    "ECU/게이트웨이": [
        "ecu", "gateway", "autosar", "embedded", "microcontroller", "mcu",
        "rtos", "sensor", "actuator", "powertrain", "body control",
        "engine control", "transmission control",
    ],
    "키/인증 시스템": [
        "key fob", "keyless", "immobilizer", "pke", "passive keyless",
        "relay attack", "rolljam", "roll jam", "remote keyless",
        "smart key", "transponder",
    ],
    "ADAS/자율주행": [
        "adas", "autonomous", "lidar", "radar", "camera", "gps", "gnss",
        "spoofing", "lane", "self-driving", "autopilot", "sensor fusion",
        "object detection", "path planning",
    ],
    "충전 인프라": [
        "evse", "ev charging", "ccs", "chademo", "iso 15118",
        "plug-in", "charging station", "charger", "electric vehicle",
        "vehicle-to-grid", "v2g",
    ],
    # ── 임베디드/시스템 도메인 (신규 3개) ──
    "임베디드/RTOS": [
        "freertos", "zephyr", "rtos", "bare-metal", "mbed", "threadx",
        "vxworks", "nuttx", "contiki", "riot-os", "arm cortex", "risc-v",
        "real-time operating system",
    ],
    "시스템 라이브러리": [
        "openssl", "mbedtls", "wolfssl", "libcurl", "zlib", "glibc",
        "busybox", "u-boot", "libxml2", "sqlite", "dnsmasq", "lwip",
        "grub", "qemu",
    ],
    "산업제어/ICS": [
        "scada", "plc", "hmi", "modbus", "dnp3", "iec 61850",
        "iec 62443", "industrial control", "ics",
    ],
}

# 도메인 관련 키워드 (relevance 점수 산출용)
# 자동차 + C/C++ 임베디드 + 시스템 프로그래밍 포괄
AUTOMOTIVE_KEYWORDS: list[str] = [
    # ── 자동차 (기존) ──
    "automotive", "vehicle", "car", "automobile",
    "ecu", "can bus", "obd", "adas",
    "autosar", "iso 26262", "iso 21434", "unece", "r155", "r156",
    "telematics", "infotainment", "v2x", "ota", "firmware",
    "connected vehicle", "autonomous driving", "lidar", "radar",
    "key fob", "immobilizer", "charging", "evse",
    "misra", "sotif", "iso 21448", "secoc",
    "can message", "diagnostic", "uds",
    # ── C/C++ 메모리 안전 ──
    "buffer overflow", "use-after-free", "double free", "null pointer",
    "integer overflow", "format string", "stack overflow", "heap overflow",
    "out of bounds", "memory corruption",
    # ── 임베디드/시스템 ──
    "embedded", "microcontroller", "freertos", "zephyr", "rtos",
    "arm cortex", "risc-v", "bare-metal", "embedded linux",
    "openssl", "mbedtls", "libcurl", "linux kernel", "busybox", "u-boot",
    # ── 산업제어 ──
    "scada", "plc", "iec 62443", "modbus",
]

# CWE -> 위협 카테고리 매핑 (상위 CWE 기준)
CWE_THREAT_CATEGORIES: dict[str, list[str]] = {
    "Memory Corruption": [
        "CWE-119", "CWE-120", "CWE-121", "CWE-122", "CWE-124", "CWE-125",
        "CWE-126", "CWE-127", "CWE-131", "CWE-170", "CWE-787", "CWE-788",
        "CWE-416", "CWE-415", "CWE-476", "CWE-190", "CWE-191",
        "CWE-680", "CWE-805", "CWE-806",
    ],
    "Injection": [
        "CWE-74", "CWE-77", "CWE-78", "CWE-79", "CWE-80", "CWE-89",
        "CWE-90", "CWE-91", "CWE-94", "CWE-95", "CWE-96", "CWE-917",
    ],
    "Authentication/Authorization": [
        "CWE-255", "CWE-256", "CWE-257", "CWE-258", "CWE-259", "CWE-260",
        "CWE-261", "CWE-287", "CWE-288", "CWE-290", "CWE-294", "CWE-295",
        "CWE-306", "CWE-307", "CWE-308", "CWE-521", "CWE-522",
        "CWE-798", "CWE-862", "CWE-863",
    ],
    "Cryptography": [
        "CWE-310", "CWE-311", "CWE-312", "CWE-319", "CWE-320", "CWE-321",
        "CWE-322", "CWE-323", "CWE-324", "CWE-325", "CWE-326", "CWE-327",
        "CWE-328", "CWE-329", "CWE-330", "CWE-331", "CWE-338",
    ],
    "Input Validation": [
        "CWE-20", "CWE-22", "CWE-23", "CWE-36", "CWE-73", "CWE-99",
        "CWE-113", "CWE-134", "CWE-352", "CWE-601", "CWE-918",
    ],
    "Resource Management": [
        "CWE-400", "CWE-401", "CWE-404", "CWE-407", "CWE-410", "CWE-770",
        "CWE-771", "CWE-772", "CWE-774", "CWE-775", "CWE-789",
    ],
    "Concurrency": [
        "CWE-362", "CWE-364", "CWE-366", "CWE-367", "CWE-820", "CWE-821",
    ],
    "Configuration/Deployment": [
        "CWE-16", "CWE-250", "CWE-269", "CWE-276", "CWE-284", "CWE-668",
        "CWE-732", "CWE-922",
    ],
}


def classify_attack_surfaces_keyword(text: str) -> list[str]:
    """텍스트에서 공격 표면 키워드 매칭 (폴백용)"""
    text_lower = text.lower()
    surfaces = []
    for surface, keywords in AUTOMOTIVE_ATTACK_SURFACES.items():
        if any(kw in text_lower for kw in keywords):
            surfaces.append(surface)
    return surfaces


def compute_automotive_relevance_keyword(title: str, description: str) -> float:
    """도메인 관련성 점수 — 키워드 기반 (폴백용)"""
    text = f"{title} {description}".lower()
    matched = sum(1 for kw in AUTOMOTIVE_KEYWORDS if kw in text)
    return min(1.0, matched / 7.0)


# ── 임베딩 유사도 기반 분류 ──

_model: TextEmbedding | None = None
_surface_vecs: dict[str, np.ndarray] = {}
_relevance_vec: np.ndarray | None = None

# 각 공격 표면의 시맨틱 참조 텍스트
_SURFACE_REFS: dict[str, str] = {
    "CAN Bus/차량 내부 네트워크":
        "CAN bus controller area network vehicle internal communication "
        "OBD diagnostic J1939 UDS DoIP FlexRay LIN bus automotive ethernet",
    "IVI/헤드유닛":
        "infotainment head unit bluetooth wifi media navigation display "
        "touchscreen android auto carplay USB audio",
    "V2X/텔레매틱스":
        "V2X V2V V2I vehicle-to-everything DSRC C-V2X telematics "
        "connected vehicle cellular 5G LTE TCU MQTT vehicle cloud",
    "OTA/펌웨어 업데이트":
        "OTA firmware update software update FOTA SOTA bootloader "
        "secure boot firmware image code signing delta update",
    "ECU/게이트웨이":
        "ECU electronic control unit gateway AUTOSAR embedded "
        "microcontroller MCU RTOS sensor actuator powertrain",
    "키/인증 시스템":
        "key fob keyless entry immobilizer PKE passive keyless "
        "relay attack rolljam remote keyless smart key transponder",
    "ADAS/자율주행":
        "ADAS autonomous driving lidar radar camera GPS GNSS "
        "spoofing lane detection self-driving sensor fusion object detection",
    "충전 인프라":
        "EVSE EV charging CCS CHAdeMO ISO 15118 plug-in "
        "charging station electric vehicle vehicle-to-grid V2G",
    "임베디드/RTOS":
        "FreeRTOS Zephyr RTOS bare-metal mbed ThreadX VxWorks NuttX "
        "ARM Cortex RISC-V real-time operating system embedded",
    "시스템 라이브러리":
        "OpenSSL mbedTLS wolfSSL libcurl zlib glibc busybox U-Boot "
        "libxml2 SQLite dnsmasq lwIP GRUB QEMU",
    "산업제어/ICS":
        "SCADA PLC HMI Modbus DNP3 IEC 61850 IEC 62443 "
        "industrial control system ICS OPC UA",
}

_RELEVANCE_REF = (
    "automotive vehicle embedded firmware ECU microcontroller RTOS "
    "security vulnerability C/C++ memory safety buffer overflow "
    "CAN bus OBD AUTOSAR ISO 26262 ISO 21434"
)


def _ensure_model() -> None:
    """fastembed 모델 + 참조 벡터를 lazy-load한다."""
    global _model, _surface_vecs, _relevance_vec
    if _model is not None:
        return

    _model = TextEmbedding("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

    for name, ref_text in _SURFACE_REFS.items():
        vec = list(_model.embed([ref_text]))[0]
        _surface_vecs[name] = np.array(vec)

    _relevance_vec = np.array(list(_model.embed([_RELEVANCE_REF]))[0])


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def classify_attack_surfaces(text: str) -> list[str]:
    """키워드 매칭으로 공격 표면 분류.

    임베딩 유사도는 일반적 보안 설명과 자동차 특화 참조 간 유사도가
    너무 낮아(0.1~0.25) 공격 표면 분류에는 부적합하다.
    키워드 매칭이 이 용도에는 더 정확하다.
    """
    return classify_attack_surfaces_keyword(text)


def compute_automotive_relevance(title: str, description: str) -> float:
    """하이브리드 도메인 관련성: 키워드(60%) + 임베딩 유사도(40%).

    키워드 매칭은 정확하지만 유의어를 놓치고,
    임베딩 유사도는 넓은 의미를 잡지만 도메인 추론이 약하다.
    두 점수를 가중 합산하여 보완한다.
    """
    kw_score = compute_automotive_relevance_keyword(title, description)

    _ensure_model()
    text_vec = np.array(list(_model.embed([f"{title} {description}"]))[0])
    emb_score = max(0.0, _cosine_sim(text_vec, _relevance_vec))

    combined = 0.6 * kw_score + 0.4 * emb_score
    return round(min(1.0, combined), 2)


# ── CWE 계층 기반 위협 카테고리 ──


def classify_threat_category(
    cwe_id: str,
    parent_map: dict[str, str] | None = None,
) -> str:
    """CWE ID → 위협 카테고리. 직접 매칭 실패 시 ChildOf 부모를 따라 올라감."""
    for category, cwe_ids in CWE_THREAT_CATEGORIES.items():
        if cwe_id in cwe_ids:
            return category

    if parent_map:
        current = cwe_id
        for _ in range(5):
            parent = parent_map.get(current)
            if not parent:
                break
            for category, cwe_ids in CWE_THREAT_CATEGORIES.items():
                if parent in cwe_ids:
                    return category
            current = parent

    return "Other"
