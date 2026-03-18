import type { SdkProfile } from "@smartcar/shared";

/**
 * 사전 정의 SDK 프로파일
 *
 * 사용자가 SDK를 선택하면 defaults가 자동으로 채워진다.
 * 사용자는 개별 필드를 override 할 수 있다.
 */
export const SDK_PROFILES: SdkProfile[] = [
  {
    id: "ti-am335x",
    name: "TI AM335x (Sitara)",
    vendor: "Texas Instruments",
    description: "TI Sitara AM335x — ARM Cortex-A8, 자동차 게이트웨이/텔레매틱스",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "armv7-a",
      languageStandard: "c99",
      headerLanguage: "c",
      defines: { "__ARM_ARCH": "7", "__ARM_ARCH_7A__": "1" },
    },
  },
  {
    id: "ti-tda4vm",
    name: "TI TDA4VM (Jacinto 7)",
    vendor: "Texas Instruments",
    description: "TI Jacinto 7 TDA4VM — ARM Cortex-A72 + R5F, ADAS/자율주행 SoC",
    defaults: {
      compiler: "aarch64-none-elf-gcc",
      targetArch: "armv8-a",
      languageStandard: "c11",
      headerLanguage: "c",
      defines: { "__aarch64__": "1" },
    },
  },
  {
    id: "nxp-s32k3",
    name: "NXP S32K3xx",
    vendor: "NXP Semiconductors",
    description: "NXP S32K3xx — ARM Cortex-M7, 자동차 바디/게이트웨이 ECU",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "cortex-m7",
      languageStandard: "c11",
      headerLanguage: "c",
      defines: { "__ARM_ARCH": "7", "CPU_S32K344": "1" },
    },
  },
  {
    id: "nxp-s32g2",
    name: "NXP S32G2 (GoldVIP)",
    vendor: "NXP Semiconductors",
    description: "NXP S32G2 — ARM Cortex-A53 + M7, 자동차 네트워크 프로세서/서비스 게이트웨이",
    defaults: {
      compiler: "aarch64-none-elf-gcc",
      targetArch: "armv8-a",
      languageStandard: "c11",
      headerLanguage: "c",
      defines: { "__aarch64__": "1", "S32G2": "1" },
    },
  },
  {
    id: "infineon-aurix-tc3xx",
    name: "Infineon AURIX TC3xx",
    vendor: "Infineon",
    description: "Infineon AURIX TC3xx — TriCore, 자동차 파워트레인/ADAS ECU",
    defaults: {
      compiler: "tricore-elf-gcc",
      targetArch: "tricore",
      languageStandard: "c99",
      headerLanguage: "c",
      defines: { "__TRICORE__": "1" },
    },
  },
  {
    id: "infineon-aurix-tc4xx",
    name: "Infineon AURIX TC4xx",
    vendor: "Infineon",
    description: "Infineon AURIX TC4xx — TriCore 1.8, 차세대 파워트레인/섀시 ECU",
    defaults: {
      compiler: "tricore-elf-gcc",
      targetArch: "tricore",
      languageStandard: "c11",
      headerLanguage: "c",
      defines: { "__TRICORE__": "1", "__TC4xx__": "1" },
    },
  },
  {
    id: "renesas-rh850",
    name: "Renesas RH850",
    vendor: "Renesas",
    description: "Renesas RH850 — 자동차 바디/섀시 ECU",
    defaults: {
      compiler: "v850-elf-gcc",
      targetArch: "rh850",
      languageStandard: "c99",
      headerLanguage: "c",
    },
  },
  {
    id: "renesas-r-car",
    name: "Renesas R-Car H3/M3",
    vendor: "Renesas",
    description: "Renesas R-Car — ARM Cortex-A57/A53, 자동차 인포테인먼트/ADAS",
    defaults: {
      compiler: "aarch64-none-elf-gcc",
      targetArch: "armv8-a",
      languageStandard: "c11",
      headerLanguage: "c",
      defines: { "__aarch64__": "1" },
    },
  },
  {
    id: "st-stellar-sr6",
    name: "ST Stellar SR6 (G4)",
    vendor: "STMicroelectronics",
    description: "ST Stellar SR6 G4 — ARM Cortex-R52, 자동차 도메인 컨트롤러",
    defaults: {
      compiler: "arm-none-eabi-gcc",
      targetArch: "cortex-r52",
      languageStandard: "c11",
      headerLanguage: "c",
      defines: { "__ARM_ARCH": "8" },
    },
  },
  {
    id: "linux-x86-64",
    name: "Linux x86_64 (Host)",
    vendor: "Generic",
    description: "일반 Linux x86_64 — 호스트 개발/테스트용",
    defaults: {
      compiler: "gcc",
      targetArch: "x86_64",
      languageStandard: "c11",
      headerLanguage: "auto",
    },
  },
  {
    id: "linux-x86-64-cpp",
    name: "Linux x86_64 C++ (Host)",
    vendor: "Generic",
    description: "일반 Linux x86_64 C++ — 호스트 개발/테스트용",
    defaults: {
      compiler: "g++",
      targetArch: "x86_64",
      languageStandard: "cpp17",
      headerLanguage: "cpp",
    },
  },
  {
    id: "custom",
    name: "Custom (직접 설정)",
    vendor: "",
    description: "사용자가 모든 빌드 환경을 직접 설정",
    defaults: {
      compiler: "gcc",
      targetArch: "x86_64",
      languageStandard: "c11",
      headerLanguage: "auto",
    },
  },
];

export function findSdkProfile(id: string): SdkProfile | undefined {
  return SDK_PROFILES.find((p) => p.id === id);
}
