#!/usr/bin/env python3
"""Renderiza a apresentação (mesma estrutura do .pptx) em PDF via PyMuPDF,
para inspeção visual e detecção de texto estourando (overflow)."""
import re
import fitz
import gen_apresentacao as G

W, H = 960, 540  # 13.333 x 7.5 in * 72


def c(rgbcolor):
    h = str(rgbcolor)  # 'EE4E1B'
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)


ORANGE_D, ORANGE_L, ORANGE = c(G.ORANGE_D), c(G.ORANGE_L), c(G.ORANGE)
INK, MUTED, WHITE = c(G.INK), c(G.MUTED), (1, 1, 1)
CARD, LINE = c(G.CARD), c(G.LINE)

warnings = []


def R(l, t, w, h):
    return fitz.Rect(l * 72, t * 72, (l + w) * 72, (t + h) * 72)


def grad(page, l, t, w, h, c0, c1, horizontal=True):
    n = 160
    if horizontal:
        sw = (w * 72) / n
        for i in range(n):
            f = i / (n - 1)
            col = tuple(c0[k] + (c1[k] - c0[k]) * f for k in range(3))
            x = l * 72 + i * sw
            page.draw_rect(fitz.Rect(x, t * 72, x + sw + 1, (t + h) * 72), color=None, fill=col)


def rect(page, l, t, w, h, fill=None, line=None, lw=1):
    page.draw_rect(R(l, t, w, h), color=line, fill=fill, width=lw if line else 0)


DEJA = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
DEJA_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def text(page, l, t, w, h, s, size, color, bold=False, align=0, font=None, tag=""):
    rc = page.insert_textbox(R(l, t, w, h), s, fontsize=size,
                             fontname=("djb" if bold else "djr"),
                             fontfile=(DEJA_B if bold else DEJA),
                             color=color, align=align)
    if rc < 0:
        warnings.append(f"  OVERFLOW {tag}: '{s[:40]}...' (faltam {abs(rc):.0f}pt)")
    return rc


def strip(t):
    return re.sub(r"\*\*(.+?)\*\*", r"\1", t)


def bullets(page, items, l, t, w, h, size, tag=""):
    body = "\n".join("▪  " + strip(it) for it in items)
    return text(page, l, t, w, h, body, size, INK, align=0, tag=tag)


def logo(page, l, t, h=0.42):
    w = h * (600 / 159)
    page.insert_image(R(l, t, w, h), filename="/home/user/agenda-facil/" + G.LOGO_PATH, keep_proportion=True)


def topbar(page, running):
    grad(page, 0, 0, 13.333, 1.0, ORANGE_D, ORANGE_L)
    logo(page, 0.6, 0.29)
    if running:
        text(page, 6.0, 0.32, 6.8, 0.5, running, 15, WHITE, bold=True, align=2)


def title(page, t, size=30, top=1.35):
    text(page, 0.6, top, 12.1, 1.1, t, size, INK, bold=True, tag="title:" + t[:20])


def main():
    doc = fitz.open()
    DATA = G.DATA
    for n, spec in enumerate(DATA, 1):
        page = doc.new_page(width=W, height=H)
        t = spec["type"]
        tag = f"s{n}/{t}"
        if t == "cover":
            grad(page, 0, 0, 13.333, 7.5, ORANGE_D, ORANGE_L)
            logo(page, 0.72, 0.6, h=0.62)
            text(page, 0.75, 2.4, 9.5, 2.2, "Áreas de Atuação\n& Impacto", 46, WHITE, bold=True)
            text(page, 0.78, 4.8, 8.6, 1.3,
                 "Uma visão consolidada e detalhada de todas as frentes que conduzo hoje na "
                 "companhia — do produto à infraestrutura, passando por dados, suporte, times e "
                 "Customer Success.", 16, WHITE, tag=tag)
            text(page, 0.78, 6.3, 11, 0.6,
                 f"{G.PRESENTER} · Tecnologia, Produto, Dados & CS · Junho/2026", 14, WHITE)
            continue
        topbar(page, spec.get("running"))
        if t == "overview":
            title(page, "Seis frentes, uma operação")
            text(page, 0.6, 2.15, 12.1, 0.7,
                 "Cada frente equivale, no mercado, a um cargo de diretoria ou liderança — e por "
                 "trás de cada uma há um líder em desenvolvimento.", 13.5, MUTED, tag=tag)
            cw, ch, gx, gy = 3.78, 1.55, 0.28, 0.22
            for i, (tt, d) in enumerate(G.OVERVIEW_CARDS):
                col, row = i % 3, i // 3
                l = 0.6 + col * (cw + gx); tp = 3.1 + row * (ch + gy)
                rect(page, l, tp, cw, ch, fill=CARD, line=LINE)
                rect(page, l, tp, 0.12, ch, fill=ORANGE)
                text(page, l + 0.3, tp + 0.18, cw - 0.5, 0.4, tt, 14, INK, bold=True)
                text(page, l + 0.3, tp + 0.6, cw - 0.5, ch - 0.7, d, 11, MUTED, tag=tag)
        elif t == "section":
            title(page, spec["title"], size=40)
            text(page, 0.6, 2.5, 12.1, 0.6,
                 "Quatro frentes de produto + liderança — uma página dedicada para cada:", 15, MUTED)
            rect(page, 0.6, 3.3, 12.13, 0.5, fill=ORANGE)
            text(page, 0.85, 3.4, 11, 0.4, "Frentes", 14, WHITE, bold=True)
            rect(page, 0.6, 3.8, 12.13, 2.5, fill=CARD, line=LINE)
            bullets(page, spec["items"], 0.95, 4.0, 11.4, 2.1, 16, tag=tag)
        elif t == "detail":
            title(page, spec["title"])
            cols = spec["cols"]; size = spec.get("size", 13)
            RT, RH = G.REGION_TOP, G.REGION_H; pad = 0.55
            no_head = all(h is None for h, _ in cols)
            if no_head and len(cols) == 2:
                ch = min(max(max(G.est_height(cols[0][1], size, 5.0),
                                 G.est_height(cols[1][1], size, 5.0)) + pad, 1.2), RH)
                top = RT + (RH - ch) / 2
                rect(page, 0.6, top, 12.13, ch, fill=CARD, line=LINE)
                bullets(page, cols[0][1], 0.95, top + 0.28, 5.6, ch - 0.5, size, tag=tag + "L")
                bullets(page, cols[1][1], 6.75, top + 0.28, 5.6, ch - 0.5, size, tag=tag + "R")
            elif spec.get("wide") or len(cols) == 1:
                bsize = max(size, 15)
                ch = min(max(G.est_height(cols[0][1], bsize, 11.0) + pad, 1.0), RH - 0.55)
                top = RT + (RH - (0.55 + ch)) / 2
                rect(page, 0.6, top, 12.13, 0.5, fill=ORANGE)
                text(page, 0.85, top + 0.1, 11, 0.4, cols[0][0] or "Detalhamento", 14, WHITE, bold=True)
                rect(page, 0.6, top + 0.55, 12.13, ch, fill=CARD, line=LINE)
                bullets(page, cols[0][1], 0.95, top + 0.81, 11.4, ch - 0.45, bsize, tag=tag)
            else:
                ch = min(max(max(G.est_height(cols[0][1], size, 4.8),
                                 G.est_height(cols[1][1], size, 4.8)) + pad, 1.0), RH - 0.55)
                top = RT + (RH - (0.55 + ch)) / 2
                for idx, (h, items) in enumerate(cols):
                    l = 0.6 + idx * 6.33
                    rect(page, l, top, 5.8, 0.5, fill=ORANGE)
                    text(page, l + 0.25, top + 0.1, 5.3, 0.4, h, 14, WHITE, bold=True)
                    rect(page, l, top + 0.55, 5.8, ch, fill=CARD, line=LINE)
                    bullets(page, items, l + 0.35, top + 0.81, 5.1, ch - 0.45, size, tag=tag + f"c{idx}")
        elif t == "times":
            title(page, "Construí os times que sustentam a operação")
            text(page, 0.6, 2.05, 12.1, 1.0,
                 "15+ pessoas contratadas e formadas em Tecnologia, Produto, Dados e Suporte. Por "
                 "trás de cada área, um líder que estou desenvolvendo.", 16, INK, tag=tag)
            cw, ch = 1.34, 0.55
            for i, nm in enumerate(G.names):
                col, row = i % 7, i // 7
                l = 0.6 + col * (cw + 0.16); tp = 3.35 + row * (ch + 0.18)
                rect(page, l, tp, cw, ch, fill=CARD, line=LINE)
                text(page, l, tp + 0.16, cw, 0.3, nm, 13, INK, bold=True, align=1)
            text(page, 0.6, 5.0, 12.1, 1.0,
                 "Resultado: um salto na qualidade percebida do time — consistência e "
                 "confiabilidade que hoje são referência interna.", 16, INK, tag=tag)
        elif t == "metrics":
            title(page, "Três entregas que mudaram o patamar")
            cw, ch = 3.78, 2.6
            for i, (big, lbl) in enumerate(G.METRICS):
                l = 0.6 + i * (cw + 0.28)
                rect(page, l, 2.6, cw, ch, fill=CARD, line=LINE)
                rect(page, l, 2.6, cw, 0.12, fill=ORANGE)
                text(page, l + 0.3, 2.95, cw - 0.6, 0.6, big, 26, ORANGE, bold=True)
                text(page, l + 0.3, 3.7, cw - 0.6, ch - 1.2, lbl, 13, MUTED, tag=tag)
            text(page, 0.6, 5.6, 12.1, 1.0,
                 "Além de receita habilitada em parcerias, risco mitigado em segurança e a base de "
                 "dados pronta para decisões preditivas.", 14, MUTED, tag=tag)
        elif t == "closing":
            title(page, "Uma visão consolidada — pronta para discutir")
            text(page, 0.6, 2.2, 12.1, 1.6,
                 "Seis áreas de atuação detalhadas, 15+ pessoas formadas, um produto de IA em "
                 "crescimento acelerado e uma operação mais barata e mais confiável. Trouxe esse "
                 "panorama para darmos visibilidade ao todo e discutirmos juntos os próximos "
                 "passos de cada frente.", 17, INK, tag=tag)
            x, y = 0.6, 4.5; cur = x
            for ch in G.CLOSING_CHIPS:
                w = 0.36 + len(ch) * 0.108
                if cur + w > 12.6:
                    cur = x; y += 0.7
                rect(page, cur, y, w, 0.55, fill=CARD, line=LINE)
                text(page, cur, y + 0.16, w, 0.3, ch, 12.5, INK, bold=True, align=1)
                cur += w + 0.2
        # page number
        text(page, 11.8, 7.02, 1.1, 0.3, f"{n} / {len(DATA)}", 9, MUTED, align=2)

    doc.save("/home/user/agenda-facil/docs/conversa-ceo/apresentacao.pdf")
    print("OK -> apresentacao.pdf", len(DATA), "pags")
    if warnings:
        print("\n=== AVISOS DE OVERFLOW ===")
        print("\n".join(warnings))
    else:
        print("Sem overflow detectado.")


if __name__ == "__main__":
    main()
