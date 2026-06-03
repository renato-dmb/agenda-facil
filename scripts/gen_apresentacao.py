#!/usr/bin/env python3
"""Gera a apresentação das áreas de atuação (Starbem) em .pptx e .html.

Todo o detalhamento das frentes é preservado — nenhuma linha de ação é removida.
Uma página dedicada para cada frente de Produto e para cada área.
"""
import re
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR

# ----------------------------------------------------------------------------
# CONTEÚDO (verbatim do detalhamento enviado, apenas com pequena limpeza formal)
# ----------------------------------------------------------------------------
PRESENTER = "Renato"

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


# Estrutura de slides (data-driven) ------------------------------------------
DATA = [
    {"type": "cover"},
    {"type": "overview"},
    {"type": "detail", "kicker": "Área 1 · Customer Success", "title": "Customer Success",
     "cols": [("Diretoria — Operação", cs_oper), ("Liderança", cs_lid)]},
    {"type": "section", "kicker": "Área 2 · Produto · 5 OKRs",
     "title": "Produto", "items": [
         "Frente **Paciente** — jornada B2C", "Frente **Profissional**",
         "Frente **RH** (NR1)", "Frente **Parcerias**", "**Liderança** de Produto"]},
    {"type": "detail", "kicker": "Área 2 · Produto · Frente Paciente",
     "title": "Paciente — Jornada B2C",
     "cols": [(None, split(prod_paciente)[0]), (None, split(prod_paciente)[1])]},
    {"type": "detail", "kicker": "Área 2 · Produto · Frente Profissional",
     "title": "Profissional",
     "cols": [(None, split(prod_profissional)[0]), (None, split(prod_profissional)[1])]},
    {"type": "detail", "kicker": "Área 2 · Produto · Frente RH",
     "title": "RH — NR1 & Portal RH",
     "cols": [(None, split(prod_rh)[0]), (None, split(prod_rh)[1])]},
    {"type": "detail", "kicker": "Área 2 · Produto · Frente Parcerias",
     "title": "Parcerias",
     "cols": [(None, split(prod_parcerias)[0]), (None, split(prod_parcerias)[1])]},
    {"type": "detail", "kicker": "Área 2 · Produto · Liderança",
     "title": "Liderança de Produto", "cols": [("Liderança", prod_lid)], "wide": True},
    {"type": "detail", "kicker": "Área 3 · Engenharia", "title": "Engenharia",
     "cols": [("Diretoria", eng_dir), ("Liderança", eng_lid)]},
    {"type": "detail", "kicker": "Área 4 · Dados", "title": "Dados",
     "cols": [("Diretoria", dados_dir), ("Liderança", dados_lid)]},
    {"type": "detail", "kicker": "Área 5 · IT & Suporte", "title": "IT & Suporte",
     "cols": [("IT & Suporte", it_items)], "wide": True},
    {"type": "detail", "kicker": "Área 6 · Principal Engineer", "title": "Principal Engineer",
     "cols": [(None, split(pe_items)[0]), (None, split(pe_items)[1])]},
    {"type": "detail", "kicker": "Camada transversal", "title": "Estratégia Starbem",
     "cols": [("Estratégia", estrategia)], "wide": True},
    {"type": "times"},
    {"type": "metrics"},
    {"type": "detail", "kicker": "Para onde vai", "title": "Estratégia de produto com IA — próximos 12 meses",
     "cols": [(None, futuro)], "wide": True, "size": 16},
    {"type": "closing"},
]

# ----------------------------------------------------------------------------
# RENDERIZADOR PPTX
# ----------------------------------------------------------------------------
BG = RGBColor(0x0B, 0x10, 0x20); CARD = RGBColor(0x18, 0x22, 0x3A)
INK = RGBColor(0xEA, 0xF0, 0xFB); MUTED = RGBColor(0x9A, 0xA7, 0xBD)
ACCENT = RGBColor(0x2D, 0xD4, 0xBF); GOLD = RGBColor(0xF4, 0xB7, 0x40)
LINE = RGBColor(0x2A, 0x36, 0x52); FONT = "Segoe UI"


def build_pptx():
    prs = Presentation()
    prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
    BLANK = prs.slide_layouts[6]

    def new():
        s = prs.slides.add_slide(BLANK)
        s.background.fill.solid(); s.background.fill.fore_color.rgb = BG
        return s

    def box(s, l, t, w, h, anchor=None):
        tf = s.shapes.add_textbox(Inches(l), Inches(t), Inches(w), Inches(h)).text_frame
        tf.word_wrap = True
        if anchor:
            tf.vertical_anchor = anchor
        return tf

    def run(p, text, size, color, bold=False):
        r = p.add_run(); r.text = text
        f = r.font; f.size = Pt(size); f.bold = bold; f.color.rgb = color; f.name = FONT
        return r

    def rich(p, text, size, base=MUTED):
        for i, seg in enumerate(text.split("**")):
            if seg:
                run(p, seg, size, INK if i % 2 else base, bold=bool(i % 2))

    def kicker(s, t):
        run(box(s, 0.9, 0.55, 11.5, 0.5).paragraphs[0], t.upper(), 12.5, ACCENT, bold=True)

    def title(s, t, size=30):
        run(box(s, 0.9, 1.0, 11.5, 1.4).paragraphs[0], t, size, INK, bold=True)

    def card(s, l, t, w, h):
        sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(l), Inches(t), Inches(w), Inches(h))
        sh.fill.solid(); sh.fill.fore_color.rgb = CARD
        sh.line.color.rgb = LINE; sh.line.width = Pt(1); sh.shadow.inherit = False
        try:
            sh.adjustments[0] = 0.06
        except Exception:
            pass
        return sh

    def column(s, groups, l, t, w, h, size=14):
        tf = box(s, l, t, w, h); started = False
        for header, items in groups:
            if header is not None:
                p = tf.paragraphs[0] if not started else tf.add_paragraph()
                if started:
                    p.space_before = Pt(12)
                run(p, header.upper(), 12.5, GOLD, bold=True); p.space_after = Pt(6)
                started = True
            for it in items:
                p = tf.paragraphs[0] if not started else tf.add_paragraph()
                started = True
                run(p, "▪  ", size, ACCENT, bold=True)
                rich(p, it, size)
                p.space_after = Pt(6); p.line_spacing = 1.08

    def footer(s, n):
        run(box(s, 0.9, 7.0, 9, 0.4).paragraphs[0], "Starbem · Áreas de Atuação & Impacto", 9, MUTED)
        pp = box(s, 12.0, 7.0, 0.9, 0.4).paragraphs[0]; pp.alignment = 2
        run(pp, str(n), 9, MUTED)

    n = 0
    for spec in DATA:
        s = new(); t = spec["type"]; n += 1
        if t == "cover":
            run(box(s, 0.9, 2.0, 11.5, 0.5).paragraphs[0], "★ STARBEM", 14, ACCENT, bold=True)
            run(box(s, 0.9, 2.5, 11.5, 1.8).paragraphs[0], "Áreas de Atuação & Impacto", 46, INK, bold=True)
            p = box(s, 0.9, 4.2, 9.5, 1.4).paragraphs[0]
            run(p, "Uma visão consolidada e detalhada de todas as frentes que conduzo hoje na "
                   "companhia — do produto à infraestrutura, passando por dados, CS, suporte e times.", 17, MUTED)
            p.line_spacing = 1.3
            run(box(s, 0.9, 5.9, 11.5, 0.6).paragraphs[0],
                f"{PRESENTER} · Tecnologia, Produto, Dados & CS · Junho/2026", 15, MUTED)
        elif t == "overview":
            kicker(s, "Onde eu atuo hoje"); title(s, "Seis frentes, uma operação")
            p = box(s, 0.9, 1.9, 11.5, 0.9).paragraphs[0]
            run(p, "Cada frente equivale, no mercado, a um cargo de diretoria ou liderança — e por "
                   "trás de cada uma há um líder em desenvolvimento.", 14, MUTED); p.line_spacing = 1.2
            areas = [("Customer Success", "Estrutura, implantação e ciclo de vida do cliente."),
                     ("Produto · 5 OKRs", "Paciente, Profissional, RH (NR1) e Parcerias."),
                     ("Engenharia", "Plataforma, segurança, IA e novos modelos de operação."),
                     ("Dados", "Datalake e inteligência preditiva/prescritiva."),
                     ("IT & Suporte", "Tickets, integração com CS/Produto e custos."),
                     ("Principal Engineer", "Arquitetura, nuvem e fornecedores estratégicos.")]
            cw, ch, gx, gy = 3.65, 1.75, 0.29, 0.25
            for i, (tt, d) in enumerate(areas):
                col, row = i % 3, i // 3
                l = 0.9 + col * (cw + gx); tp = 3.05 + row * (ch + gy)
                card(s, l, tp, cw, ch)
                tf = box(s, l + 0.25, tp + 0.2, cw - 0.5, ch - 0.4)
                run(tf.paragraphs[0], tt, 15, INK, bold=True)
                p2 = tf.add_paragraph(); p2.space_before = Pt(4); run(p2, d, 11, MUTED); p2.line_spacing = 1.12
            footer(s, n)
        elif t == "section":
            kicker(s, spec["kicker"]); title(s, spec["title"], size=40)
            p = box(s, 0.9, 2.1, 11.5, 0.7).paragraphs[0]
            run(p, "Quatro frentes de produto + liderança — uma página dedicada para cada:", 16, MUTED)
            column(s, [(None, spec["items"])], 0.9, 3.0, 11.5, 3.5, size=17)
            footer(s, n)
        elif t == "detail":
            kicker(s, spec["kicker"]); title(s, spec["title"])
            cols = spec["cols"]; size = spec.get("size", 14)
            if spec.get("wide") or len(cols) == 1:
                column(s, cols, 0.9, 2.4, 11.6, 4.3, size=max(size, 15))
            else:
                column(s, [cols[0]], 0.9, 2.4, 5.6, 4.3, size=size)
                column(s, [cols[1]], 6.9, 2.4, 5.6, 4.3, size=size)
            footer(s, n)
        elif t == "times":
            kicker(s, "O que conecta todas as áreas")
            title(s, "Construí os times que sustentam a operação")
            tf = box(s, 0.9, 2.05, 11.3, 1.0); p = tf.paragraphs[0]
            run(p, "15+ pessoas", 17, ACCENT, bold=True)
            run(p, " contratadas e formadas em Tecnologia, Produto, Dados e Suporte. Por trás de "
                   "cada área, um líder que estou desenvolvendo.", 16, MUTED); p.line_spacing = 1.25
            cw, ch = 1.32, 0.55
            for i, nm in enumerate(names):
                col, row = i % 7, i // 7
                l = 0.9 + col * (cw + 0.16); tp = 3.45 + row * (ch + 0.18)
                card(s, l, tp, cw, ch)
                tc = box(s, l, tp, cw, ch, anchor=MSO_ANCHOR.MIDDLE)
                tc.paragraphs[0].alignment = 1; run(tc.paragraphs[0], nm, 13, INK, bold=True)
            p = box(s, 0.9, 5.1, 11.3, 1.0).paragraphs[0]
            run(p, "Resultado: um salto na ", 16, MUTED)
            run(p, "qualidade percebida", 16, INK, bold=True)
            run(p, " do time — consistência e confiabilidade que hoje são referência interna.", 16, MUTED)
            p.line_spacing = 1.25; footer(s, n)
        elif t == "metrics":
            kicker(s, "Destaques do período"); title(s, "Três entregas que mudaram o patamar")
            metrics = [("R$30k → 100k", "MRR do novo produto 100% IA, puxado por iFood e TotalPass México"),
                       ("15+", "pessoas contratadas e formadas, com líderes em desenvolvimento"),
                       ("~R$800k", "de custo de nuvem evitado até dez/2026 (Azure → AWS + créditos)")]
            cw, ch = 3.65, 2.7
            for i, (big, lbl) in enumerate(metrics):
                l = 0.9 + i * (cw + 0.29); card(s, l, 2.6, cw, ch)
                tf = box(s, l + 0.3, 2.95, cw - 0.6, ch - 0.6)
                run(tf.paragraphs[0], big, 29, ACCENT, bold=True)
                p2 = tf.add_paragraph(); p2.space_before = Pt(10)
                run(p2, lbl, 13.5, MUTED); p2.line_spacing = 1.2
            p = box(s, 0.9, 5.7, 11.5, 1.0).paragraphs[0]
            run(p, "Além de receita habilitada em parcerias, risco mitigado em segurança e a base "
                   "de dados pronta para decisões preditivas.", 14, MUTED); p.line_spacing = 1.2
            footer(s, n)
        elif t == "closing":
            kicker(s, "Em resumo"); title(s, "Uma visão consolidada — pronta para discutir")
            tf = box(s, 0.9, 2.2, 11.3, 1.8); p = tf.paragraphs[0]
            run(p, "Seis áreas de atuação detalhadas, 15+ pessoas formadas, um produto de IA em "
                   "crescimento acelerado e uma operação mais barata e mais confiável. Trouxe esse "
                   "panorama para darmos visibilidade ao todo e ", 17, MUTED)
            run(p, "discutirmos juntos os próximos passos de cada frente.", 17, INK, bold=True)
            p.line_spacing = 1.3
            chips = ["Customer Success", "Produto", "Engenharia", "Dados", "IT & Suporte",
                     "Arquitetura & Nuvem", "Times & Liderança"]
            x, y = 0.9, 4.6; cur = x
            for c in chips:
                w = 0.32 + len(c) * 0.105
                if cur + w > 12.4:
                    cur = x; y += 0.7
                card(s, cur, y, w, 0.55)
                tc = box(s, cur, y, w, 0.55, anchor=MSO_ANCHOR.MIDDLE)
                tc.paragraphs[0].alignment = 1; run(tc.paragraphs[0], c, 12.5, INK)
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

    def cols_html(cols, wide):
        if wide or len(cols) == 1:
            h, items = cols[0]
            head = f'<h3>{h}</h3>' if h else ""
            return f'<div class="group wide">{head}{ul(items)}</div>'
        out = ""
        for h, items in cols:
            head = f'<h3>{h}</h3>' if h else ""
            out += f'<div class="group">{head}{ul(items)}</div>'
        return f'<div class="cols">{out}</div>'

    slides = []
    for spec in DATA:
        t = spec["type"]
        if t == "cover":
            slides.append(f'''<section class="slide active cover">
<div class="cover-brand">★ Starbem</div>
<h1>Áreas de Atuação<br>& Impacto</h1>
<div class="sub">Uma visão consolidada e detalhada de todas as frentes que conduzo hoje na companhia — do produto à infraestrutura, passando por dados, CS, suporte e times.</div>
<div class="who">{PRESENTER} · Tecnologia, Produto, Dados &amp; CS · Junho/2026</div></section>''')
        elif t == "overview":
            cards = [("Customer Success", "Estrutura, implantação e ciclo de vida do cliente."),
                     ("Produto · 5 OKRs", "Paciente, Profissional, RH (NR1) e Parcerias."),
                     ("Engenharia", "Plataforma, segurança, IA e novos modelos de operação."),
                     ("Dados", "Datalake e inteligência preditiva/prescritiva."),
                     ("IT & Suporte", "Tickets, integração com CS/Produto e custos."),
                     ("Principal Engineer", "Arquitetura, nuvem e fornecedores estratégicos.")]
            cc = "".join(f'<div class="area-card"><div class="t">{a}</div><div class="d">{d}</div></div>' for a, d in cards)
            slides.append(f'''<section class="slide"><span class="kicker">Onde eu atuo hoje</span>
<h2>Seis frentes, uma operação</h2>
<div class="sub">Cada frente equivale, no mercado, a um cargo de diretoria ou liderança — e por trás de cada uma há um líder em desenvolvimento.</div>
<div class="grid-areas">{cc}</div></section>''')
        elif t == "section":
            slides.append(f'''<section class="slide"><span class="kicker">{spec["kicker"]}</span>
<h2 style="font-size:3rem">{spec["title"]}</h2>
<div class="sub">Quatro frentes de produto + liderança — uma página dedicada para cada:</div>
<div class="group wide" style="margin-top:1rem">{ul(spec["items"])}</div></section>''')
        elif t == "detail":
            slides.append(f'''<section class="slide"><span class="kicker">{spec["kicker"]}</span>
<h2>{spec["title"]}</h2>{cols_html(spec["cols"], spec.get("wide"))}</section>''')
        elif t == "times":
            chips = "".join(f'<span class="chip"><b>{n}</b></span>' for n in names)
            slides.append(f'''<section class="slide"><span class="kicker">O que conecta todas as áreas</span>
<h2>Construí os times que sustentam a operação</h2>
<div class="sub"><span class="lead">15+ pessoas</span> contratadas e formadas em Tecnologia, Produto, Dados e Suporte. Por trás de cada área, um líder que estou desenvolvendo.</div>
<div class="chips">{chips}</div>
<div class="sub" style="margin-top:1.4rem">Resultado: um salto na <b>qualidade percebida</b> do time — consistência e confiabilidade que hoje são referência interna.</div></section>''')
        elif t == "metrics":
            ms = [("R$30k→100k", "MRR do novo produto <b>100% IA</b>, puxado por iFood e TotalPass México"),
                  ("15+", "pessoas contratadas e formadas, com líderes em desenvolvimento"),
                  ("~R$800k", "de custo de nuvem evitado até dez/2026 (Azure → AWS + créditos)")]
            mc = "".join(f'<div class="metric"><div class="big">{b}</div><div class="lbl">{l}</div></div>' for b, l in ms)
            slides.append(f'''<section class="slide"><span class="kicker">Destaques do período</span>
<h2>Três entregas que mudaram o patamar</h2><div class="metrics">{mc}</div>
<div class="sub" style="margin-top:1.6rem">Além de receita habilitada em parcerias, risco mitigado em segurança e a base de dados pronta para decisões preditivas.</div></section>''')
        elif t == "closing":
            chips = ["Customer Success", "Produto", "Engenharia", "Dados", "IT & Suporte", "Arquitetura & Nuvem", "Times & Liderança"]
            cc = "".join(f'<span class="chip">{c}</span>' for c in chips)
            slides.append(f'''<section class="slide"><span class="kicker">Em resumo</span>
<h2>Uma visão consolidada — pronta para discutir</h2>
<div class="sub">Seis áreas de atuação detalhadas, 15+ pessoas formadas, um produto de IA em crescimento acelerado e uma operação mais barata e mais confiável. Trouxe esse panorama para darmos visibilidade ao todo e <b>discutirmos juntos os próximos passos de cada frente</b>.</div>
<div class="chips" style="margin-top:1.8rem">{cc}</div></section>''')

    html = HTML_TMPL.replace("__SLIDES__", "\n".join(slides))
    with open("docs/conversa-ceo/apresentacao.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("OK -> apresentacao.html")


HTML_TMPL = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Áreas de Atuação & Impacto — Starbem</title><style>
:root{--bg:#0B1020;--ink:#EAF0FB;--muted:#9AA7BD;--accent:#2DD4BF;--accent2:#F4B740;--line:rgba(255,255,255,.08);--card:rgba(255,255,255,.04)}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(1200px 700px at 80% -10%,#1b2742 0%,var(--bg) 55%) fixed;color:var(--ink);overflow:hidden}
.deck{height:100vh;width:100vw;position:relative}
.slide{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;padding:5.5vh 8vw;animation:fade .4s ease}
.slide.active{display:flex}@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.kicker{display:inline-block;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:700;margin-bottom:.8rem}
h1{font-size:3.6rem;line-height:1.05;font-weight:800;letter-spacing:-.02em}
h2{font-size:2.3rem;line-height:1.1;font-weight:800;letter-spacing:-.01em;margin-bottom:1.2rem}
.sub{color:var(--muted);font-size:1.2rem;margin-top:1rem;max-width:64ch;line-height:1.5}
ul{list-style:none;display:flex;flex-direction:column;gap:.55rem;margin-top:.3rem}
li{position:relative;padding-left:1.5rem;font-size:1.08rem;line-height:1.4;color:var(--muted)}
li::before{content:"";position:absolute;left:0;top:.5em;width:.5rem;height:.5rem;border-radius:2px;background:var(--accent);transform:rotate(45deg)}
li b{color:#fff;font-weight:600}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem 3rem;margin-top:.3rem}
.group.wide{max-width:100%}
.group h3{font-size:1rem;color:var(--accent2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem}
.chips{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:1.4rem}
.chip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:.45rem 1rem;font-size:.92rem}
.chip b{color:var(--accent)}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1.1rem;margin-top:1.8rem}
.metric{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:1.4rem 1.3rem}
.metric .big{font-size:2.3rem;font-weight:800;color:var(--accent);line-height:1}
.metric .lbl{color:var(--muted);font-size:.98rem;margin-top:.6rem;line-height:1.35}
.grid-areas{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem;margin-top:1.6rem}
.area-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.2rem 1.1rem}
.area-card .t{font-weight:700;font-size:1.1rem}.area-card .d{color:var(--muted);font-size:.92rem;margin-top:.3rem;line-height:1.35}
.cover-brand{font-size:1rem;letter-spacing:.3em;text-transform:uppercase;color:var(--accent);font-weight:700}
.cover h1{margin:1rem 0 .3rem;font-size:4rem}.cover .who{color:var(--muted);font-size:1.25rem;margin-top:1.5rem}.lead{color:var(--accent2);font-weight:700}
.progress{position:fixed;left:0;top:0;height:3px;background:var(--accent);width:0;transition:width .3s;z-index:50}
.nav{position:fixed;right:18px;bottom:14px;display:flex;gap:8px;z-index:50}
.nav button{background:var(--card);border:1px solid var(--line);color:var(--ink);width:38px;height:38px;border-radius:10px;font-size:1.1rem;cursor:pointer}
.nav button:hover{border-color:var(--accent)}.hint{position:fixed;left:18px;bottom:16px;color:var(--muted);font-size:.76rem;z-index:50}
@media print{@page{size:1280px 720px;margin:0}html,body{height:auto;overflow:visible;background:var(--bg)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.deck{height:auto}.slide{display:flex!important;position:relative;inset:auto;height:720px;width:1280px;page-break-after:always;animation:none}.nav,.hint,.progress{display:none!important}}
</style></head><body>
<div class="progress" id="bar"></div><div class="deck" id="deck">
__SLIDES__
</div>
<div class="nav"><button onclick="go(-1)">‹</button><button onclick="go(1)">›</button></div>
<div class="hint">← → para navegar · F para tela cheia · Ctrl/Cmd+P para exportar PDF</div>
<script>
const slides=[...document.querySelectorAll('.slide')];let i=0;
function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach((s,k)=>s.classList.toggle('active',k===i));document.getElementById('bar').style.width=(i/(slides.length-1)*100)+'%'}
function go(d){show(i+d)}
document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){go(1);e.preventDefault()}if(['ArrowLeft','PageUp'].includes(e.key)){go(-1);e.preventDefault()}if(e.key==='Home')show(0);if(e.key==='End')show(slides.length-1);if(e.key.toLowerCase()==='f'){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen()}});
document.getElementById('deck').addEventListener('click',e=>{if(!e.target.closest('.nav'))go(1)});show(0);
</script></body></html>"""


if __name__ == "__main__":
    build_pptx()
    build_html()
