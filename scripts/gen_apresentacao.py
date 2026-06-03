#!/usr/bin/env python3
"""Gera a apresentação das áreas de atuação em .pptx (importável no Google Slides)."""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR

BG     = RGBColor(0x0B, 0x10, 0x20)
CARD   = RGBColor(0x18, 0x22, 0x3A)
INK    = RGBColor(0xEA, 0xF0, 0xFB)
MUTED  = RGBColor(0x9A, 0xA7, 0xBD)
ACCENT = RGBColor(0x2D, 0xD4, 0xBF)
GOLD   = RGBColor(0xF4, 0xB7, 0x40)
LINE   = RGBColor(0x2A, 0x36, 0x52)
FONT   = "Segoe UI"

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def new_slide():
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    return s


def box(s, l, t, w, h, anchor=None):
    tb = s.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    if anchor:
        tf.vertical_anchor = anchor
    return tf


def run(p, text, size, color, bold=False):
    r = p.add_run(); r.text = text
    f = r.font; f.size = Pt(size); f.bold = bold; f.color.rgb = color; f.name = FONT
    return r


def kicker(s, text):
    p = box(s, 0.9, 0.55, 11.5, 0.5).paragraphs[0]
    run(p, text.upper(), 12.5, ACCENT, bold=True)


def title(s, text, top=1.05, size=34):
    p = box(s, 0.9, top, 11.5, 1.5).paragraphs[0]
    run(p, text, size, INK, bold=True)


def column(s, groups, l, t, w, h, size=14):
    """groups: list of (header|None, [items])."""
    tf = box(s, l, t, w, h)
    started = False
    for header, items in groups:
        if header is not None:
            p = tf.paragraphs[0] if not started else tf.add_paragraph()
            if started:
                p.space_before = Pt(12)
            run(p, header.upper(), 12.5, GOLD, bold=True)
            p.space_after = Pt(6)
            started = True
        for it in items:
            p = tf.paragraphs[0] if not started else tf.add_paragraph()
            started = True
            run(p, "▪  ", size, ACCENT, bold=True)
            # allow **bold** spans
            parts = it.split("**")
            for i, seg in enumerate(parts):
                if seg:
                    run(p, seg, size, INK if i % 2 else MUTED, bold=bool(i % 2))
            p.space_after = Pt(6)
            p.line_spacing = 1.08


def card(s, l, t, w, h, fill=CARD):
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,
                            Inches(l), Inches(t), Inches(w), Inches(h))
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.color.rgb = LINE; sh.line.width = Pt(1)
    sh.shadow.inherit = False
    try:
        sh.adjustments[0] = 0.07
    except Exception:
        pass
    return sh


def footer(s, n):
    p = box(s, 0.9, 7.0, 8, 0.4).paragraphs[0]
    run(p, "Starbem · Áreas de Atuação & Impacto", 9, MUTED)
    p2 = box(s, 12.0, 7.0, 0.9, 0.4).paragraphs[0]
    p2.alignment = 2
    run(p2, str(n), 9, MUTED)


# ---------------- 1. CAPA ----------------
s = new_slide()
p = box(s, 0.9, 2.0, 11.5, 0.5).paragraphs[0]
run(p, "★ STARBEM", 14, ACCENT, bold=True)
p = box(s, 0.9, 2.5, 11.5, 1.8).paragraphs[0]
run(p, "Áreas de Atuação & Impacto", 46, INK, bold=True)
tf = box(s, 0.9, 4.2, 9.5, 1.4)
p = tf.paragraphs[0]
run(p, "Uma visão consolidada das frentes que conduzo hoje na companhia — do produto à "
       "infraestrutura, passando por dados, CS, suporte e times.", 17, MUTED)
p.line_spacing = 1.3
p = box(s, 0.9, 5.9, 11.5, 0.6).paragraphs[0]
run(p, "Renato · Tecnologia, Produto, Dados & CS · Junho/2026", 15, MUTED)

# ---------------- 2. VISÃO GERAL ----------------
s = new_slide()
kicker(s, "Onde eu atuo hoje")
title(s, "Seis frentes, uma operação")
p = box(s, 0.9, 1.95, 11.5, 0.9).paragraphs[0]
run(p, "Cada frente equivale, no mercado, a um cargo de diretoria ou liderança — e por trás "
       "de cada uma há um líder em desenvolvimento.", 14, MUTED)
p.line_spacing = 1.2
areas = [
    ("Customer Success", "Estrutura, implantação e ciclo de vida do cliente."),
    ("Produto", "B2C, profissional, RH (NR1) e parcerias — 5 OKRs."),
    ("Engenharia", "Plataforma, segurança, IA e novos modelos de operação."),
    ("Dados", "Datalake e inteligência preditiva/prescritiva."),
    ("IT & Suporte", "Tickets, integração com CS/Produto e custos."),
    ("Principal Engineer", "Arquitetura, nuvem e fornecedores estratégicos."),
]
cw, ch, gx, gy = 3.65, 1.75, 0.29, 0.25
x0, y0 = 0.9, 3.05
for i, (t, d) in enumerate(areas):
    col, row = i % 3, i // 3
    l = x0 + col * (cw + gx)
    tp = y0 + row * (ch + gy)
    card(s, l, tp, cw, ch)
    tf = box(s, l + 0.25, tp + 0.2, cw - 0.5, ch - 0.4)
    pp = tf.paragraphs[0]; run(pp, t, 16, INK, bold=True)
    pp2 = tf.add_paragraph(); pp2.space_before = Pt(4); run(pp2, d, 11.5, MUTED)
    pp2.line_spacing = 1.15
footer(s, 2)

# ---------------- 3. CS ----------------
s = new_slide()
kicker(s, "Área 1 · Customer Success")
title(s, "Estruturei o CS de ponta a ponta")
column(s, [("Operação", [
    "Estruturação da área e do modelo de **CSM**",
    "Novo modelo de operação de **implantação**",
    "Processo fim a fim: **Vendas → Implantação → Manutenção → Expansão**",
    "Automação e troca da liderança de CX",
])], 0.9, 2.4, 5.6, 4.3)
column(s, [("Liderança", [
    "Plano de transformação da área",
    "Desenvolvimento do líder para voar solo",
    "Apoio nos processos seletivos e na escolha de pessoas",
    "Atuação direta na troca de pessoas-chave",
])], 6.9, 2.4, 5.6, 4.3)
footer(s, 3)

# ---------------- 4. PRODUTO ----------------
s = new_slide()
kicker(s, "Área 2 · Produto · 5 OKRs")
title(s, "Produto em quatro frentes simultâneas")
column(s, [
    ("Paciente (B2C)", [
        "Cross Service, canal **WhatsApp**, **StarBrain**",
        "Jornada **Shapeme** e evolução do B2C + faturamento",
    ]),
    ("Profissional", [
        "Videochamadas, NPS, **prontuário automatizado**",
        "Automação de cadastro/consumo/NF · agendas e faturamento TP",
    ]),
], 0.9, 2.4, 5.6, 4.3, size=13)
column(s, [
    ("RH (NR1)", [
        "**NR1** e Portal RH · multi-tiers (Produto 1–4)",
        "Reuniões comerciais com clientes",
    ]),
    ("Parcerias", [
        "API V2, **iFood**, TotalPass, Claro · custos de LLM",
        "Novos produtos para parceiros (Shapeme)",
    ]),
], 6.9, 2.4, 5.6, 4.3, size=13)
footer(s, 4)

# ---------------- 5. ENGENHARIA ----------------
s = new_slide()
kicker(s, "Área 3 · Engenharia")
title(s, "Plataforma, segurança e IA")
column(s, [("Construção", [
    "Acompanhamento semanal da **qualidade de chamada**",
    "Segurança com a **Tempest** + próximos passos",
    "Construção do produto **Shapeme**",
    "Plataforma **Tiny Teams** e novo modelo de operação",
    "Camada agêntica **ExABI**",
])], 0.9, 2.4, 5.6, 4.3)
column(s, [("Liderança", [
    "Desenvolvimento da líder para atuação estratégica",
    "Troca de pessoas-chave",
    "Novos modelos de operação de engenharia",
    "Engenharia **cross-área** (ex.: CS AI Engineering)",
])], 6.9, 2.4, 5.6, 4.3)
footer(s, 5)

# ---------------- 6. DADOS ----------------
s = new_slide()
kicker(s, "Área 4 · Dados")
title(s, "Da arquitetura à inteligência preditiva")
column(s, [("Construção", [
    "Estruturação do **Datalake** e da camada inteligente",
    "Análises **preditivas e prescritivas**",
    "Reestruturação da arquitetura de dados",
    "Camada de inteligência do negócio · contratações",
])], 0.9, 2.4, 5.6, 4.3)
column(s, [("Liderança", [
    "PDI e desenvolvimento do time",
    "People management e engajamento (Rodrigo)",
    "Plano de crescimento: novo líder + analista de **impacto financeiro**",
])], 6.9, 2.4, 5.6, 4.3)
footer(s, 6)

# ---------------- 7. IT & SUPORTE + PRINCIPAL ----------------
s = new_slide()
kicker(s, "Áreas 5 e 6 · IT & Suporte · Principal Engineer")
title(s, "A base que sustenta tudo")
column(s, [("IT & Suporte", [
    "Estrutura de **tickets** e acompanhamento contínuo",
    "Integração **Suporte ↔ CS ↔ Produto**",
    "Redução de custo no contrato de aluguel de PCs",
])], 0.9, 2.4, 5.6, 4.3)
column(s, [("Principal Engineer", [
    "Análise semanal de **bugs estruturais** (com Júlio)",
    "Desenho arquitetural das soluções",
    "Nuvem: **troca AWS** e custo de infra ~0",
    "Fornecedores: **Agora.io** e **Twilio** (renegociação)",
])], 6.9, 2.4, 5.6, 4.3)
footer(s, 7)

# ---------------- 8. TIMES ----------------
s = new_slide()
kicker(s, "O que conecta todas as áreas")
title(s, "Construí os times que sustentam a operação")
tf = box(s, 0.9, 2.05, 11.3, 1.0)
p = tf.paragraphs[0]
run(p, "15+ pessoas", 17, ACCENT, bold=True)
run(p, " contratadas e formadas em Tecnologia, Produto, Dados e Suporte. Por trás de cada "
       "área, um líder que estou desenvolvendo.", 16, MUTED)
p.line_spacing = 1.25
names = ["Barbara", "Felipe", "Tenório", "Leo", "Rodrigo", "Bruno", "Vitor", "Humberto", "Mila"]
cw, ch, gx = 1.32, 0.55, 0.16
x, y = 0.9, 3.45
per_row = 7
for i, nm in enumerate(names):
    col, row = i % per_row, i // per_row
    l = x + col * (cw + gx)
    tp = y + row * (ch + 0.18)
    card(s, l, tp, cw, ch)
    tcell = box(s, l, tp, cw, ch, anchor=MSO_ANCHOR.MIDDLE)
    pc = tcell.paragraphs[0]; pc.alignment = 1
    run(pc, nm, 13, INK, bold=True)
p = box(s, 0.9, 5.1, 11.3, 1.0).paragraphs[0]
run(p, "Resultado: um salto na ", 16, MUTED)
run(p, "qualidade percebida", 16, INK, bold=True)
run(p, " do time — consistência e confiabilidade que hoje são referência interna.", 16, MUTED)
p.line_spacing = 1.25
footer(s, 8)

# ---------------- 9. DESTAQUES ----------------
s = new_slide()
kicker(s, "Destaques do período")
title(s, "Três entregas que mudaram o patamar")
metrics = [
    ("R$30k → 100k", "MRR do novo produto 100% IA, puxado por iFood e TotalPass México"),
    ("15+", "pessoas contratadas e formadas, com líderes em desenvolvimento"),
    ("~R$800k", "de custo de nuvem evitado até dez/2026 (Azure → AWS + créditos)"),
]
cw, ch, gx = 3.65, 2.7, 0.29
x, y = 0.9, 2.6
for i, (big, lbl) in enumerate(metrics):
    l = x + i * (cw + gx)
    card(s, l, y, cw, ch)
    tf = box(s, l + 0.3, y + 0.35, cw - 0.6, ch - 0.6)
    pp = tf.paragraphs[0]; run(pp, big, 30, ACCENT, bold=True)
    pp2 = tf.add_paragraph(); pp2.space_before = Pt(10)
    run(pp2, lbl, 13.5, MUTED); pp2.line_spacing = 1.2
p = box(s, 0.9, 5.7, 11.5, 1.0).paragraphs[0]
run(p, "Além de receita habilitada em parcerias, risco mitigado em segurança e a base de "
       "dados pronta para decisões preditivas.", 14, MUTED)
p.line_spacing = 1.2
footer(s, 9)

# ---------------- 10. FUTURO ----------------
s = new_slide()
kicker(s, "Para onde vai")
title(s, "Estratégia de produto com IA — próximos 12 meses")
column(s, [(None, [
    "**Produto 100% IA** em escala: de R$30k para **+R$100k de MRR**, com pipeline de "
    "parceiros (iFood, TotalPass México)",
    "**ExABI** — camada agêntica da Starbem como diferencial competitivo",
    "**StarBrain** retroalimentado por dados: visão unificada de paciente e profissional",
    "**Datalake preditivo** ligando dados a impacto financeiro do negócio",
    "**Tiny Teams**: fazer mais com menos, escalando operação com IA",
])], 0.9, 2.4, 11.5, 4.3, size=16)
footer(s, 10)

# ---------------- 11. FECHAMENTO ----------------
s = new_slide()
kicker(s, "Em resumo")
title(s, "Uma visão consolidada — pronta para discutir")
tf = box(s, 0.9, 2.2, 11.3, 1.8)
p = tf.paragraphs[0]
run(p, "Seis áreas de atuação, 15+ pessoas formadas, um produto de IA em crescimento "
       "acelerado e uma operação mais barata e mais confiável. Trouxe esse panorama para "
       "darmos visibilidade ao todo e ", 17, MUTED)
run(p, "discutirmos juntos os próximos passos de cada frente.", 17, INK, bold=True)
p.line_spacing = 1.3
chips = ["Customer Success", "Produto", "Engenharia", "Dados", "IT & Suporte",
         "Arquitetura & Nuvem", "Times & Liderança"]
x, y = 0.9, 4.6
cur = x
for c in chips:
    w = 0.32 + len(c) * 0.105
    if cur + w > 12.4:
        cur = x; y += 0.7
    card(s, cur, y, w, 0.55)
    tcell = box(s, cur, y, w, 0.55, anchor=MSO_ANCHOR.MIDDLE)
    pc = tcell.paragraphs[0]; pc.alignment = 1
    run(pc, c, 12.5, INK)
    cur += w + 0.2
footer(s, 11)

out = "docs/conversa-ceo/apresentacao.pptx"
prs.save(out)
print("OK ->", out)
