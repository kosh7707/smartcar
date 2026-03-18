"""
터미널 출력 포매팅 -- 한글 폭 보정 + ANSI 컬러
"""
import re
import unicodedata

_ANSI_RE = re.compile(r'\033\[[0-9;]*m')


class C:
    """ANSI color codes"""
    RST = "\033[0m"
    B = "\033[1m"
    DIM = "\033[2m"

    R = "\033[91m"
    G = "\033[92m"
    Y = "\033[93m"
    BL = "\033[94m"
    M = "\033[95m"
    CY = "\033[96m"
    W = "\033[97m"


def dw(s: str) -> int:
    """Display width -- ANSI 코드 제외, 한글/전각 2칸 계산"""
    clean = _ANSI_RE.sub('', str(s))
    w = 0
    for ch in clean:
        w += 2 if unicodedata.east_asian_width(ch) in ('W', 'F') else 1
    return w


def pad(s: str, width: int, align: str = '<') -> str:
    """한글 폭 보정 패딩"""
    s = str(s)
    diff = max(0, width - dw(s))
    if align == '>':
        return ' ' * diff + s
    elif align == '^':
        left = diff // 2
        return ' ' * left + s + ' ' * (diff - left)
    return s + ' ' * diff


def src_color(source: str) -> str:
    """소스별 컬러 코드 반환"""
    return {"CWE": C.BL, "CVE": C.G, "ATT&CK": C.R, "CAPEC": C.M}.get(source, C.W)


def colored_src(source: str) -> str:
    """소스명에 컬러 적용"""
    return f"{src_color(source)}{source}{C.RST}"


def bar(count: int, scale: int = 10, max_width: int = 16) -> str:
    """컬러 막대 그래프"""
    length = min(count // max(scale, 1), max_width)
    if length == 0:
        return ' ' * max_width
    if count >= 300:
        c = C.R
    elif count >= 80:
        c = C.Y
    else:
        c = C.G
    return f"{c}{'█' * length}{C.RST}" + ' ' * (max_width - length)


def table(headers: list[str], rows: list[list], widths: list[int], aligns: str = None):
    """박스 테이블 출력 (한글 폭 보정, 컬러 보더/헤더)"""
    if aligns is None:
        aligns = '<' * len(headers)

    b = C.DIM
    r = C.RST

    def _sep(l, m, ri):
        return f"  {b}{l}" + f"{m}".join('─' * (w + 2) for w in widths) + f"{ri}{r}"

    def _row(cells, is_header=False):
        parts = []
        for cell, w, a in zip(cells, widths, aligns):
            s = str(cell)
            if is_header:
                parts.append(f" {C.B}{C.CY}{pad(s, w, a)}{r} ")
            else:
                parts.append(f" {pad(s, w, a)} ")
        return f"  {b}│{r}" + f"{b}│{r}".join(parts) + f"{b}│{r}"

    print(_sep('┌', '┬', '┐'))
    print(_row(headers, is_header=True))
    print(_sep('├', '┼', '┤'))
    for row in rows:
        print(_row(row))
    print(_sep('└', '┴', '┘'))


def phase_header(phase: int, title: str):
    """Phase 헤더"""
    w = 58
    print()
    print(f"  {C.CY}{'═' * w}{C.RST}")
    print(f"  {C.B}{C.CY}Phase {phase}{C.RST}{C.CY}: {title}{C.RST}")
    print(f"  {C.CY}{'═' * w}{C.RST}")


def title_box(line1: str, line2: str = ""):
    """메인 타이틀 박스"""
    w = 58
    print()
    print(f"  {C.B}{C.CY}{'═' * w}{C.RST}")
    print(f"  {C.B}{C.W}{line1}{C.RST}")
    if line2:
        print(f"  {C.DIM}{line2}{C.RST}")
    print(f"  {C.B}{C.CY}{'═' * w}{C.RST}")


def result_line(label: str, value: str):
    """결과 한 줄 출력"""
    print(f"  {C.DIM}{label}:{C.RST} {C.W}{value}{C.RST}")
