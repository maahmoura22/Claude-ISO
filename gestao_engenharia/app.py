import os
import io
from datetime import datetime, date, timedelta
from flask import (Flask, render_template, request, redirect,
                   url_for, flash, jsonify, make_response)
from flask_sqlalchemy import SQLAlchemy
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                Paragraph, Spacer, HRFlowable)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'metal-eng-2024-xK9!mP')
app.jinja_env.globals['enumerate'] = enumerate

database_url = os.environ.get('DATABASE_URL', 'sqlite:///gestao.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ── Constantes ───────────────────────────────────────────────────────────────

DESENHISTAS = ['Lucas', 'Breno', 'Gustavo', 'Wesley']
PROCESSISTAS = ['Processista 1', 'Processista 2']
USUARIOS = ['Patrick'] + DESENHISTAS + PROCESSISTAS

STATUS_LABELS = {
    'desenho_andamento': 'Desenho em Andamento',
    'com_processista':   'Com Processista',
    'revisao_desenho':   'Revisão Desenho',
    'revisao_processo':  'Revisão Processo (Patrick)',
    'liberado_fabrica':  'Liberado para Fábrica',
}

COMPLEXIDADE_LABELS = {
    'simples':  '🟢 Simples',
    'media':    '🟡 Média',
    'complexa': '🔴 Complexa',
}

TIPO_ERRO_LABELS = {
    'engenharia': 'Erro de Engenharia',
    'fabrica':    'Erro de Fábrica',
    'processo':   'Erro de Processo',
    'vendas':     'Pendência de Vendas',
}

# ── Modelos ──────────────────────────────────────────────────────────────────

class OrdemServico(db.Model):
    __tablename__ = 'ordens_servico'

    id                    = db.Column(db.Integer, primary_key=True)
    numero                = db.Column(db.String(20), unique=True, nullable=False)
    data_abertura         = db.Column(db.Date, nullable=False)
    cliente               = db.Column(db.String(100), nullable=False)
    descricao_peca        = db.Column(db.String(300), nullable=False)
    complexidade          = db.Column(db.String(10), nullable=False)
    responsavel_desenhista = db.Column(db.String(50), nullable=False)
    processista           = db.Column(db.String(50))
    prazo                 = db.Column(db.Date, nullable=False)
    observacoes           = db.Column(db.Text)
    status                = db.Column(db.String(50), default='desenho_andamento')
    created_at            = db.Column(db.DateTime, default=datetime.utcnow)

    checklists = db.relationship('Checklist', backref='os', lazy=True, cascade='all, delete-orphan')
    erros      = db.relationship('ErroNaoConformidade', backref='os', lazy=True, cascade='all, delete-orphan')
    historico  = db.relationship('HistoricoStatus', backref='os', lazy=True,
                                  order_by='HistoricoStatus.data_mudanca', cascade='all, delete-orphan')

    @property
    def dias_restantes(self):
        return (self.prazo - date.today()).days

    @property
    def situacao(self):
        dr = self.dias_restantes
        if self.status == 'liberado_fabrica':
            return 'concluida'
        if dr < 0:
            return 'atrasada'
        if dr <= 3:
            return 'critica'
        return 'ok'

    @property
    def checklist_atual(self):
        return Checklist.query.filter_by(os_id=self.id).first()


class Checklist(db.Model):
    __tablename__ = 'checklists'

    id                  = db.Column(db.Integer, primary_key=True)
    os_id               = db.Column(db.Integer, db.ForeignKey('ordens_servico.id'), nullable=False)
    cotas_montagem      = db.Column(db.Boolean, default=False)
    tolerancias_iso     = db.Column(db.Boolean, default=False)
    acabamento          = db.Column(db.Boolean, default=False)
    material_cabecalho  = db.Column(db.Boolean, default=False)
    dimensoes_conferidas = db.Column(db.Boolean, default=False)
    chaveta_rosca_furo  = db.Column(db.Boolean, default=False)
    vista_corte         = db.Column(db.Boolean, default=False)
    escala_legivel      = db.Column(db.Boolean, default=False)
    preenchido_por      = db.Column(db.String(50))
    data_preenchimento  = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def completo(self):
        return all([self.cotas_montagem, self.tolerancias_iso, self.acabamento,
                    self.material_cabecalho, self.dimensoes_conferidas,
                    self.chaveta_rosca_furo, self.vista_corte, self.escala_legivel])

    @property
    def itens_ok(self):
        return sum([self.cotas_montagem, self.tolerancias_iso, self.acabamento,
                    self.material_cabecalho, self.dimensoes_conferidas,
                    self.chaveta_rosca_furo, self.vista_corte, self.escala_legivel])


class ErroNaoConformidade(db.Model):
    __tablename__ = 'erros'

    id               = db.Column(db.Integer, primary_key=True)
    os_id            = db.Column(db.Integer, db.ForeignKey('ordens_servico.id'), nullable=False)
    tipo             = db.Column(db.String(20), nullable=False)
    descricao        = db.Column(db.Text, nullable=False)
    identificado_por = db.Column(db.String(50), nullable=False)
    acao_corretiva   = db.Column(db.Text)
    status           = db.Column(db.String(20), default='aberto')
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)


class HistoricoStatus(db.Model):
    __tablename__ = 'historico_status'

    id              = db.Column(db.Integer, primary_key=True)
    os_id           = db.Column(db.Integer, db.ForeignKey('ordens_servico.id'), nullable=False)
    status_anterior = db.Column(db.String(50))
    status_novo     = db.Column(db.String(50), nullable=False)
    usuario         = db.Column(db.String(50))
    data_mudanca    = db.Column(db.DateTime, default=datetime.utcnow)
    observacao      = db.Column(db.Text)


# ── Helpers ──────────────────────────────────────────────────────────────────

def registrar_historico(os_obj, status_novo, usuario='Sistema', obs=None):
    h = HistoricoStatus(
        os_id=os_obj.id,
        status_anterior=os_obj.status,
        status_novo=status_novo,
        usuario=usuario,
        observacao=obs,
    )
    db.session.add(h)


# ── Rotas: Dashboard ─────────────────────────────────────────────────────────

@app.route('/')
def dashboard():
    todas = OrdemServico.query.order_by(OrdemServico.prazo).all()
    hoje = date.today()

    stats = {
        'total':      len(todas),
        'abertas':    sum(1 for o in todas if o.status != 'liberado_fabrica'),
        'atrasadas':  sum(1 for o in todas if o.situacao == 'atrasada'),
        'criticas':   sum(1 for o in todas if o.situacao == 'critica'),
        'concluidas': sum(1 for o in todas if o.status == 'liberado_fabrica'),
    }

    erros_abertos = ErroNaoConformidade.query.filter_by(status='aberto').count()

    return render_template('dashboard.html',
                           ordens=todas, stats=stats,
                           erros_abertos=erros_abertos,
                           STATUS_LABELS=STATUS_LABELS,
                           COMPLEXIDADE_LABELS=COMPLEXIDADE_LABELS)


# ── Rotas: OS ────────────────────────────────────────────────────────────────

@app.route('/nova-os', methods=['GET', 'POST'])
def nova_os():
    if request.method == 'POST':
        numero = request.form['numero'].strip()
        if OrdemServico.query.filter_by(numero=numero).first():
            flash(f'OS {numero} já cadastrada.', 'danger')
            return redirect(url_for('nova_os'))

        data_ab = datetime.strptime(request.form['data_abertura'], '%Y-%m-%d').date()
        prazo   = datetime.strptime(request.form['prazo'], '%Y-%m-%d').date()

        os_obj = OrdemServico(
            numero=numero,
            data_abertura=data_ab,
            cliente=request.form['cliente'].strip(),
            descricao_peca=request.form['descricao_peca'].strip(),
            complexidade=request.form['complexidade'],
            responsavel_desenhista=request.form['responsavel_desenhista'],
            processista=request.form.get('processista'),
            prazo=prazo,
            observacoes=request.form.get('observacoes', '').strip(),
        )
        db.session.add(os_obj)
        db.session.flush()

        h = HistoricoStatus(os_id=os_obj.id, status_novo='desenho_andamento',
                            usuario='Patrick', observacao='OS criada')
        db.session.add(h)
        db.session.commit()

        flash(f'OS {numero} cadastrada com sucesso!', 'success')
        return redirect(url_for('os_detalhe', os_id=os_obj.id))

    prazo_sugerido = date.today() + timedelta(days=15)
    return render_template('nova_os.html',
                           desenhistas=DESENHISTAS,
                           processistas=PROCESSISTAS,
                           prazo_sugerido=prazo_sugerido.strftime('%Y-%m-%d'),
                           hoje=date.today().strftime('%Y-%m-%d'))


@app.route('/os/<int:os_id>')
def os_detalhe(os_id):
    os_obj = OrdemServico.query.get_or_404(os_id)
    checklist = os_obj.checklist_atual
    return render_template('os_detalhe.html', os=os_obj, checklist=checklist,
                           STATUS_LABELS=STATUS_LABELS,
                           COMPLEXIDADE_LABELS=COMPLEXIDADE_LABELS,
                           TIPO_ERRO_LABELS=TIPO_ERRO_LABELS,
                           usuarios=USUARIOS)


@app.route('/os/<int:os_id>/avancar', methods=['POST'])
def avancar_status(os_id):
    os_obj = OrdemServico.query.get_or_404(os_id)
    sequencia = list(STATUS_LABELS.keys())
    idx = sequencia.index(os_obj.status)

    # Bloqueia avanço de desenho_andamento → com_processista sem checklist completo
    if os_obj.status == 'desenho_andamento':
        checklist = os_obj.checklist_atual
        if not checklist or not checklist.completo:
            flash('Checklist incompleto. Preencha todos os itens antes de avançar.', 'danger')
            return redirect(url_for('os_detalhe', os_id=os_id))

    if idx < len(sequencia) - 1:
        novo_status = sequencia[idx + 1]
        usuario = request.form.get('usuario', 'Sistema')
        obs = request.form.get('observacao', '')
        registrar_historico(os_obj, novo_status, usuario, obs)
        os_obj.status = novo_status
        db.session.commit()
        flash(f'OS avançada para: {STATUS_LABELS[novo_status]}', 'success')

    return redirect(url_for('os_detalhe', os_id=os_id))


@app.route('/os/<int:os_id>/retroceder', methods=['POST'])
def retroceder_status(os_id):
    os_obj = OrdemServico.query.get_or_404(os_id)
    sequencia = list(STATUS_LABELS.keys())
    idx = sequencia.index(os_obj.status)

    if idx > 0:
        novo_status = sequencia[idx - 1]
        usuario = request.form.get('usuario', 'Sistema')
        obs = request.form.get('observacao', '')
        registrar_historico(os_obj, novo_status, usuario, obs)
        os_obj.status = novo_status
        db.session.commit()
        flash(f'OS retrocedida para: {STATUS_LABELS[novo_status]}', 'warning')

    return redirect(url_for('os_detalhe', os_id=os_id))


@app.route('/os/<int:os_id>/editar', methods=['GET', 'POST'])
def editar_os(os_id):
    os_obj = OrdemServico.query.get_or_404(os_id)
    if request.method == 'POST':
        os_obj.cliente         = request.form['cliente'].strip()
        os_obj.descricao_peca  = request.form['descricao_peca'].strip()
        os_obj.complexidade    = request.form['complexidade']
        os_obj.responsavel_desenhista = request.form['responsavel_desenhista']
        os_obj.processista     = request.form.get('processista')
        os_obj.prazo           = datetime.strptime(request.form['prazo'], '%Y-%m-%d').date()
        os_obj.observacoes     = request.form.get('observacoes', '').strip()
        db.session.commit()
        flash('OS atualizada com sucesso!', 'success')
        return redirect(url_for('os_detalhe', os_id=os_id))

    return render_template('editar_os.html', os=os_obj,
                           desenhistas=DESENHISTAS, processistas=PROCESSISTAS)


# ── Rotas: Kanban ────────────────────────────────────────────────────────────

@app.route('/kanban')
def kanban():
    colunas = {}
    for status_key in STATUS_LABELS:
        colunas[status_key] = OrdemServico.query.filter_by(
            status=status_key).order_by(OrdemServico.prazo).all()
    return render_template('kanban.html', colunas=colunas,
                           STATUS_LABELS=STATUS_LABELS,
                           COMPLEXIDADE_LABELS=COMPLEXIDADE_LABELS)


@app.route('/kanban/mover', methods=['POST'])
def mover_kanban():
    data = request.get_json()
    os_obj = OrdemServico.query.get(data['os_id'])
    if not os_obj:
        return jsonify({'ok': False, 'msg': 'OS não encontrada'}), 404

    novo_status = data['novo_status']
    if novo_status not in STATUS_LABELS:
        return jsonify({'ok': False, 'msg': 'Status inválido'}), 400

    # Bloqueia mover de desenho → com_processista sem checklist
    if os_obj.status == 'desenho_andamento' and novo_status == 'com_processista':
        checklist = os_obj.checklist_atual
        if not checklist or not checklist.completo:
            return jsonify({'ok': False,
                            'msg': 'Checklist incompleto. Preencha antes de avançar.'}), 400

    registrar_historico(os_obj, novo_status, data.get('usuario', 'Sistema'))
    os_obj.status = novo_status
    db.session.commit()
    return jsonify({'ok': True})


# ── Rotas: Checklist ─────────────────────────────────────────────────────────

@app.route('/os/<int:os_id>/checklist', methods=['GET', 'POST'])
def checklist(os_id):
    os_obj = OrdemServico.query.get_or_404(os_id)
    ck = os_obj.checklist_atual

    if request.method == 'POST':
        if not ck:
            ck = Checklist(os_id=os_id)
            db.session.add(ck)

        ck.cotas_montagem       = 'cotas_montagem' in request.form
        ck.tolerancias_iso      = 'tolerancias_iso' in request.form
        ck.acabamento           = 'acabamento' in request.form
        ck.material_cabecalho   = 'material_cabecalho' in request.form
        ck.dimensoes_conferidas = 'dimensoes_conferidas' in request.form
        ck.chaveta_rosca_furo   = 'chaveta_rosca_furo' in request.form
        ck.vista_corte          = 'vista_corte' in request.form
        ck.escala_legivel       = 'escala_legivel' in request.form
        ck.preenchido_por       = request.form.get('preenchido_por')
        ck.data_preenchimento   = datetime.utcnow()
        db.session.commit()

        if ck.completo:
            flash('Checklist 100% completo! OS pode avançar para o Processista.', 'success')
        else:
            flash(f'Checklist salvo ({ck.itens_ok}/8 itens). Complete todos para avançar.', 'warning')

        return redirect(url_for('os_detalhe', os_id=os_id))

    return render_template('checklist.html', os=os_obj, checklist=ck,
                           desenhistas=DESENHISTAS)


# ── Rotas: Erros ─────────────────────────────────────────────────────────────

@app.route('/erros')
def erros():
    filtro_tipo   = request.args.get('tipo', '')
    filtro_status = request.args.get('status', '')

    q = ErroNaoConformidade.query.join(OrdemServico)

    if filtro_tipo:
        q = q.filter(ErroNaoConformidade.tipo == filtro_tipo)
    if filtro_status:
        q = q.filter(ErroNaoConformidade.status == filtro_status)

    lista = q.order_by(ErroNaoConformidade.created_at.desc()).all()

    stats_tipo = {}
    for t in TIPO_ERRO_LABELS:
        stats_tipo[t] = ErroNaoConformidade.query.filter_by(tipo=t).count()

    return render_template('erros.html', erros=lista,
                           stats_tipo=stats_tipo,
                           TIPO_ERRO_LABELS=TIPO_ERRO_LABELS,
                           filtro_tipo=filtro_tipo, filtro_status=filtro_status)


@app.route('/erros/novo', methods=['POST'])
def novo_erro():
    os_num = request.form['os_numero'].strip()
    os_obj = OrdemServico.query.filter_by(numero=os_num).first()
    if not os_obj:
        flash(f'OS {os_num} não encontrada.', 'danger')
        return redirect(url_for('erros'))

    erro = ErroNaoConformidade(
        os_id=os_obj.id,
        tipo=request.form['tipo'],
        descricao=request.form['descricao'].strip(),
        identificado_por=request.form['identificado_por'],
        acao_corretiva=request.form.get('acao_corretiva', '').strip(),
    )
    db.session.add(erro)
    db.session.commit()
    flash('Erro/não conformidade registrado com sucesso.', 'success')
    return redirect(url_for('erros'))


@app.route('/erros/<int:erro_id>/resolver', methods=['POST'])
def resolver_erro(erro_id):
    erro = ErroNaoConformidade.query.get_or_404(erro_id)
    acao = request.form.get('acao_corretiva', '').strip()
    if acao:
        erro.acao_corretiva = acao
    erro.status = 'resolvido'
    db.session.commit()
    flash('Erro marcado como resolvido.', 'success')
    return redirect(url_for('erros'))


# ── Rotas: Produtividade ─────────────────────────────────────────────────────

@app.route('/produtividade')
def produtividade():
    mes   = request.args.get('mes', date.today().month, type=int)
    ano   = request.args.get('ano', date.today().year, type=int)

    inicio = date(ano, mes, 1)
    if mes == 12:
        fim = date(ano + 1, 1, 1)
    else:
        fim = date(ano, mes + 1, 1)

    dados = []
    for nome in DESENHISTAS:
        concluidas = OrdemServico.query.filter(
            OrdemServico.responsavel_desenhista == nome,
            OrdemServico.status == 'liberado_fabrica',
            OrdemServico.data_abertura >= inicio,
            OrdemServico.data_abertura < fim,
        ).all()

        em_andamento = OrdemServico.query.filter(
            OrdemServico.responsavel_desenhista == nome,
            OrdemServico.status != 'liberado_fabrica',
        ).count()

        no_prazo = sum(1 for o in concluidas
                       if o.prazo >= o.data_abertura + timedelta(days=0))

        erros_mes = ErroNaoConformidade.query.join(OrdemServico).filter(
            OrdemServico.responsavel_desenhista == nome,
            ErroNaoConformidade.created_at >= datetime(ano, mes, 1),
            ErroNaoConformidade.created_at < datetime(fim.year, fim.month, fim.day),
        ).count()

        dados.append({
            'nome':         nome,
            'concluidas':   len(concluidas),
            'em_andamento': em_andamento,
            'no_prazo':     no_prazo,
            'erros':        erros_mes,
        })

    meses = ['Jan','Fev','Mar','Abr','Mai','Jun',
              'Jul','Ago','Set','Out','Nov','Dez']
    anos = list(range(date.today().year - 1, date.today().year + 2))

    return render_template('produtividade.html', dados=dados,
                           mes=mes, ano=ano, meses=meses, anos=anos)


# ── Rotas: Relatório ─────────────────────────────────────────────────────────

@app.route('/relatorio')
def relatorio():
    mes = request.args.get('mes', date.today().month, type=int)
    ano = request.args.get('ano', date.today().year, type=int)
    return render_template('relatorio.html', mes=mes, ano=ano,
                           meses=['Jan','Fev','Mar','Abr','Mai','Jun',
                                  'Jul','Ago','Set','Out','Nov','Dez'],
                           anos=list(range(date.today().year - 1, date.today().year + 2)))


@app.route('/relatorio/pdf')
def relatorio_pdf():
    mes = request.args.get('mes', date.today().month, type=int)
    ano = request.args.get('ano', date.today().year, type=int)

    inicio = date(ano, mes, 1)
    fim    = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)

    ordens = OrdemServico.query.filter(
        OrdemServico.data_abertura >= inicio,
        OrdemServico.data_abertura < fim,
    ).all()

    entregues = [o for o in ordens if o.status == 'liberado_fabrica']
    atrasadas = [o for o in ordens if o.situacao == 'atrasada']

    erros_periodo = ErroNaoConformidade.query.filter(
        ErroNaoConformidade.created_at >= datetime(ano, mes, 1),
        ErroNaoConformidade.created_at < datetime(fim.year, fim.month, fim.day),
    ).all()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                            leftMargin=1.5*cm, rightMargin=1.5*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)

    styles = getSampleStyleSheet()
    titulo_style = ParagraphStyle('titulo', fontSize=16, fontName='Helvetica-Bold',
                                   spaceAfter=6, alignment=TA_CENTER)
    sub_style    = ParagraphStyle('sub', fontSize=10, fontName='Helvetica',
                                   spaceAfter=12, alignment=TA_CENTER, textColor=colors.grey)
    h2_style     = ParagraphStyle('h2', fontSize=12, fontName='Helvetica-Bold',
                                   spaceBefore=14, spaceAfter=6)
    normal       = styles['Normal']
    normal.fontSize = 8

    meses_nome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

    story = []
    story.append(Paragraph('RELATÓRIO MENSAL — ENGENHARIA', titulo_style))
    story.append(Paragraph(f'{meses_nome[mes-1]} / {ano}', sub_style))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#1e3a5f')))
    story.append(Spacer(1, 12))

    # Resumo
    resumo_data = [
        ['Total de OSs no período', 'Entregues', 'Atrasadas', 'Erros registrados'],
        [str(len(ordens)), str(len(entregues)), str(len(atrasadas)), str(len(erros_periodo))],
    ]
    t = Table(resumo_data, colWidths=[7*cm]*4)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,-1), 9),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f0f4f8'), colors.white]),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))

    # OSs entregues
    story.append(Paragraph('OSs Entregues no Período', h2_style))
    if entregues:
        cols = ['OS', 'Cliente', 'Peça', 'Desenhista', 'Complexidade', 'Prazo', 'Situação']
        rows = [cols]
        for o in entregues:
            situacao = 'No prazo' if o.prazo >= fim else 'Atrasada'
            rows.append([o.numero, o.cliente[:20], o.descricao_peca[:30],
                         o.responsavel_desenhista,
                         o.complexidade.capitalize(),
                         o.prazo.strftime('%d/%m/%Y'), situacao])
        t2 = Table(rows, colWidths=[2.5*cm, 4*cm, 6*cm, 3*cm, 2.5*cm, 2.5*cm, 2.5*cm])
        t2.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2d6a4f')),
            ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
            ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,-1), 8),
            ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f0faf5'), colors.white]),
            ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
            ('TOPPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t2)
    else:
        story.append(Paragraph('Nenhuma OS entregue no período.', normal))

    story.append(Spacer(1, 16))

    # OSs atrasadas
    story.append(Paragraph('OSs Atrasadas', h2_style))
    if atrasadas:
        cols = ['OS', 'Cliente', 'Desenhista', 'Prazo', 'Dias Atraso', 'Status Atual']
        rows = [cols]
        for o in atrasadas:
            atraso = (date.today() - o.prazo).days
            rows.append([o.numero, o.cliente[:20], o.responsavel_desenhista,
                         o.prazo.strftime('%d/%m/%Y'), str(atraso),
                         STATUS_LABELS.get(o.status, o.status)])
        t3 = Table(rows, colWidths=[2.5*cm, 5*cm, 3.5*cm, 3*cm, 3*cm, 6*cm])
        t3.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#9b2226')),
            ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
            ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0,0), (-1,-1), 8),
            ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#fff0f0'), colors.white]),
            ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
            ('TOPPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t3)
    else:
        story.append(Paragraph('Nenhuma OS atrasada no período.', normal))

    story.append(Spacer(1, 16))

    # Erros por categoria
    story.append(Paragraph('Erros / Não Conformidades por Categoria', h2_style))
    cat_data = [['Categoria', 'Quantidade', 'Resolvidos', 'Abertos']]
    for tipo, label in TIPO_ERRO_LABELS.items():
        total_t   = sum(1 for e in erros_periodo if e.tipo == tipo)
        resolvidos = sum(1 for e in erros_periodo if e.tipo == tipo and e.status == 'resolvido')
        abertos    = total_t - resolvidos
        cat_data.append([label, str(total_t), str(resolvidos), str(abertos)])
    t4 = Table(cat_data, colWidths=[8*cm, 4*cm, 4*cm, 4*cm])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,-1), 9),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f5f5f5'), colors.white]),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t4)
    story.append(Spacer(1, 16))

    # Produtividade por desenhista
    story.append(Paragraph('Produtividade por Desenhista', h2_style))
    prod_data = [['Desenhista', 'OSs Concluídas', 'Em Andamento', 'Erros no Mês']]
    for nome in DESENHISTAS:
        conc = OrdemServico.query.filter(
            OrdemServico.responsavel_desenhista == nome,
            OrdemServico.status == 'liberado_fabrica',
            OrdemServico.data_abertura >= inicio,
            OrdemServico.data_abertura < fim,
        ).count()
        and_ = OrdemServico.query.filter(
            OrdemServico.responsavel_desenhista == nome,
            OrdemServico.status != 'liberado_fabrica',
        ).count()
        err  = sum(1 for e in erros_periodo
                   if e.os and e.os.responsavel_desenhista == nome)
        prod_data.append([nome, str(conc), str(and_), str(err)])

    t5 = Table(prod_data, colWidths=[5*cm, 5*cm, 5*cm, 5*cm])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a5f')),
        ('TEXTCOLOR',  (0,0), (-1,0), colors.white),
        ('FONTNAME',   (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0,0), (-1,-1), 9),
        ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor('#f5f5f5'), colors.white]),
        ('GRID',       (0,0), (-1,-1), 0.5, colors.grey),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t5)

    story.append(Spacer(1, 20))
    story.append(Paragraph(f'Gerado em {datetime.now().strftime("%d/%m/%Y %H:%M")}',
                            ParagraphStyle('rodape', fontSize=8, textColor=colors.grey,
                                           alignment=TA_CENTER)))

    doc.build(story)
    buf.seek(0)

    resp = make_response(buf.read())
    resp.headers['Content-Type'] = 'application/pdf'
    resp.headers['Content-Disposition'] = (
        f'attachment; filename=relatorio_engenharia_{ano}_{mes:02d}.pdf')
    return resp


# ── API: OS autocomplete ─────────────────────────────────────────────────────

@app.route('/api/os-numeros')
def api_os_numeros():
    q = request.args.get('q', '')
    ordens = OrdemServico.query.filter(
        OrdemServico.numero.ilike(f'%{q}%')
    ).limit(10).all()
    return jsonify([{'numero': o.numero, 'cliente': o.cliente} for o in ordens])


# ── Init ─────────────────────────────────────────────────────────────────────

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
