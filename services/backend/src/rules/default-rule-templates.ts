import type { Severity } from "@aegis/shared";

export interface DefaultRuleTemplate {
  idSuffix: string;
  name: string;
  severity: Severity;
  description: string;
  suggestion: string;
  pattern: string; // RegExp.source — new RegExp(pattern) 으로 복원
  fixCode?: string;
}

// ── Dangerous Functions (9) ──────────────────────────────────

const DANGEROUS_FUNCTION_TEMPLATES: DefaultRuleTemplate[] = [
  {
    idSuffix: "DFUNC-gets",
    name: "Buffer Overflow via gets()",
    severity: "critical",
    description:
      "gets() 함수는 입력 길이를 제한하지 않아 버퍼 오버플로우가 발생할 수 있습니다.",
    suggestion: "fgets()로 교체하세요.",
    pattern: "\\bgets\\s*\\(",
    fixCode: "fgets(buf, sizeof(buf), stdin);",
  },
  {
    idSuffix: "DFUNC-strcpy",
    name: "Buffer Overflow via strcpy()",
    severity: "high",
    description:
      "strcpy() 함수는 복사 길이를 검사하지 않아 버퍼 오버플로우가 발생할 수 있습니다.",
    suggestion: "strncpy() 또는 strlcpy()를 사용하세요.",
    pattern: "\\bstrcpy\\s*\\(",
    fixCode: "strncpy(dest, src, sizeof(dest) - 1);",
  },
  {
    idSuffix: "DFUNC-scanf",
    name: "Buffer Overflow via scanf()",
    severity: "high",
    description:
      "scanf() 사용 시 입력 길이 제한이 없으면 버퍼 오버플로우가 발생할 수 있습니다.",
    suggestion: "길이 제한자를 추가하거나 fgets()를 사용하세요.",
    pattern: "\\bscanf\\s*\\(",
    fixCode: 'scanf("%9s", buf);',
  },
  {
    idSuffix: "DFUNC-sprintf",
    name: "Buffer Overflow via sprintf()",
    severity: "high",
    description:
      "sprintf() 함수는 출력 길이를 검사하지 않아 버퍼 오버플로우가 발생할 수 있습니다.",
    suggestion: "snprintf()를 사용하세요.",
    pattern: "\\bsprintf\\s*\\(",
    fixCode: "snprintf(buf, sizeof(buf), fmt, args);",
  },
  {
    idSuffix: "DFUNC-strcat",
    name: "Buffer Overflow via strcat()",
    severity: "high",
    description:
      "strcat() 함수는 대상 버퍼의 남은 공간을 검사하지 않습니다.",
    suggestion: "strncat()을 사용하세요.",
    pattern: "\\bstrcat\\s*\\(",
    fixCode: "strncat(dest, src, sizeof(dest) - strlen(dest) - 1);",
  },
  {
    idSuffix: "DFUNC-system",
    name: "Command Injection via system()",
    severity: "critical",
    description:
      "system() 함수에 사용자 입력이 전달되면 명령어 삽입 공격이 가능합니다.",
    suggestion: "execvp() 등 인자 분리 함수를 사용하세요.",
    pattern: "\\bsystem\\s*\\(",
    fixCode: "execvp(command, args);",
  },
  {
    idSuffix: "DFUNC-memcpy",
    name: "Potential Buffer Overflow via memcpy()",
    severity: "medium",
    description:
      "memcpy()에 전달되는 크기가 대상 버퍼보다 크면 버퍼 오버플로우가 발생합니다.",
    suggestion: "복사 크기가 대상 버퍼를 초과하지 않는지 반드시 검증하세요.",
    pattern: "\\bmemcpy\\s*\\(",
    fixCode: "memcpy(dest, src, MIN(n, sizeof(dest)));",
  },
  {
    idSuffix: "DFUNC-alloca",
    name: "Stack Overflow via alloca()",
    severity: "high",
    description:
      "alloca()는 스택에 동적 할당하므로 큰 크기나 반복 호출 시 스택 오버플로우가 발생합니다.",
    suggestion: "malloc() 또는 고정 크기 배열을 사용하세요.",
    pattern: "\\balloca\\s*\\(",
    fixCode: "void *p = malloc(size); /* free(p) 필수 */",
  },
  {
    idSuffix: "DFUNC-popen",
    name: "Command Injection via popen()",
    severity: "high",
    description:
      "popen()은 셸을 통해 명령을 실행하므로 입력이 검증되지 않으면 명령어 삽입이 가능합니다.",
    suggestion: "pipe() + fork() + exec() 조합을 사용하세요.",
    pattern: "\\bpopen\\s*\\(",
  },
];

// ── Unsafe Patterns (8) ──────────────────────────────────────

const UNSAFE_PATTERN_TEMPLATES: DefaultRuleTemplate[] = [
  {
    idSuffix: "FMT-001",
    name: "Format String Vulnerability",
    severity: "high",
    description:
      "printf()에 포맷 문자열 대신 변수가 직접 전달되어 포맷 스트링 공격이 가능합니다.",
    suggestion: 'printf("%s", variable) 형식을 사용하세요.',
    pattern: "\\bprintf\\s*\\(\\s*[a-zA-Z_]\\w*\\s*\\)",
    fixCode: 'printf("%s", userInput);',
  },
  {
    idSuffix: "ATOI-001",
    name: "Unsafe Integer Conversion",
    severity: "medium",
    description:
      "atoi() 함수는 변환 실패 시 0을 반환하여 에러 처리가 불가능합니다.",
    suggestion: "strtol()을 사용하여 에러 처리를 수행하세요.",
    pattern: "\\batoi\\s*\\(",
    fixCode: "long val = strtol(str, &endptr, 10);",
  },
  {
    idSuffix: "RAND-001",
    name: "Weak Random Number Generator",
    severity: "low",
    description:
      "rand() 함수는 예측 가능한 난수를 생성하여 보안 용도로 부적합합니다.",
    suggestion: "보안 목적으로는 /dev/urandom 또는 CSPRNG를 사용하세요.",
    pattern: "\\brand\\s*\\(\\s*\\)",
  },
  {
    idSuffix: "HARDCODED-KEY-001",
    name: "Hardcoded Secret/Key",
    severity: "critical",
    description:
      "소스코드에 비밀키, 패스워드, 토큰이 하드코딩되어 있습니다. 바이너리 역공학 시 노출됩니다.",
    suggestion: "Secure Storage 또는 HSM을 통해 런타임에 키를 로드하세요.",
    pattern: "(?:key|password|secret|token)\\s*(?:=|:)\\s*[\"'][^\"']{4,}[\"']",
  },
  {
    idSuffix: "FIXED-SEED-001",
    name: "Fixed Random Seed",
    severity: "medium",
    description:
      "srand()에 고정 시드가 전달되어 난수 시퀀스가 항상 동일합니다.",
    suggestion: "time(NULL) 등 가변 시드를 사용하거나, 보안 용도에는 CSPRNG를 사용하세요.",
    pattern: "\\bsrand\\s*\\(\\s*\\d+\\s*\\)",
    fixCode: "srand((unsigned int)time(NULL));",
  },
  {
    idSuffix: "VLA-001",
    name: "Variable Length Array (VLA) Usage",
    severity: "medium",
    description:
      "VLA는 스택 크기를 런타임에 결정하므로 큰 값이 전달되면 스택 오버플로우가 발생합니다.",
    suggestion: "malloc()으로 힙 할당하거나 고정 크기 배열을 사용하세요.",
    pattern: "\\b\\w+\\s+\\w+\\s*\\[\\s*[a-zA-Z_]\\w*\\s*\\]\\s*;",
    fixCode: "int *arr = malloc(n * sizeof(int)); /* free(arr) 필수 */",
  },
  {
    idSuffix: "DEPRECATED-CRYPTO-001",
    name: "Deprecated Cryptographic Algorithm",
    severity: "high",
    description:
      "MD5, SHA-1, DES, RC4 등은 취약한 암호 알고리즘으로, 차량 보안에 부적합합니다.",
    suggestion: "SHA-256 이상 또는 AES-128/256을 사용하세요.",
    pattern: "\\b(?:MD5|SHA1|DES_|RC4)\\s*[\\(_]",
  },
  {
    idSuffix: "NO-AUTH-CAN-001",
    name: "Unauthenticated CAN Message Transmission",
    severity: "high",
    description:
      "인증 없이 CAN 메시지를 전송하면 스푸핑 공격에 취약합니다.",
    suggestion: "SecOC(Secure Onboard Communication) 또는 CMAC 인증을 적용하세요.",
    pattern: "\\bcan_send\\s*\\([^)]*\\)\\s*;",
  },
];

// ── Memory Safety (5) ────────────────────────────────────────

const MEMORY_SAFETY_TEMPLATES: DefaultRuleTemplate[] = [
  {
    idSuffix: "MEM-UAF-001",
    name: "Potential Use-After-Free",
    severity: "critical",
    description:
      "free() 호출 후 포인터를 NULL로 초기화하지 않으면 Use-After-Free 취약점이 발생할 수 있습니다.",
    suggestion: "free() 직후 포인터를 NULL로 설정하세요.",
    pattern: "\\bfree\\s*\\(\\s*(\\w+)\\s*\\)",
    fixCode: "free(ptr); ptr = NULL;",
  },
  {
    idSuffix: "MEM-REALLOC-001",
    name: "Unsafe realloc() Pattern",
    severity: "high",
    description:
      "realloc() 실패 시 NULL을 반환하는데, 원본 포인터에 직접 대입하면 메모리 릭이 발생합니다.",
    suggestion: "임시 포인터로 받아 NULL 체크 후 대입하세요.",
    pattern: "(\\w+)\\s*=\\s*realloc\\s*\\(\\s*\\1\\s*,",
    fixCode: "void *tmp = realloc(ptr, new_size); if (tmp) ptr = tmp;",
  },
  {
    idSuffix: "MEM-MALLOC-NOCHECK-001",
    name: "Unchecked Memory Allocation",
    severity: "medium",
    description:
      "malloc()/calloc() 반환값을 검사하지 않으면 NULL 역참조로 크래시가 발생할 수 있습니다.",
    suggestion: "할당 후 반드시 NULL 체크를 수행하세요.",
    pattern: "(?:malloc|calloc)\\s*\\([^)]+\\)\\s*;",
    fixCode: "void *p = malloc(size); if (!p) { /* error handling */ }",
  },
  {
    idSuffix: "MEM-DOUBLE-FREE-001",
    name: "Potential Double Free",
    severity: "critical",
    description:
      "동일 포인터에 대해 free()가 두 번 호출되면 힙 손상으로 임의 코드 실행이 가능합니다.",
    suggestion: "free() 후 포인터를 NULL로 설정하여 이중 해제를 방지하세요.",
    pattern: "\\bfree\\s*\\(\\s*(\\w+)\\s*\\).*\\bfree\\s*\\(\\s*\\1\\s*\\)",
    fixCode: "free(ptr); ptr = NULL;",
  },
  {
    idSuffix: "MEM-INT-OVERFLOW-001",
    name: "Integer Overflow in Allocation Size",
    severity: "high",
    description:
      "malloc(n * sizeof(...)) 패턴에서 n이 크면 정수 오버플로우로 작은 버퍼가 할당됩니다.",
    suggestion: "오버플로우 검증을 수행하거나 calloc(n, sizeof(...))을 사용하세요.",
    pattern: "\\bmalloc\\s*\\(\\s*[a-zA-Z_]\\w*\\s*\\*\\s*(?:sizeof\\s*\\(|[a-zA-Z_]\\w*)",
    fixCode: "calloc(n, sizeof(struct_type));",
  },
];

// ── 전체 템플릿 (22개) ──────────────────────────────────────

export const DEFAULT_RULE_TEMPLATES: DefaultRuleTemplate[] = [
  ...DANGEROUS_FUNCTION_TEMPLATES,
  ...UNSAFE_PATTERN_TEMPLATES,
  ...MEMORY_SAFETY_TEMPLATES,
];
