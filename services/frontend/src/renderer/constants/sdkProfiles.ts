import type { SdkProfile } from "@aegis/shared";

/** 12개 사전정의 SDK 프로파일 + Custom */
export const SDK_PROFILES: SdkProfile[] = [
  {
    id: "autosar-classic-tc3xx",
    name: "AUTOSAR Classic (TC3xx)",
    vendor: "Infineon",
    description: "TriCore TC3xx 기반 AUTOSAR Classic Platform (Body/Chassis/Powertrain ECU)",
    defaults: {
      compiler: "tasking-ctc",
      targetArch: "tricore",
      languageStandard: "c99",
      headerLanguage: "c",
    },
  },
  {
    id: "autosar-adaptive-arm",
    name: "AUTOSAR Adaptive (ARM)",
    vendor: "AUTOSAR",
    description: "POSIX 기반 AUTOSAR Adaptive Platform (Cortex-A 계열)",
    defaults: {
      compiler: "aarch64-linux-gnu-g++",
      targetArch: "aarch64",
      languageStandard: "c++17",
      headerLanguage: "cpp",
    },
  },
  {
    id: "nxp-s32k",
    name: "NXP S32K (Cortex-M)",
    vendor: "NXP",
    description: "NXP S32K1xx/S32K3xx 시리즈 — Body/Gateway ECU",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "arm-cortex-m7",
      languageStandard: "c11",
      headerLanguage: "c",
    },
  },
  {
    id: "nxp-s32g2",
    name: "NXP S32G2 (Gateway)",
    vendor: "NXP",
    description: "NXP S32G2 Vehicle Network Processor — Gateway/Service-Oriented ECU",
    defaults: {
      compiler: "aarch64-linux-gnu-gcc",
      targetArch: "aarch64",
      languageStandard: "c11",
      headerLanguage: "c",
    },
  },
  {
    id: "renesas-rh850",
    name: "Renesas RH850",
    vendor: "Renesas",
    description: "Renesas RH850 시리즈 — Chassis/Powertrain 고신뢰 ECU",
    defaults: {
      compiler: "ccrh",
      targetArch: "rh850",
      languageStandard: "c99",
      headerLanguage: "c",
    },
  },
  {
    id: "ti-tms570",
    name: "TI TMS570 (Cortex-R)",
    vendor: "Texas Instruments",
    description: "TI Hercules TMS570 — Safety-Critical Cortex-R MCU",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "arm-cortex-r5",
      languageStandard: "c99",
      headerLanguage: "c",
    },
  },
  {
    id: "qualcomm-sa8xxx",
    name: "Qualcomm SA8xxx",
    vendor: "Qualcomm",
    description: "Qualcomm Snapdragon Ride — ADAS/IVI SoC (Linux/QNX)",
    defaults: {
      compiler: "aarch64-linux-gnu-g++",
      targetArch: "aarch64",
      languageStandard: "c++17",
      headerLanguage: "cpp",
    },
  },
  {
    id: "nvidia-orin",
    name: "NVIDIA Orin",
    vendor: "NVIDIA",
    description: "NVIDIA DRIVE Orin — 자율주행/ADAS SoC",
    defaults: {
      compiler: "aarch64-linux-gnu-g++",
      targetArch: "aarch64",
      languageStandard: "c++17",
      headerLanguage: "cpp",
    },
  },
  {
    id: "stm32-cortex-m",
    name: "STM32 (Cortex-M)",
    vendor: "STMicroelectronics",
    description: "STM32 시리즈 — 범용 Cortex-M MCU",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "arm-cortex-m4",
      languageStandard: "c11",
      headerLanguage: "c",
    },
  },
  {
    id: "infineon-traveo",
    name: "Infineon TRAVEO II",
    vendor: "Infineon",
    description: "Infineon TRAVEO T2G — Cluster/HMI Cortex-M MCU",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "arm-cortex-m7",
      languageStandard: "c11",
      headerLanguage: "c",
    },
  },
  {
    id: "generic-arm-cortex-r",
    name: "Generic ARM Cortex-R",
    vendor: "ARM",
    description: "범용 ARM Cortex-R 프로파일 (Safety MCU)",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "arm-cortex-r5",
      languageStandard: "c11",
      headerLanguage: "c",
    },
  },
  {
    id: "generic-linux",
    name: "Generic Linux/POSIX",
    vendor: "-",
    description: "범용 Linux/POSIX 환경 (x86_64 또는 aarch64)",
    defaults: {
      compiler: "gcc",
      targetArch: "x86_64",
      languageStandard: "c17",
      headerLanguage: "auto",
    },
  },
  {
    id: "custom",
    name: "사용자 정의",
    vendor: "-",
    description: "모든 필드를 직접 설정합니다.",
    defaults: {
      compiler: "",
      targetArch: "",
      languageStandard: "c11",
      headerLanguage: "auto",
    },
  },
];

export function getSdkProfile(id: string): SdkProfile | undefined {
  return SDK_PROFILES.find((p) => p.id === id);
}
