"""정적 분석용 심층 템플릿, 복합 패턴, 키워드 검색 매핑."""

DEEP_ANALYSIS_TEMPLATES: dict[str, dict] = {
    "gets": {
        "severity": "critical",
        "title": "스택 버퍼 오버플로우를 통한 원격 코드 실행 가능성",
        "description": (
            "{location}의 gets() 호출은 입력 길이를 제한하지 않습니다. "
            "버퍼 크기를 초과하는 입력 시 스택의 리턴 주소를 덮어써 "
            "공격자가 임의 코드를 실행할 수 있습니다. "
            "이 함수는 ISO/IEC 9899:2011(C11)에서 공식 제거되었으며, "
            "어떠한 경우에도 사용해서는 안 됩니다."
        ),
        "suggestion": "fgets(buf, sizeof(buf), stdin)으로 교체하여 입력 크기를 버퍼 크기로 제한하세요.",
        "fixCode": 'fgets(buf, sizeof(buf), stdin);\nbuf[strcspn(buf, "\\n")] = \'\\0\';  // 개행 제거',
    },
    "strcpy": {
        "severity": "critical",
        "title": "힙/스택 오버플로우를 통한 메모리 손상",
        "description": (
            "{location}의 strcpy()는 소스 문자열의 길이를 검증하지 않습니다. "
            "대상 버퍼보다 큰 소스가 전달되면 인접 메모리 영역이 손상되어 "
            "프로그램 흐름 탈취가 가능합니다. "
            "자동차 ECU 환경에서는 메모리 보호(ASLR, DEP)가 제한적이므로 "
            "익스플로잇 난이도가 데스크톱 환경보다 낮습니다."
        ),
        "suggestion": "strncpy() 또는 strlcpy()를 사용하고, 대상 버퍼 크기를 명시적으로 전달하세요.",
        "fixCode": "strncpy(dst, src, sizeof(dst) - 1);\ndst[sizeof(dst) - 1] = '\\0';",
    },
    "strcat": {
        "severity": "high",
        "title": "문자열 연결 시 버퍼 오버플로우",
        "description": (
            "{location}의 strcat()은 대상 버퍼의 잔여 공간을 확인하지 않습니다. "
            "누적 연결 시 버퍼 경계를 초과하여 스택 또는 힙 메모리가 손상될 수 있습니다. "
            "공격자가 연결할 문자열 길이를 제어할 수 있다면 "
            "정밀한 버퍼 오버플로우 공격이 가능합니다."
        ),
        "suggestion": "strncat()을 사용하고 잔여 크기를 계산하여 전달하세요.",
        "fixCode": "strncat(dst, src, sizeof(dst) - strlen(dst) - 1);",
    },
    "sprintf": {
        "severity": "high",
        "title": "포맷 스트링 취약점 및 버퍼 오버플로우",
        "description": (
            "{location}의 sprintf()는 출력 크기를 제한하지 않아 "
            "버퍼 오버플로우 위험이 있습니다. "
            "또한 사용자 입력이 포맷 문자열에 포함되면 "
            "%%x, %%n 등을 통해 메모리 읽기/쓰기가 가능한 "
            "포맷 스트링 공격에 취약합니다."
        ),
        "suggestion": "snprintf()를 사용하여 출력 크기를 제한하세요.",
        "fixCode": 'snprintf(buf, sizeof(buf), "%s", input);',
    },
    "scanf": {
        "severity": "medium",
        "title": "입력 길이 미제한으로 인한 버퍼 오버플로우",
        "description": (
            "{location}의 scanf()에 길이 지정자가 없어 "
            "버퍼 크기를 초과하는 입력이 가능합니다. "
            "공격자가 긴 문자열을 입력하면 스택 버퍼를 넘쳐 "
            "리턴 주소를 조작할 수 있습니다."
        ),
        "suggestion": 'scanf("%s")에 너비 지정자를 추가하여 입력 길이를 제한하세요.',
        "fixCode": 'scanf("%63s", buf);  // 버퍼 크기 - 1',
    },
    "printf": {
        "severity": "high",
        "title": "포맷 스트링 공격을 통한 메모리 읽기/쓰기",
        "description": (
            "{location}에서 printf()의 첫 번째 인자로 사용자 입력을 직접 전달합니다. "
            "공격자가 %%x, %%n 등의 포맷 지정자를 입력하면 "
            "스택 메모리를 읽거나 임의 주소에 값을 쓸 수 있습니다. "
            "이를 통해 ASLR 우회 정보를 수집하거나, "
            "GOT 엔트리를 덮어써 코드 실행이 가능합니다."
        ),
        "suggestion": 'printf("%s", buf) 형태로 포맷 문자열을 명시적으로 지정하세요.',
        "fixCode": 'printf("%s", buf);',
    },
    "system": {
        "severity": "critical",
        "title": "OS 커맨드 인젝션을 통한 시스템 장악",
        "description": (
            "{location}의 system() 호출에 사용자 입력이 포함되면 "
            "공격자가 셸 메타문자(; | & 등)를 이용해 "
            "임의 OS 명령어를 실행할 수 있습니다. "
            "ECU나 게이트웨이에서 이 취약점이 악용되면 "
            "차량 시스템 전체가 위험에 노출됩니다."
        ),
        "suggestion": (
            "system() 사용을 피하고 execve()와 명시적 인자 배열을 사용하세요. "
            "사용자 입력은 화이트리스트 방식으로 검증하세요."
        ),
        "fixCode": (
            "// execve() 사용 예시\n"
            'char *args[] = {"/usr/bin/prog", validated_input, NULL};\n'
            "execve(args[0], args, environ);"
        ),
    },
    "popen": {
        "severity": "critical",
        "title": "OS 커맨드 인젝션을 통한 시스템 장악",
        "description": (
            "{location}의 popen() 호출에 사용자 입력이 포함되면 "
            "공격자가 셸 메타문자를 이용해 임의 OS 명령어를 실행할 수 있습니다. "
            "popen()은 내부적으로 /bin/sh를 호출하므로 system()과 동일한 위험이 있습니다."
        ),
        "suggestion": (
            "popen() 대신 pipe()+fork()+execve() 조합을 사용하세요. "
            "사용자 입력은 화이트리스트 방식으로 검증하세요."
        ),
        "fixCode": None,
    },
    "malloc": {
        "severity": "medium",
        "title": "메모리 할당 실패 미처리로 인한 NULL 역참조",
        "description": (
            "{location}의 malloc() 반환값을 검사하지 않으면 "
            "메모리 부족 시 NULL 포인터를 역참조하여 크래시가 발생합니다. "
            "장시간 실행되는 ECU에서는 메모리 단편화로 "
            "할당 실패 확률이 높아집니다."
        ),
        "suggestion": "모든 malloc() 호출 후 NULL 체크를 수행하고, 실패 시 적절한 에러 처리를 하세요.",
        "fixCode": "char *ptr = malloc(size);\nif (!ptr) {\n    // handle allocation failure\n    return ERROR;\n}",
    },
    "free": {
        "severity": "medium",
        "title": "Use-After-Free를 통한 임의 코드 실행 가능성",
        "description": (
            "{location}에서 free() 호출 후 해당 포인터를 계속 사용하면 "
            "Use-After-Free 취약점이 발생합니다. "
            "공격자가 해제된 메모리를 재할당하여 제어 데이터를 삽입하면 "
            "임의 코드 실행이 가능합니다."
        ),
        "suggestion": "free() 후 포인터를 NULL로 설정하세요.",
        "fixCode": "free(ptr);\nptr = NULL;",
    },
    "memcpy": {
        "severity": "medium",
        "title": "메모리 복사 시 크기 검증 부재로 인한 버퍼 오버플로우",
        "description": (
            "{location}의 memcpy() 크기 인자가 대상 버퍼 크기를 초과하면 "
            "인접 메모리가 손상됩니다. "
            "공격자가 크기 인자를 제어할 수 있다면 "
            "정밀한 메모리 덮어쓰기가 가능합니다."
        ),
        "suggestion": "복사 크기가 대상 버퍼를 초과하지 않는지 검증하세요.",
        "fixCode": "if (n <= sizeof(dest)) {\n    memcpy(dest, src, n);\n}",
    },
    "recv": {
        "severity": "medium",
        "title": "네트워크 수신 반환값 미검사로 인한 데이터 무결성 위험",
        "description": (
            "{location}의 recv() 반환값을 검사하지 않으면 "
            "수신 실패 또는 부분 수신 시 불완전한 데이터로 "
            "후속 처리가 진행되어 예기치 않은 동작이 발생할 수 있습니다."
        ),
        "suggestion": "recv() 반환값을 검사하고 에러/부분 수신을 처리하세요.",
        "fixCode": (
            "ssize_t n = recv(sock, buf, len, 0);\n"
            "if (n <= 0) {\n"
            "    // handle error or connection closed\n"
            "}"
        ),
    },
    "rand": {
        "severity": "low",
        "title": "예측 가능한 난수 생성기 사용",
        "description": (
            "{location}의 rand()/srand()는 선형 합동 생성기(LCG)를 사용하므로 "
            "시드 값을 알면 전체 난수 시퀀스를 예측할 수 있습니다. "
            "암호화 키, 세션 토큰, 인증 코드 등 보안 목적에는 사용할 수 없습니다."
        ),
        "suggestion": "보안 용도에는 /dev/urandom, getrandom(), 또는 arc4random()을 사용하세요.",
        "fixCode": "#include <sys/random.h>\ngetrandom(&value, sizeof(value), 0);",
    },
    "atoi": {
        "severity": "low",
        "title": "불안전한 정수 변환으로 인한 예기치 않은 동작",
        "description": (
            "{location}의 atoi()는 변환 실패 시 0을 반환하여 "
            "유효한 값과 구분할 수 없습니다. "
            "오버플로우 시에도 에러를 보고하지 않아 "
            "정수 오버플로우 취약점으로 이어질 수 있습니다."
        ),
        "suggestion": "strtol()을 사용하고 errno와 endptr을 확인하세요.",
        "fixCode": (
            "char *endptr;\nerrno = 0;\n"
            "long val = strtol(str, &endptr, 10);\n"
            "if (errno || *endptr != '\\0') {\n"
            "    // handle error\n}"
        ),
    },
}

COMPOUND_PATTERNS: list[dict] = [
    {
        "requires": ["gets", "printf"],
        "severity": "medium",
        "title": "gets()와 printf() 연쇄로 인한 복합 공격 벡터",
        "description": (
            "gets()로 받은 입력을 검증 없이 printf()에 전달하는 패턴은 "
            "버퍼 오버플로우와 포맷 스트링 공격을 동시에 가능하게 합니다. "
            "공격자가 오버플로우로 스택을 조작한 뒤 포맷 스트링으로 "
            "정밀한 메모리 쓰기를 수행하는 연쇄 공격이 가능합니다."
        ),
        "suggestion": (
            "입력 수신과 출력을 분리하고, 각 단계에서 안전한 함수를 사용하세요. "
            '입력은 fgets()로 크기를 제한하고, 출력은 printf("%s", ...)로 포맷을 고정하세요.'
        ),
    },
    {
        "requires": ["system", "gets"],
        "severity": "critical",
        "title": "사용자 입력에서 OS 명령어 실행까지의 공격 체인",
        "description": (
            "gets()로 수신한 사용자 입력이 system()에 전달되는 경로가 존재합니다. "
            "입력 검증이 없어 공격자가 셸 메타문자를 포함한 입력으로 "
            "임의 명령어를 실행할 수 있는 직접적인 공격 체인입니다."
        ),
        "suggestion": (
            "사용자 입력을 셸에 전달하지 마세요. "
            "필요하다면 입력을 화이트리스트로 검증한 뒤 execve()로 실행하세요."
        ),
    },
    {
        "requires": ["system", "scanf"],
        "severity": "critical",
        "title": "사용자 입력에서 OS 명령어 실행까지의 공격 체인",
        "description": (
            "scanf()로 수신한 사용자 입력이 system()에 전달될 가능성이 있습니다. "
            "입력 검증이 없어 공격자가 셸 메타문자를 포함한 입력으로 "
            "임의 명령어를 실행할 수 있는 직접적인 공격 체인입니다."
        ),
        "suggestion": (
            "사용자 입력을 셸에 전달하지 마세요. "
            "필요하다면 입력을 화이트리스트로 검증한 뒤 execve()로 실행하세요."
        ),
    },
    {
        "requires": ["malloc", "free"],
        "severity": "medium",
        "title": "동적 메모리 관리 취약점 체인",
        "description": (
            "malloc()과 free()를 함께 사용하는 패턴에서 "
            "Double-Free, Use-After-Free, 메모리 누수 등 "
            "복합 메모리 관리 취약점이 발생할 수 있습니다. "
            "특히 에러 경로에서 메모리 해제가 누락되기 쉽습니다."
        ),
        "suggestion": (
            "메모리 할당과 해제를 한 쌍으로 관리하는 RAII 패턴을 적용하고, "
            "정적 분석 도구(Valgrind, AddressSanitizer)로 메모리 오류를 검증하세요."
        ),
    },
]

KEYWORD_SEARCH: dict[str, list[str]] = {
    "gets": ["gets("],
    "strcpy": ["strcpy("],
    "strcat": ["strcat("],
    "sprintf": ["sprintf("],
    "scanf": ["scanf("],
    "printf": ["printf("],
    "system": ["system(", "popen("],
    "popen": ["popen("],
    "malloc": ["malloc("],
    "free": ["free("],
    "memcpy": ["memcpy("],
    "recv": ["recv("],
    "rand": ["rand()", "srand("],
    "atoi": ["atoi("],
}
