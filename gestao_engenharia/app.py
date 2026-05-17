from flask import Flask, render_template, request, redirect, url_for, jsonify, make_response
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date, timedelta
import os
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'metalurgica2024!')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///gestao.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
app.jinja_env.globals['enumerate'] = enumerate

# ── Modelos ──────────────────────────────────────────────────────────────────

STATUS_LIST = [
    'Desenho em Andamento',
    'Com Processista',
    'Revisão Desenho',
    'Revisão Processo',
    'Liberado para Fábrica',
]

COMPLEXIDADE = {'simples': '🟢', 'media': '🟡', 'complexa': '🔴'}
DESENHISTAS = ['Lucas', 'Breno', 'Gustavo', 'Wesley']
TIPO_ERRO = ['Erro de Engenharia', 'Erro de Fábrica', 'Erro de Processo', 'Pendência Vendas']

CHECKLIST_ITEMS = [
    'Todas as cotas de montagem presentes?',
    'Tolerâncias de ajuste ISO indicadas (colos, alojamentos)?',
    'Acabamento superficial indicado nas regiões críticas?',
    'Material especificado no cabeçalho?',
    'Dimensões conferidas contra amostra/medição?',
    'Chaveta, rosca, furo de centro cotados corretamente?',
    'Vista de corte suficiente?',
    'Escala correta e legível?',
]


class OS(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.String(50), unique=True, nullable=False)
    data_abertura = db.Column(db.Date, nullable=False, default=date.today)
    cliente = db.Column(db.String(150), nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    complexidade = db.Column(db.String(20), nullable=False, default='simples')
    responsavel = db.Column(db.String(50), nullable=False)
    prazo = db.Column(db.Date, nullable=False)
    observacoes = db.Column(db.Text, default='')
    status = db.Column(db.String(60), nullable=False, default=STATUS_LIST[0])
    checklist_ok = db.Column(db.Boolean, default=False)
    checklist_data = db.Column(db.Text, default='{}')
    erros = db.relationship('Erro', backref='os', lazy=True)

    @property
    def dias_restantes(self):
        return (self.prazo - date.today()).days

    @property
    def cor_prazo(self):
        d = self.dias_restantes
        if d <= 3:
            return 'vermelho'
        if d <= 7:
            return 'amarelo'
        return 'verde'

    @property
    def complexidade_emoji(self):
        return COMPLEXIDADE.get(self.complexidade, '')

    @property
    def status_index(self):
        try:
            return STATUS_LIST.index(self.status)
        except ValueError:
            return 0


class Erro(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    os_id = db.Column(db.Integer, db.ForeignKey('os.id'), nullable=False)
    tipo = db.Column(db.String(60), nullable=False)
    descricao = db.Column(db.Text, nullable=False)
    identificado_por = db.Column(db.String(100), nullable=False)
    acao_corretiva = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='Aberto')
    data = db.Column(db.Date, default=date.today)


# ── Rotas ─────────────────────────────────────────────────────────────────────

@app.route('/')
def dashboard():
    q = request.args.get('q', '')
    filtro_status = request.args.get('status', '')
    filtro_complexidade = request.args.get('complexidade', '')

    query = OS.query
    if q:
        query = query.filter(
            (OS.numero.ilike(f'%{q}%')) |
            (OS.cliente.ilike(f'%{q}%')) |
            (OS.descricao.ilike(f'%{q}%'))
        )
    if filtro_status:
        query = query.filter(OS.status == filtro_status)
    if filtro_complexidade:
        query = query.filter(OS.complexidade == filtro_complexidade)

    lista = query.order_by(OS.prazo.asc()).all()
    total = OS.query.count()
    andamento = OS.query.filter(OS.status != STATUS_LIST[-1]).count()
    atrasadas = sum(1 for o in OS.query.all() if o.dias_restantes < 0 and o.status != STATUS_LIST[-1])
    liberadas = OS.query.filter(OS.status == STATUS_LIST[-1]).count()

    return render_template('dashboard.html',
        lista=lista, total=total, andamento=andamento,
        atrasadas=atrasadas, liberadas=liberadas,
        status_list=STATUS_LIST, complexidade=COMPLEXIDADE,
        q=q, filtro_status=filtro_status, filtro_complexidade=filtro_complexidade)


@app.route('/nova-os', methods=['GET', 'POST'])
def nova_os():
    if request.method == 'POST':
        prazo_str = request.form.get('prazo')
        prazo = datetime.strptime(prazo_str, '%Y-%m-%d').date() if prazo_str else date.today() + timedelta(days=15)
        os_ = OS(
            numero=request.form['numero'],
            data_abertura=datetime.strptime(request.form['data_abertura'], '%Y-%m-%d').date(),
            cliente=request.form['cliente'],
            descricao=request.form['descricao'],
            complexidade=request.form['complexidade'],
            responsavel=request.form['responsavel'],
            prazo=prazo,
            observacoes=request.form.get('observacoes', ''),
        )
        db.session.add(os_)
        db.session.commit()
        return redirect(url_for('detalhe_os', os_id=os_.id))
    prazo_padrao = (date.today() + timedelta(days=15)).strftime('%Y-%m-%d')
    hoje = date.today().strftime('%Y-%m-%d')
    return render_template('nova_os.html', desenhistas=DESENHISTAS, prazo_padrao=prazo_padrao, hoje=hoje)


@app.route('/os/<int:os_id>')
def detalhe_os(os_id):
    os_ = OS.query.get_or_404(os_id)
    checklist = json.loads(os_.checklist_data or '{}')
    total_check = len(CHECKLIST_ITEMS)
    ok_check = sum(1 for k in checklist.values() if k)
    return render_template('detalhe_os.html',
        os=os_, checklist=checklist, checklist_items=CHECKLIST_ITEMS,
        total_check=total_check, ok_check=ok_check,
        status_list=STATUS_LIST, COMPLEXIDADE=COMPLEXIDADE)


@app.route('/os/<int:os_id>/checklist', methods=['POST'])
def salvar_checklist(os_id):
    os_ = OS.query.get_or_404(os_id)
    data = {}
    for i, item in enumerate(CHECKLIST_ITEMS):
        data[str(i)] = request.form.get(f'item_{i}') == 'on'
    os_.checklist_data = json.dumps(data)
    os_.checklist_ok = all(data.values()) and len(data) == len(CHECKLIST_ITEMS)
    db.session.commit()
    return redirect(url_for('detalhe_os', os_id=os_id))


@app.route('/os/<int:os_id>/avancar', methods=['POST'])
def avancar_status(os_id):
    os_ = OS.query.get_or_404(os_id)
    idx = os_.status_index
    if idx == 0 and not os_.checklist_ok:
        return redirect(url_for('detalhe_os', os_id=os_id) + '?erro=checklist')
    if idx < len(STATUS_LIST) - 1:
        os_.status = STATUS_LIST[idx + 1]
        db.session.commit()
    return redirect(url_for('detalhe_os', os_id=os_id))


@app.route('/os/<int:os_id>/retroceder', methods=['POST'])
def retroceder_status(os_id):
    os_ = OS.query.get_or_404(os_id)
    idx = os_.status_index
    if idx > 0:
        os_.status = STATUS_LIST[idx - 1]
        db.session.commit()
    return redirect(url_for('detalhe_os', os_id=os_id))


@app.route('/kanban')
def kanban():
    colunas = {s: OS.query.filter_by(status=s).order_by(OS.prazo.asc()).all() for s in STATUS_LIST}
    return render_template('kanban.html', colunas=colunas, status_list=STATUS_LIST)


@app.route('/os/<int:os_id>/mover', methods=['POST'])
def mover_os(os_id):
    os_ = OS.query.get_or_404(os_id)
    novo_status = request.json.get('status')
    if novo_status in STATUS_LIST:
        if STATUS_LIST.index(novo_status) > 0 and STATUS_LIST.index(os_.status) == 0 and not os_.checklist_ok:
            return jsonify({'ok': False, 'erro': 'Checklist incompleto'}), 400
        os_.status = novo_status
        db.session.commit()
    return jsonify({'ok': True})


@app.route('/erros', methods=['GET', 'POST'])
def erros():
    if request.method == 'POST':
        os_numero = request.form.get('os_numero', '').strip()
        os_ = OS.query.filter_by(numero=os_numero).first()
        erro = Erro(
            os_id=os_.id if os_ else None,
            tipo=request.form['tipo'],
            descricao=request.form['descricao'],
            identificado_por=request.form['identificado_por'],
            acao_corretiva=request.form.get('acao_corretiva', ''),
        )
        db.session.add(erro)
        db.session.commit()
        return redirect(url_for('erros'))

    filtro_tipo = request.args.get('tipo', '')
    filtro_status = request.args.get('status', '')
    query = Erro.query
    if filtro_tipo:
        query = query.filter(Erro.tipo == filtro_tipo)
    if filtro_status:
        query = query.filter(Erro.status == filtro_status)
    lista = query.order_by(Erro.data.desc()).all()
    todos_os = OS.query.order_by(OS.numero).all()
    return render_template('erros.html', lista=lista, tipos=TIPO_ERRO,
                           todos_os=todos_os, filtro_tipo=filtro_tipo, filtro_status=filtro_status)


@app.route('/erros/<int:erro_id>/resolver', methods=['POST'])
def resolver_erro(erro_id):
    erro = Erro.query.get_or_404(erro_id)
    erro.status = 'Resolvido'
    erro.acao_corretiva = request.form.get('acao_corretiva', erro.acao_corretiva)
    db.session.commit()
    return redirect(url_for('erros'))


@app.route('/produtividade')
def produtividade():
    mes = request.args.get('mes', date.today().strftime('%Y-%m'))
    ano, m = int(mes.split('-')[0]), int(mes.split('-')[1])
    inicio = date(ano, m, 1)
    fim = date(ano, m + 1, 1) if m < 12 else date(ano + 1, 1, 1)

    dados = []
    for nome in DESENHISTAS:
        concluidas_mes = OS.query.filter(
            OS.responsavel == nome,
            OS.status == STATUS_LIST[-1],
            OS.prazo >= inicio, OS.prazo < fim
        ).count()
        em_andamento = OS.query.filter(
            OS.responsavel == nome,
            OS.status != STATUS_LIST[-1]
        ).count()
        erros_count = Erro.query.join(OS).filter(OS.responsavel == nome).count()
        no_prazo = OS.query.filter(
            OS.responsavel == nome,
            OS.status == STATUS_LIST[-1],
        ).all()
        cumpridas = sum(1 for o in no_prazo if (o.prazo - o.data_abertura).days <= 15)
        taxa = round(cumpridas / len(no_prazo) * 100) if no_prazo else 0
        dados.append({
            'nome': nome,
            'concluidas': concluidas_mes,
            'andamento': em_andamento,
            'taxa': taxa,
            'erros': erros_count,
        })
    return render_template('produtividade.html', dados=dados, mes=mes)


@app.route('/relatorio/pdf')
def relatorio_pdf():
    mes = request.args.get('mes', date.today().strftime('%Y-%m'))
    ano, m = int(mes.split('-')[0]), int(mes.split('-')[1])
    inicio = date(ano, m, 1)
    fim = date(ano, m + 1, 1) if m < 12 else date(ano + 1, 1, 1)

    entregues = OS.query.filter(OS.status == STATUS_LIST[-1], OS.prazo >= inicio, OS.prazo < fim).all()
    atrasadas = [o for o in OS.query.all() if o.dias_restantes < 0 and o.status != STATUS_LIST[-1]]
    erros_list = Erro.query.filter(Erro.data >= inicio, Erro.data < fim).all()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        import io

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=30, bottomMargin=30)
        styles = getSampleStyleSheet()
        elems = []

        elems.append(Paragraph(f'Relatório de Engenharia — {mes}', styles['Title']))
        elems.append(Spacer(1, 12))

        elems.append(Paragraph('OSs Entregues', styles['Heading2']))
        if entregues:
            t_data = [['Nº OS', 'Cliente', 'Responsável', 'Prazo']]
            for o in entregues:
                t_data.append([o.numero, o.cliente, o.responsavel, o.prazo.strftime('%d/%m/%Y')])
            t = Table(t_data, hAlign='LEFT')
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5276')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elems.append(t)
        else:
            elems.append(Paragraph('Nenhuma OS entregue no período.', styles['Normal']))
        elems.append(Spacer(1, 12))

        elems.append(Paragraph('OSs Atrasadas', styles['Heading2']))
        if atrasadas:
            t_data = [['Nº OS', 'Cliente', 'Status', 'Dias Atraso']]
            for o in atrasadas:
                t_data.append([o.numero, o.cliente, o.status, str(abs(o.dias_restantes))])
            t = Table(t_data, hAlign='LEFT')
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#922b21')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elems.append(t)
        else:
            elems.append(Paragraph('Nenhuma OS atrasada.', styles['Normal']))
        elems.append(Spacer(1, 12))

        elems.append(Paragraph('Erros por Categoria', styles['Heading2']))
        contagem = {}
        for e in erros_list:
            contagem[e.tipo] = contagem.get(e.tipo, 0) + 1
        if contagem:
            t_data = [['Tipo', 'Quantidade']] + [[k, str(v)] for k, v in contagem.items()]
            t = Table(t_data, hAlign='LEFT')
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#784212')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            elems.append(t)
        else:
            elems.append(Paragraph('Nenhum erro registrado no período.', styles['Normal']))

        doc.build(elems)
        buf.seek(0)
        resp = make_response(buf.read())
        resp.headers['Content-Type'] = 'application/pdf'
        resp.headers['Content-Disposition'] = f'attachment; filename=relatorio_{mes}.pdf'
        return resp

    except ImportError:
        return 'Instale reportlab: pip install reportlab', 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
