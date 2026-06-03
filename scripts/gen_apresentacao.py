#!/usr/bin/env python3
"""Gera a apresentação das áreas de atuação (Starbem) em .pptx e .html.

Identidade visual baseada no template oficial da Starbem:
  - Logo ★ starbem sobre faixa laranja
  - Gradiente laranja (#EE4E1B -> #FF8A1E), fundo branco, cartões cinza-claro
  - Títulos em Funnel Display, corpo em Calibri
Todo o detalhamento das frentes é preservado — nenhuma linha de ação é removida.
Customer Success aparece como a ÚLTIMA área.
"""
import re
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR

PRESENTER = "Renato"

# ----------------------------------------------------------------------------
# CONTEÚDO (verbatim do detalhamento enviado, apenas com pequena limpeza formal)
# ----------------------------------------------------------------------------
cs_oper = [
    "Estruturação da área",
    "Estrutura de **CSM**",
    "Novo modelo de operação de **implantação**",
    "Troca de liderança de CX",
    "Implementação de **automação**",
    "Processo fim a fim: **Vendas → Implantação → Manutenção → Expansão**",
    "Novo modelo de operação (Thaís)",
]
cs_lid = [
    "Estruturação de plano de transformação da área",
    "Desenvolvimento do líder que ainda não está pronto para voar solo",
    "Apoio em todos os processos seletivos e desenvolvimento do líder para escolher pessoas",
    "Atuação direta na troca de pessoal-chave do time",
]
prod_paciente = [
    "Uso de múltiplos serviços — **Cross Service**",
    "Novo canal **WhatsApp** para pacientes",
    "**StarBrain** — Cérebro Central com visão unificada do paciente",
    "**Shapeme** — Jornada comercial",
    "**Shapeme** — Desenho da jornada",
    "Evolução de jornada **B2C**",
    "Acompanhamento de faturamento e crescimento de B2C",
]
prod_profissional = [
    "Correção e acompanhamento de **videochamadas**",
    "Evolução de **NPS**",
    "Pesquisa de qualidade de atendimento",
    "Pesquisa de infraestrutura profissional",
    "Gravação e transcrição de chamada",
    "Construção de **prontuário automatizado**",
    "Retroalimentação do cérebro central",
    "Planejamento de serviços de automação para o profissional: cadastro, consumo mensal, notas fiscais etc.",
    "Controle de agendas e faturamento **TP**",
    "Evolução e análise mensal de qualidade e melhorias para profissionais",
]
prod_rh = [
    "Construção/evolução de **NR1**",
    "Construção/evolução do **Portal RH**",
    "Correção de problemas NR1 (Eduardo O.)",
    "Planejamento e evolução do Portal RH para valor real ao RH",
    "Definição **multi-tiers** de NR1 para múltiplas demandas de clientes (Produto de 1 a 4)",
    "Reuniões comerciais com clientes — retirada de dúvidas sobre NR1",
    "Evolução de dores em casos de falha de APIs em cliente B2B (**iFood**)",
]
prod_parcerias = [
    "Análise de qualidade da **API V2**",
    "Atuações pontuais em problemas crônicos da API (ex.: iFood)",
    "Apoio à estrutura do time com pouco headcount",
    "Reuniões comerciais com parceiros como **iFood, TotalPass, Claro** etc.",
    "Evolução e acompanhamento de custos mensais de **LLM**",
    "Construção e evolução de novos produtos para parceiros, como **Shapeme**",
]
prod_lid = [
    "Estruturação de plano de evolução da área, com foco na dificuldade de escala",
    "Desenvolvimento do líder que ainda não está pronto para voar solo",
    "Apoio em todos os processos seletivos e desenvolvimento do líder para escolher pessoas",
    "Atuação direta na troca de pessoas-chave do time",
]
eng_dir = [
    "Evolução e acompanhamento semanal de qualidade de chamada",
    "Consultoria de Segurança — **Tempest**",
    "Próximos passos de estruturação de Segurança",
    "**Shapeme** — construção do produto",
    "Visão de projeto **Tiny Teams**",
    "Construção da plataforma Tiny Teams e novo modelo de operação",
    "Camada Agêntica Starbem — **ExABI**",
]
eng_lid = [
    "Desenvolvimento da líder para atuação estratégica no business",
    "Atuação direta na troca de pessoas-chave do time",
    "Desenvolvimento e expansão de consciência para novos modelos de operação de engenharia",
    "Aumento de escopo para ampliação de impacto, implantando engenharia cross-área (ex.: CS AI Engineering)",
]
dados_dir = [
    "Estruturação e construção do **Datalake** e da camada inteligente da Starbem para análises prescritivas e preditivas",
    "Construção e manutenção da camada de inteligência do negócio",
    "Reestruturação da arquitetura de dados da Starbem",
    "Atuação na contratação de novos profissionais",
]
dados_lid = [
    "Atuação com **PDI** e desenvolvimento do time",
    "Acompanhamento semanal de tarefas",
    "People management para engajamento do Rodrigo",
    "Plano de crescimento da área com novo líder e segundo analista focado em análise preditiva e impacto financeiro",
]
it_items = [
    "Construção e manutenção da estrutura de **tickets** e suporte",
    "Acompanhamento de evolução de tickets",
    "Aproximação entre **Suporte, CS e Produto** para evolução contínua",
    "Relacionamento e definição de estratégia para redução de custos no contrato de provedor de aluguel de PCs",
    "Definição da operação da área",
]
pe_items = [
    "Análises semanais de bugs estruturais da operação (com Júlio)",
    "Desenho arquitetural de soluções da Starbem",
    "Relacionamento com provedor de nuvem",
    "Troca de parceiro **AWS**",
    "Acompanhamento mensal de custos de nuvem",
    "Manutenção de **custo zero** de infraestrutura Starbem",
    "Relacionamento estratégico com fornecedores como **Agora.io** e **Twilio**",
    "Discussão de contrato para redução de custos com Agora e Twilio",
]
estrategia = [
    "Apoio na estruturação de **OKRs**",
    "Influência em múltiplas áreas e com múltiplos líderes para aumento de impacto",
    "Evolução nos processos de contratação para aumento de talentos no quadro de colaboradores",
    "Discussões estratégicas sobre o futuro dos produtos e construção de vantagem competitiva",
]
futuro = [
    "**Produto 100% IA** em escala: de R$30k para **+R$100k de MRR**, com pipeline de parceiros (iFood, TotalPass México)",
    "**ExABI** — camada agêntica da Starbem como diferencial competitivo",
    "**StarBrain** retroalimentado por dados: visão unificada de paciente e profissional",
    "**Datalake preditivo** ligando dados a impacto financeiro do negócio",
    "**Tiny Teams**: fazer mais com menos, escalando operação com IA",
]
names = ["Barbara", "Felipe", "Tenório", "Leo", "Rodrigo", "Bruno", "Vitor", "Humberto", "Mila"]


def split(lst):
    h = (len(lst) + 1) // 2
    return lst[:h], lst[h:]


# Estrutura de slides — Customer Success por ÚLTIMO ---------------------------
DATA = [
    {"type": "cover"},
    {"type": "overview"},
    # Área 1 · Produto (com uma página por frente)
    {"type": "section", "running": "Área 1 · Produto · 5 OKRs", "title": "Produto",
     "items": ["Frente **Paciente** — jornada B2C", "Frente **Profissional**",
               "Frente **RH** (NR1)", "Frente **Parcerias**", "**Liderança** de Produto"]},
    {"type": "detail", "running": "Área 1 · Produto · Frente Paciente",
     "title": "Paciente — Jornada B2C",
     "cols": [(None, split(prod_paciente)[0]), (None, split(prod_paciente)[1])]},
    {"type": "detail", "running": "Área 1 · Produto · Frente Profissional", "title": "Profissional",
     "cols": [(None, split(prod_profissional)[0]), (None, split(prod_profissional)[1])]},
    {"type": "detail", "running": "Área 1 · Produto · Frente RH", "title": "RH — NR1 & Portal RH",
     "cols": [(None, split(prod_rh)[0]), (None, split(prod_rh)[1])]},
    {"type": "detail", "running": "Área 1 · Produto · Frente Parcerias", "title": "Parcerias",
     "cols": [(None, split(prod_parcerias)[0]), (None, split(prod_parcerias)[1])]},
    {"type": "detail", "running": "Área 1 · Produto · Liderança", "title": "Liderança de Produto",
     "cols": [("Liderança", prod_lid)], "wide": True},
    # Área 2 · Engenharia
    {"type": "detail", "running": "Área 2 · Engenharia", "title": "Engenharia",
     "cols": [("Diretoria", eng_dir), ("Liderança", eng_lid)]},
    # Área 3 · Dados
    {"type": "detail", "running": "Área 3 · Dados", "title": "Dados",
     "cols": [("Diretoria", dados_dir), ("Liderança", dados_lid)]},
    # Área 4 · IT & Suporte
    {"type": "detail", "running": "Área 4 · IT & Suporte", "title": "IT & Suporte",
     "cols": [("IT & Suporte", it_items)], "wide": True},
    # Área 5 · Principal Engineer
    {"type": "detail", "running": "Área 5 · Principal Engineer", "title": "Principal Engineer",
     "cols": [(None, split(pe_items)[0]), (None, split(pe_items)[1])]},
    # Área 6 · Customer Success (ÚLTIMA)
    {"type": "detail", "running": "Área 6 · Customer Success", "title": "Customer Success",
     "cols": [("Diretoria — Operação", cs_oper), ("Liderança", cs_lid)]},
    # Camada transversal
    {"type": "detail", "running": "Camada transversal", "title": "Estratégia Starbem",
     "cols": [("Estratégia", estrategia)], "wide": True},
    {"type": "times", "running": "Times & Liderança"},
    {"type": "metrics", "running": "Destaques do período"},
    {"type": "detail", "running": "Para onde vai", "title": "Estratégia de produto com IA — próximos 12 meses",
     "cols": [("Próximos 12 meses", futuro)], "wide": True, "size": 16},
    {"type": "closing", "running": "Em resumo"},
]

OVERVIEW_CARDS = [
    ("Produto · 5 OKRs", "Paciente, Profissional, RH (NR1) e Parcerias."),
    ("Engenharia", "Plataforma, segurança, IA e novos modelos de operação."),
    ("Dados", "Datalake e inteligência preditiva/prescritiva."),
    ("IT & Suporte", "Tickets, integração com CS/Produto e custos."),
    ("Principal Engineer", "Arquitetura, nuvem e fornecedores estratégicos."),
    ("Customer Success", "Estrutura, implantação e ciclo de vida do cliente."),
]
CLOSING_CHIPS = ["Produto", "Engenharia", "Dados", "IT & Suporte", "Arquitetura & Nuvem",
                 "Times & Liderança", "Customer Success"]
METRICS = [("R$30k → 100k", "MRR do novo produto 100% IA, puxado por iFood e TotalPass México"),
           ("15+", "pessoas contratadas e formadas, com líderes em desenvolvimento"),
           ("~R$800k", "de custo de nuvem evitado até dez/2026 (Azure → AWS + créditos)")]

# ----------------------------------------------------------------------------
# IDENTIDADE VISUAL STARBEM
# ----------------------------------------------------------------------------
ORANGE_D = RGBColor(0xEE, 0x4E, 0x1B)
ORANGE_L = RGBColor(0xFF, 0x8A, 0x1E)
ORANGE = RGBColor(0xF2, 0x65, 0x22)
INK = RGBColor(0x2B, 0x2B, 0x2B)
MUTED = RGBColor(0x6B, 0x72, 0x80)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CARD = RGBColor(0xF5, 0xF6, 0xF8)
LINE = RGBColor(0xE2, 0xE5, 0xEA)
TITLE_FONT = "Funnel Display"
BODY_FONT = "Calibri"


def build_pptx():
    prs = Presentation()
    prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
    BLANK = prs.slide_layouts[6]

    def new(bg=WHITE):
        s = prs.slides.add_slide(BLANK)
        s.background.fill.solid(); s.background.fill.fore_color.rgb = bg
        return s

    def box(s, l, t, w, h, anchor=None):
        tf = s.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h)).text_frame
        tf.word_wrap = True
        if anchor:
            tf.vertical_anchor = anchor
        return tf

    def run(p, text, size, color, bold=False, font=BODY_FONT):
        r = p.add_run(); r.text = text
        f = r.font; f.size = Pt(size); f.bold = bold; f.color.rgb = color; f.name = font
        return r

    def rich(p, text, size, base=INK):
        for i, seg in enumerate(text.split("**")):
            if seg:
                run(p, seg, size, base, bold=bool(i % 2))

    def rect(s, l, t, w, h, fill, line=None, rounded=False, grad=None):
        shp = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
        sh = s.shapes.add_shape(shp, Inches(l), Inches(t), Inches(w), Inches(h))
        sh.shadow.inherit = False
        if grad:
            try:
                sh.fill.gradient()
                sh.fill.gradient_angle = 0.0
                gs = sh.fill.gradient_stops
                gs[0].position = 0.0; gs[0].color.rgb = grad[0]
                gs[1].position = 1.0; gs[1].color.rgb = grad[1]
            except Exception:
                sh.fill.solid(); sh.fill.fore_color.rgb = grad[0]
        else:
            sh.fill.solid(); sh.fill.fore_color.rgb = fill
        if line:
            sh.line.color.rgb = line; sh.line.width = Pt(1)
        else:
            sh.line.fill.background()
        if rounded:
            try:
                sh.adjustments[0] = 0.06
            except Exception:
                pass
        return sh

    def logo(s, l, t, big=False):
        tf = box(s, l, t, 4.5, 0.6, anchor=MSO_ANCHOR.MIDDLE)
        p = tf.paragraphs[0]
        run(p, "★ ", 26 if big else 22, WHITE, bold=True)
        run(p, "starbem", 24 if big else 20, WHITE, bold=True, font=TITLE_FONT)

    def topbar(s, running):
        rect(s, 0, 0, 13.333, 1.0, ORANGE, grad=(ORANGE_D, ORANGE_L))
        logo(s, 0.55, 0.2)
        if running:
            tf = box(s, 6.0, 0.2, 6.8, 0.6, anchor=MSO_ANCHOR.MIDDLE)
            p = tf.paragraphs[0]; p.alignment = 2
            run(p, running, 15, WHITE, bold=True, font=TITLE_FONT)

    def title(s, t, size=30, top=1.35):
        run(box(s, 0.6, top, 12.1, 1.1).paragraphs[0], t, size, INK, bold=True, font=TITLE_FONT)

    def bullets(tf, items, size, base=INK):
        started = False
        for it in items:
            p = tf.paragraphs[0] if not started else tf.add_paragraph()
            started = True
            run(p, "▪  ", size, ORANGE, bold=True)
            rich(p, it, size, base)
            p.space_after = Pt(6); p.line_spacing = 1.05

    def bar(s, text, l, t, w):
        rect(s, l, t, w, 0.5, ORANGE, rounded=True)
        tf = box(s, l + 0.25, t, w - 0.5, 0.5, anchor=MSO_ANCHOR.MIDDLE)
        run(tf.paragraphs[0], text, 14, WHITE, bold=True, font=TITLE_FONT)

    def footer(s, n):
        pp = box(s, 11.8, 7.02, 1.1, 0.4).paragraphs[0]; pp.alignment = 2
        run(pp, f"{n} / {len(DATA)}", 9, MUTED)

    n = 0
    for spec in DATA:
        n += 1; t = spec["type"]
        if t == "cover":
            s = new()
            rect(s, 0, 0, 13.333, 7.5, ORANGE, grad=(ORANGE_D, ORANGE_L))
            logo(s, 0.7, 0.6, big=True)
            p = box(s, 0.75, 2.5, 9.5, 2.2).paragraphs[0]
            run(p, "Áreas de Atuação\n& Impacto", 48, WHITE, bold=True, font=TITLE_FONT)
            pp = box(s, 0.78, 4.9, 8.6, 1.3); q = pp.paragraphs[0]
            run(q, "Uma visão consolidada e detalhada de todas as frentes que conduzo hoje na "
                   "companhia — do produto à infraestrutura, passando por dados, suporte, times "
                   "e Customer Success.", 16, WHITE)
            q.line_spacing = 1.3
            run(box(s, 0.78, 6.3, 11, 0.6).paragraphs[0],
                f"{PRESENTER} · Tecnologia, Produto, Dados & CS · Junho/2026", 14, WHITE)
            continue

        s = new()
        topbar(s, spec.get("running"))

        if t == "overview":
            title(s, "Seis frentes, uma operação")
            p = box(s, 0.6, 2.15, 12.1, 0.7).paragraphs[0]
            run(p, "Cada frente equivale, no mercado, a um cargo de diretoria ou liderança — e por "
                   "trás de cada uma há um líder em desenvolvimento.", 13.5, MUTED)
            p.line_spacing = 1.2
            cw, ch, gx, gy = 3.78, 1.55, 0.28, 0.22
            for i, (tt, d) in enumerate(OVERVIEW_CARDS):
                col, row = i % 3, i // 3
                l = 0.6 + col * (cw + gx); tp = 3.1 + row * (ch + gy)
                rect(s, l, tp, cw, ch, CARD, line=LINE, rounded=True)
                rect(s, l, tp, 0.12, ch, ORANGE, rounded=True)  # accent stripe
                tf = box(s, l + 0.3, tp + 0.18, cw - 0.5, ch - 0.36)
                run(tf.paragraphs[0], tt, 15, INK, bold=True, font=TITLE_FONT)
                p2 = tf.add_paragraph(); p2.space_before = Pt(4)
                run(p2, d, 11, MUTED); p2.line_spacing = 1.12

        elif t == "section":
            title(s, spec["title"], size=40)
            p = box(s, 0.6, 2.5, 12.1, 0.7).paragraphs[0]
            run(p, "Quatro frentes de produto + liderança — uma página dedicada para cada:",
                15, MUTED)
            bar(s, "Frentes", 0.6, 3.3, 12.13)
            tf = box(s, 0.95, 3.95, 11.4, 2.6)
            bullets(tf, spec["items"], 16)

        elif t == "detail":
            title(s, spec["title"])
            cols = spec["cols"]; size = spec.get("size", 13)
            top, H = 2.65, 4.0
            no_head = all(h is None for h, _ in cols)
            if no_head and len(cols) == 2:
                rect(s, 0.6, top, 12.13, H, CARD, line=LINE, rounded=True)
                bullets(box(s, 0.95, top + 0.3, 5.6, H - 0.6), cols[0][1], size)
                bullets(box(s, 6.75, top + 0.3, 5.6, H - 0.6), cols[1][1], size)
            elif spec.get("wide") or len(cols) == 1:
                bar(s, cols[0][0] or "Detalhamento", 0.6, top, 12.13)
                rect(s, 0.6, top + 0.55, 12.13, H - 0.55, CARD, line=LINE, rounded=True)
                bullets(box(s, 0.95, top + 0.8, 11.4, H - 1.05), cols[0][1], max(size, 15))
            else:
                for idx, (h, items) in enumerate(cols):
                    l = 0.6 + idx * 6.33
                    bar(s, h, l, top, 5.8)
                    rect(s, l, top + 0.55, 5.8, H - 0.55, CARD, line=LINE, rounded=True)
                    bullets(box(s, l + 0.35, top + 0.8, 5.1, H - 1.05), items, size)

        elif t == "times":
            title(s, "Construí os times que sustentam a operação")
            tf = box(s, 0.6, 2.05, 12.1, 1.0); p = tf.paragraphs[0]
            run(p, "15+ pessoas", 17, ORANGE, bold=True, font=TITLE_FONT)
            run(p, " contratadas e formadas em Tecnologia, Produto, Dados e Suporte. Por trás de "
                   "cada área, um líder que estou desenvolvendo.", 16, INK)
            p.line_spacing = 1.25
            cw, ch = 1.34, 0.55
            for i, nm in enumerate(names):
                col, row = i % 7, i // 7
                l = 0.6 + col * (cw + 0.16); tp = 3.35 + row * (ch + 0.18)
                rect(s, l, tp, cw, ch, CARD, line=LINE, rounded=True)
                tc = box(s, l, tp, cw, ch, anchor=MSO_ANCHOR.MIDDLE)
                tc.paragraphs[0].alignment = 1
                run(tc.paragraphs[0], nm, 13, INK, bold=True)
            p = box(s, 0.6, 5.0, 12.1, 1.0).paragraphs[0]
            run(p, "Resultado: um salto na ", 16, INK)
            run(p, "qualidade percebida", 16, ORANGE, bold=True)
            run(p, " do time — consistência e confiabilidade que hoje são referência interna.", 16, INK)
            p.line_spacing = 1.25

        elif t == "metrics":
            title(s, "Três entregas que mudaram o patamar")
            cw, ch = 3.78, 2.6
            for i, (big, lbl) in enumerate(METRICS):
                l = 0.6 + i * (cw + 0.28)
                rect(s, l, 2.6, cw, ch, CARD, line=LINE, rounded=True)
                rect(s, l, 2.6, cw, 0.12, ORANGE, rounded=True)
                tf = box(s, l + 0.3, 2.95, cw - 0.6, ch - 0.5)
                run(tf.paragraphs[0], big, 28, ORANGE, bold=True, font=TITLE_FONT)
                p2 = tf.add_paragraph(); p2.space_before = Pt(10)
                run(p2, lbl, 13, MUTED); p2.line_spacing = 1.2
            p = box(s, 0.6, 5.6, 12.1, 1.0).paragraphs[0]
            run(p, "Além de receita habilitada em parcerias, risco mitigado em segurança e a base "
                   "de dados pronta para decisões preditivas.", 14, MUTED); p.line_spacing = 1.2

        elif t == "closing":
            title(s, "Uma visão consolidada — pronta para discutir")
            tf = box(s, 0.6, 2.2, 12.1, 1.8); p = tf.paragraphs[0]
            run(p, "Seis áreas de atuação detalhadas, 15+ pessoas formadas, um produto de IA em "
                   "crescimento acelerado e uma operação mais barata e mais confiável. Trouxe esse "
                   "panorama para darmos visibilidade ao todo e ", 17, INK)
            run(p, "discutirmos juntos os próximos passos de cada frente.", 17, ORANGE, bold=True)
            p.line_spacing = 1.3
            x, y = 0.6, 4.5; cur = x
            for c in CLOSING_CHIPS:
                w = 0.36 + len(c) * 0.108
                if cur + w > 12.6:
                    cur = x; y += 0.7
                rect(s, cur, y, w, 0.55, CARD, line=LINE, rounded=True)
                tc = box(s, cur, y, w, 0.55, anchor=MSO_ANCHOR.MIDDLE)
                tc.paragraphs[0].alignment = 1
                run(tc.paragraphs[0], c, 12.5, INK, bold=True)
                cur += w + 0.2

        footer(s, n)

    prs.save("docs/conversa-ceo/apresentacao.pptx")
    print("OK -> apresentacao.pptx", len(DATA), "slides")


# ----------------------------------------------------------------------------
# RENDERIZADOR HTML
# ----------------------------------------------------------------------------
def md(t):
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)


def build_html():
    def ul(items):
        return "<ul>" + "".join(f"<li>{md(i)}</li>" for i in items) + "</ul>"

    def topbar(running):
        r = f'<div class="run">{running}</div>' if running else ""
        return f'<div class="topbar"><div class="logo">★ <span>starbem</span></div>{r}</div>'

    def cols_html(cols, wide):
        no_head = all(h is None for h, _ in cols)
        if no_head and len(cols) == 2:
            return (f'<div class="card"><div class="cols">'
                    f'<div class="group">{ul(cols[0][1])}</div>'
                    f'<div class="group">{ul(cols[1][1])}</div></div></div>')
        if wide or len(cols) == 1:
            h, items = cols[0]
            bar = f'<div class="bar">{h}</div>' if h else ""
            return f'{bar}<div class="card">{ul(items)}</div>'
        out = ""
        for h, items in cols:
            out += f'<div class="colblock"><div class="bar">{h}</div><div class="card">{ul(items)}</div></div>'
        return f'<div class="cols2">{out}</div>'

    slides = []
    for spec in DATA:
        t = spec["type"]; run = spec.get("running", "")
        if t == "cover":
            slides.append(f'''<section class="slide active cover">
<div class="logo big">★ <span>starbem</span></div>
<h1>Áreas de Atuação<br>& Impacto</h1>
<div class="sub">Uma visão consolidada e detalhada de todas as frentes que conduzo hoje na companhia — do produto à infraestrutura, passando por dados, suporte, times e Customer Success.</div>
<div class="who">{PRESENTER} · Tecnologia, Produto, Dados &amp; CS · Junho/2026</div></section>''')
        elif t == "overview":
            cc = "".join(f'<div class="area-card"><div class="t">{a}</div><div class="d">{d}</div></div>' for a, d in OVERVIEW_CARDS)
            slides.append(f'''<section class="slide">{topbar(run)}<div class="body">
<h2>Seis frentes, uma operação</h2>
<div class="sub">Cada frente equivale, no mercado, a um cargo de diretoria ou liderança — e por trás de cada uma há um líder em desenvolvimento.</div>
<div class="grid-areas">{cc}</div></div></section>''')
        elif t == "section":
            slides.append(f'''<section class="slide">{topbar(run)}<div class="body">
<h2 class="xl">{spec["title"]}</h2>
<div class="sub">Quatro frentes de produto + liderança — uma página dedicada para cada:</div>
<div class="bar">Frentes</div><div class="card">{ul(spec["items"])}</div></div></section>''')
        elif t == "detail":
            slides.append(f'''<section class="slide">{topbar(run)}<div class="body">
<h2>{spec["title"]}</h2>{cols_html(spec["cols"], spec.get("wide"))}</div></section>''')
        elif t == "times":
            chips = "".join(f'<span class="chip"><b>{n}</b></span>' for n in names)
            slides.append(f'''<section class="slide">{topbar(run)}<div class="body">
<h2>Construí os times que sustentam a operação</h2>
<div class="sub"><span class="lead">15+ pessoas</span> contratadas e formadas em Tecnologia, Produto, Dados e Suporte. Por trás de cada área, um líder que estou desenvolvendo.</div>
<div class="chips">{chips}</div>
<div class="sub" style="margin-top:1.2rem">Resultado: um salto na <b>qualidade percebida</b> do time — consistência e confiabilidade que hoje são referência interna.</div></div></section>''')
        elif t == "metrics":
            mc = "".join(f'<div class="metric"><div class="big">{b}</div><div class="lbl">{l}</div></div>' for b, l in METRICS)
            slides.append(f'''<section class="slide">{topbar(run)}<div class="body">
<h2>Três entregas que mudaram o patamar</h2><div class="metrics">{mc}</div>
<div class="sub" style="margin-top:1.4rem">Além de receita habilitada em parcerias, risco mitigado em segurança e a base de dados pronta para decisões preditivas.</div></div></section>''')
        elif t == "closing":
            cc = "".join(f'<span class="chip">{c}</span>' for c in CLOSING_CHIPS)
            slides.append(f'''<section class="slide">{topbar(run)}<div class="body">
<h2>Uma visão consolidada — pronta para discutir</h2>
<div class="sub">Seis áreas de atuação detalhadas, 15+ pessoas formadas, um produto de IA em crescimento acelerado e uma operação mais barata e mais confiável. Trouxe esse panorama para darmos visibilidade ao todo e <b>discutirmos juntos os próximos passos de cada frente</b>.</div>
<div class="chips closing">{cc}</div></div></section>''')

    html = HTML_TMPL.replace("__SLIDES__", "\n".join(slides))
    with open("docs/conversa-ceo/apresentacao.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("OK -> apresentacao.html")


HTML_TMPL = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Áreas de Atuação & Impacto — Starbem</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--orange-d:#EE4E1B;--orange-l:#FF8A1E;--orange:#F26522;--ink:#2B2B2B;--muted:#6B7280;--card:#F5F6F8;--line:#E2E5EA;--title:'Funnel Display',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{font-family:Calibri,'Segoe UI',Roboto,Arial,sans-serif;background:#fff;color:var(--ink);overflow:hidden}
.deck{height:100vh;width:100vw;position:relative}
.slide{position:absolute;inset:0;display:none;flex-direction:column;background:#fff;animation:fade .4s ease}
.slide.active{display:flex}@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.topbar{height:13vh;min-height:74px;background:linear-gradient(90deg,var(--orange-d),var(--orange-l));display:flex;align-items:center;justify-content:space-between;padding:0 4vw;flex:0 0 auto}
.logo{font-family:var(--title);font-weight:800;color:#fff;font-size:1.7rem;letter-spacing:.02em}
.logo span{font-weight:800}.logo.big{font-size:2.2rem}
.run{font-family:var(--title);color:#fff;font-weight:700;font-size:1.05rem;opacity:.95}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;padding:3.5vh 4vw}
h1{font-family:var(--title);font-size:3.8rem;line-height:1.05;font-weight:800;color:#fff}
h2{font-family:var(--title);font-size:2.2rem;line-height:1.1;font-weight:800;color:var(--ink);margin-bottom:1.1rem}
h2.xl{font-size:3rem}
.sub{color:var(--muted);font-size:1.15rem;margin-top:.4rem;max-width:70ch;line-height:1.5}
ul{list-style:none;display:flex;flex-direction:column;gap:.5rem}
li{position:relative;padding-left:1.5rem;font-size:1.05rem;line-height:1.4;color:var(--ink)}
li::before{content:"";position:absolute;left:0;top:.5em;width:.5rem;height:.5rem;background:var(--orange)}
li b{font-weight:700}
.bar{background:var(--orange);color:#fff;font-family:var(--title);font-weight:700;font-size:1rem;padding:.5rem 1rem;border-radius:8px 8px 0 0;display:inline-block;width:100%}
.card{background:var(--card);border:1px solid var(--line);border-radius:0 0 12px 12px;padding:1.3rem 1.4rem}
.bar + .card{border-top:none}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem 2.5rem}
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:1.6rem}
.colblock{display:flex;flex-direction:column}
.card:not(.bar + .card){border-radius:12px}
.chips{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.2rem}
.chip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:.45rem 1rem;font-size:.95rem;font-weight:700}
.chip b{color:var(--orange)}.chips.closing .chip{font-weight:600}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;margin-top:1.4rem}
.metric{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--orange);border-radius:12px;padding:1.3rem 1.3rem}
.metric .big{font-family:var(--title);font-size:2.2rem;font-weight:800;color:var(--orange);line-height:1}
.metric .lbl{color:var(--muted);font-size:.98rem;margin-top:.6rem;line-height:1.35}
.grid-areas{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem;margin-top:1.3rem}
.area-card{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--orange);border-radius:10px;padding:1.1rem 1.1rem}
.area-card .t{font-family:var(--title);font-weight:700;font-size:1.1rem}.area-card .d{color:var(--muted);font-size:.92rem;margin-top:.3rem;line-height:1.35}
.cover{justify-content:center;background:linear-gradient(120deg,var(--orange-d),var(--orange-l));padding:0 6vw}
.cover .logo.big{margin-bottom:1.4rem}.cover h1{margin-bottom:.3rem}
.cover .sub{color:#fff;opacity:.95;max-width:60ch}.cover .who{color:#fff;opacity:.9;font-size:1.2rem;margin-top:1.6rem}
.lead{color:var(--orange);font-weight:700}
.progress{position:fixed;left:0;top:0;height:3px;background:var(--orange);width:0;transition:width .3s;z-index:50}
.nav{position:fixed;right:18px;bottom:14px;display:flex;gap:8px;z-index:50}
.nav button{background:#fff;border:1px solid var(--line);color:var(--ink);width:38px;height:38px;border-radius:10px;font-size:1.1rem;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.08)}
.nav button:hover{border-color:var(--orange)}
.hint{position:fixed;left:18px;bottom:16px;color:var(--muted);font-size:.76rem;z-index:50}
.pg{position:absolute;right:4vw;bottom:2vh;color:var(--muted);font-size:.8rem}
@media print{@page{size:1280px 720px;margin:0}html,body{height:auto;overflow:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.deck{height:auto}.slide{display:flex!important;position:relative;inset:auto;height:720px;width:1280px;page-break-after:always;animation:none}
.nav,.hint,.progress{display:none!important}}
</style></head><body>
<div class="progress" id="bar"></div><div class="deck" id="deck">
__SLIDES__
</div>
<div class="nav"><button onclick="go(-1)">‹</button><button onclick="go(1)">›</button></div>
<div class="hint">← → para navegar · F para tela cheia · Ctrl/Cmd+P para exportar PDF</div>
<script>
const slides=[...document.querySelectorAll('.slide')];let i=0;
slides.forEach((s,k)=>{if(!s.classList.contains('cover')){const d=document.createElement('div');d.className='pg';d.textContent=(k+1)+' / '+slides.length;s.appendChild(d);}});
function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,k)=>s.classList.toggle('active',k===i));document.getElementById('bar').style.width=(i/(slides.length-1)*100)+'%'}
function go(d){show(i+d)}
document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){go(1);e.preventDefault()}if(['ArrowLeft','PageUp'].includes(e.key)){go(-1);e.preventDefault()}if(e.key==='Home')show(0);if(e.key==='End')show(slides.length-1);if(e.key.toLowerCase()==='f'){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen()}});
document.getElementById('deck').addEventListener('click',e=>{if(!e.target.closest('.nav'))go(1)});show(0);
</script></body></html>"""


if __name__ == "__main__":
    build_pptx()
    build_html()
