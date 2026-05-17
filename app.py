# Sistema de Gestão de Engenharia – Metalúrgica ISO
# Backend Flask + SQLite
from flask import Flask, render_template, request, jsonify, redirect, url_for, abort
import sqlite3
import os
from datetime import datetime, date, timedelta

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'metalurgica.db')

# ── Banco de Dados ─────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS ordens_servico (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            numero                  TEXT    UNIQUE NOT NULL,
            data_abertura           DATE    NOT NULL,
            cliente                 TEXT    NOT NULL,
            descricao_peca          TEXT    NOT NULL,
            complexidade            TEXT    NOT NULL CHECK(complexidade IN ('simples','media','complexa')),
            responsavel_desenhista  TEXT    NOT NULL,
            prazo                   DATE    NOT NULL,
            observacoes             TEXT    DEFAULT '',
            status                  TEXT    NOT NULL DEFAULT 'desenho_andamento',
            data_conclusao          DATE,
            created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS checklist (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            os_id                   INTEGER NOT NULL UNIQUE REFERENCES ordens_servico(id) ON DELETE CASCADE,
            cotas_montagem          INTEGER DEFAULT 0,
            tolerancias_ajuste      INTEGER DEFAULT 0,
            acabamento_superficial  INTEGER DEFAULT 0,
            material_cabecalho      INTEGER DEFAULT 0,
            dimensoes_conferidas    INTEGER DEFAULT 0,
            chaveta_rosca_furo      INTEGER DEFAULT 0,
            vista_corte             INTEGER DEFAULT 0,
            escala_legivel          INTEGER DEFAULT 0,
            preenchido_por          TEXT    DEFAULT '',
            data_preenchimento      TIMESTAMP,
            completo                INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS erros_nc (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            os_id               INTEGER REFERENCES ordens_servico(id) ON DELETE SET NULL,
            tipo                TEXT NOT NULL CHECK(tipo IN ('erro_engenharia','erro_fabrica','erro_processo','pendencia_vendas')),
            descricao           TEXT NOT NULL,
            identificado_por    TEXT NOT NULL,
            acao_corretiva      TEXT DEFAULT '',
            status              TEXT DEFAULT 'aberto' CHECK(status IN ('aberto','resolvido')),
            data_registro       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_resolucao      TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS historico_status (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            os_id           INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
            status_anterior TEXT,
            status_novo     TEXT NOT NULL,
            alterado_por    TEXT NOT NULL DEFAULT 'Sistema',
            observacao      TEXT DEFAULT '',
            data_alteracao  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    conn.commit()
    conn.close()

init_db()

# ── Constantes ─────────────────────────────────────────────────────────────────

STATUS_PIPELINE = [
    ('desenho_andamento', 'Desenho em Andamento',       '✏️'),
    ('com_processista',   'Com Processista',             '⚙️'),
    ('revisao_desenho',   'Revisão Desenho',             '🔍'),
    ('revisao_processo',  'Revisão Processo (Patrick)',  '📋'),
    ('liberado_fabrica',  'Liberado para Fábrica',       '🏭'),
]
STATUS_DICT = {k: (label, icon) for k, label, icon in STATUS_PIPELINE}
STATUS_KEYS = [k for k, *_ in STATUS_PIPELINE]

DESENHISTAS = ['Lucas', 'Breno', 'Gustavo', 'Wesley']
EQUIPE_ALL  = ['Patrick', 'Lucas', 'Breno', 'Gustavo', 'Wesley', 'Processista 1', 'Processista 2']

COMPLEXIDADE = {
    'simples':  ('Simples',  '🟢'),
    'media':    ('Média',    '🟡'),
    'complexa': ('Complexa', '🔴'),
}

CHECKLIST_ITEMS = [
    ('cotas_montagem',       'Todas as cotas de montagem presentes?'),
    ('tolerancias_ajuste',   'Tolerâncias de ajuste ISO indicadas (colos, alojamentos)?'),
    ('acabamento_superficial','Acabamento superficial indicado nas regiões críticas?'),
    ('material_cabecalho',   'Material especificado no cabeçalho?'),
    ('dimensoes_conferidas', 'Dimensões conferidas contra amostra/medição?'),
    ('chaveta_rosca_furo',   'Chaveta, rosca, furo de centro cotados corretamente?'),
    ('vista_corte',          'Vista de corte suficiente?'),
    ('escala_legivel',       'Escala correta e legível?'),
]

TIPOS_ERRO = {
    'erro_engenharia':  'Erro de Engenharia',
    'erro_fabrica':     'Erro de Fábrica',
    'erro_processo':    'Erro de Processo',
    'pendencia_vendas': 'Pendência Vendas',
}

# ── Helpers de template ────────────────────────────────────────────────────────

def dias_restantes(prazo_str):
    try:
        prazo = date.fromisoformat(str(prazo_str))
        return (prazo - date.today()).days
    except Exception:
        return 0

def alerta_class(dias):
    if dias < 0:  return 'danger'
    if dias <= 3: return 'warning'
    return 'success'

def fmt_data(val):
    if not val:
        return ''
    try:
        return date.fromisoformat(str(val)).strftime('%d/%m/%Y')
    except Exception:
        return str(val)

app.jinja_env.globals.update(
    dias_restantes=dias_restantes,
    alerta_class=alerta_class,
    fmt_data=fmt_data,
    STATUS_DICT=STATUS_DICT,
    STATUS_KEYS=STATUS_KEYS,
    STATUS_PIPELINE=STATUS_PIPELINE,
    COMPLEXIDADE=COMPLEXIDADE,
    CHECKLIST_ITEMS=CHECKLIST_ITEMS,
    TIPOS_ERRO=TIPOS_ERRO,
    now=datetime.now,
    enumerate=enumerate,
)

# ── Dashboard ──────────────────────────────────────────────────────────────────

@app.route('/')
def dashboard():
    db = get_db()
    oss = db.execute('''
        SELECT o.*,
               CAST(julianday(o.prazo) - julianday('now') AS INTEGER) AS dias_rest,
               cl.completo AS checklist_ok
        FROM   ordens_servico o
        LEFT JOIN checklist cl ON cl.os_id = o.id
        WHERE  o.status != 'liberado_fabrica'
        ORDER  BY o.prazo ASC
    ''').fetchall()

    stats = {
        'ativas':         db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status!='liberado_fabrica'").fetchone()[0],
        'atrasadas':      db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status!='liberado_fabrica' AND prazo<date('now')").fetchone()[0],
        'concluidas_mes': db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status='liberado_fabrica' AND strftime('%Y-%m',data_conclusao)=strftime('%Y-%m','now')").fetchone()[0],
        'erros_abertos':  db.execute("SELECT COUNT(*) FROM erros_nc WHERE status='aberto'").fetchone()[0],
    }
    por_status = {k: db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status=?", (k,)).fetchone()[0] for k in STATUS_KEYS}
    db.close()
    return render_template('dashboard.html', oss=oss, stats=stats, por_status=por_status)

# ── Ordens de Serviço ──────────────────────────────────────────────────────────

@app.route('/os/nova', methods=['GET', 'POST'])
def os_nova():
    if request.method == 'POST':
        f  = request.form
        db = get_db()
        try:
            db.execute('''INSERT INTO ordens_servico
                (numero, data_abertura, cliente, descricao_peca, complexidade,
                 responsavel_desenhista, prazo, observacoes)
                VALUES (?,?,?,?,?,?,?,?)''',
                (f['numero'], f['data_abertura'], f['cliente'], f['descricao_peca'],
                 f['complexidade'], f['responsavel_desenhista'], f['prazo'], f.get('observacoes', '')))
            oid = db.execute("SELECT last_insert_rowid()").fetchone()[0]
            db.execute("INSERT INTO checklist (os_id) VALUES (?)", (oid,))
            db.execute("INSERT INTO historico_status (os_id, status_novo, alterado_por, observacao) VALUES (?,'desenho_andamento','Sistema','OS criada')", (oid,))
            db.commit()
        except sqlite3.IntegrityError:
            db.close()
            return render_template('os_cadastro.html',
                                   desenhistas=DESENHISTAS, complexidade=COMPLEXIDADE,
                                   prazo_default=(date.today()+timedelta(days=15)).isoformat(),
                                   hoje=date.today().isoformat(),
                                   erro='Número de OS já cadastrado.')
        db.close()
        return redirect(url_for('dashboard'))

    return render_template('os_cadastro.html',
                           desenhistas=DESENHISTAS, complexidade=COMPLEXIDADE,
                           prazo_default=(date.today()+timedelta(days=15)).isoformat(),
                           hoje=date.today().isoformat())

@app.route('/os/<int:oid>')
def os_detalhe(oid):
    db   = get_db()
    os   = db.execute("SELECT * FROM ordens_servico WHERE id=?", (oid,)).fetchone()
    if not os: abort(404)
    cl   = db.execute("SELECT * FROM checklist WHERE os_id=?", (oid,)).fetchone()
    hist = db.execute("SELECT * FROM historico_status WHERE os_id=? ORDER BY data_alteracao DESC", (oid,)).fetchall()
    errs = db.execute("SELECT * FROM erros_nc WHERE os_id=? ORDER BY data_registro DESC", (oid,)).fetchall()
    db.close()
    idx  = STATUS_KEYS.index(os['status'])
    return render_template('os_detalhe.html', os=os, cl=cl, hist=hist, erros=errs,
                           idx=idx, equipe=EQUIPE_ALL, tipos_erro=TIPOS_ERRO)

@app.route('/os/<int:oid>/editar', methods=['GET', 'POST'])
def os_editar(oid):
    db = get_db()
    os = db.execute("SELECT * FROM ordens_servico WHERE id=?", (oid,)).fetchone()
    if not os: abort(404)
    if request.method == 'POST':
        f = request.form
        db.execute('''UPDATE ordens_servico SET cliente=?, descricao_peca=?, complexidade=?,
                      responsavel_desenhista=?, prazo=?, observacoes=? WHERE id=?''',
                   (f['cliente'], f['descricao_peca'], f['complexidade'],
                    f['responsavel_desenhista'], f['prazo'], f.get('observacoes', ''), oid))
        db.commit(); db.close()
        return redirect(url_for('os_detalhe', oid=oid))
    db.close()
    return render_template('os_editar.html', os=os, desenhistas=DESENHISTAS, complexidade=COMPLEXIDADE)

@app.route('/os/<int:oid>/checklist', methods=['POST'])
def salvar_checklist(oid):
    data  = request.get_json()
    db    = get_db()
    cols  = [c for c, _ in CHECKLIST_ITEMS]
    vals  = [1 if data.get(c) else 0 for c in cols]
    comp  = 1 if all(vals) else 0
    sql   = 'UPDATE checklist SET ' + ', '.join(f'{c}=?' for c in cols)
    sql  += ', preenchido_por=?, data_preenchimento=CURRENT_TIMESTAMP, completo=? WHERE os_id=?'
    db.execute(sql, (*vals, data.get('preenchido_por', ''), comp, oid))
    db.commit(); db.close()
    return jsonify(success=True, completo=comp)

@app.route('/os/<int:oid>/avancar', methods=['POST'])
def avancar_status(oid):
    data = request.get_json() or {}
    db   = get_db()
    os   = db.execute("SELECT * FROM ordens_servico WHERE id=?", (oid,)).fetchone()
    if not os: db.close(); return jsonify(error='OS não encontrada'), 404

    idx = STATUS_KEYS.index(os['status'])
    if idx >= len(STATUS_KEYS) - 1:
        db.close(); return jsonify(error='OS já está no status final'), 400

    # Bloqueia avanço se checklist incompleto ao sair de desenho_andamento
    if os['status'] == 'desenho_andamento':
        cl = db.execute("SELECT completo FROM checklist WHERE os_id=?", (oid,)).fetchone()
        if not cl or not cl['completo']:
            db.close()
            return jsonify(error='⚠️ Checklist deve estar 100% preenchido antes de avançar para o Processista.'), 400

    novo       = STATUS_KEYS[idx + 1]
    data_conc  = date.today().isoformat() if novo == 'liberado_fabrica' else None
    db.execute("UPDATE ordens_servico SET status=?, data_conclusao=? WHERE id=?", (novo, data_conc, oid))
    db.execute('''INSERT INTO historico_status (os_id, status_anterior, status_novo, alterado_por, observacao)
                  VALUES (?,?,?,?,?)''',
               (oid, os['status'], novo, data.get('usuario', 'Sistema'), data.get('obs', '')))
    db.commit(); db.close()
    label, icon = STATUS_DICT[novo]
    return jsonify(success=True, novo_status=novo, label=label, icon=icon)

@app.route('/os/<int:oid>/voltar', methods=['POST'])
def voltar_status(oid):
    data = request.get_json() or {}
    db   = get_db()
    os   = db.execute("SELECT * FROM ordens_servico WHERE id=?", (oid,)).fetchone()
    if not os: db.close(); return jsonify(error='OS não encontrada'), 404

    idx = STATUS_KEYS.index(os['status'])
    if idx == 0: db.close(); return jsonify(error='Já está no primeiro status'), 400

    ant = STATUS_KEYS[idx - 1]
    db.execute("UPDATE ordens_servico SET status=?, data_conclusao=NULL WHERE id=?", (ant, oid))
    db.execute('''INSERT INTO historico_status (os_id, status_anterior, status_novo, alterado_por, observacao)
                  VALUES (?,?,?,?,?)''',
               (oid, os['status'], ant, data.get('usuario', 'Sistema'), data.get('obs', 'Retornado ao status anterior')))
    db.commit(); db.close()
    label, icon = STATUS_DICT[ant]
    return jsonify(success=True, status=ant, label=label, icon=icon)

# ── Kanban ─────────────────────────────────────────────────────────────────────

@app.route('/kanban')
def kanban():
    db    = get_db()
    dados = {}
    for k in STATUS_KEYS:
        dados[k] = db.execute('''
            SELECT o.*,
                   CAST(julianday(o.prazo)-julianday('now') AS INTEGER) AS dias_rest,
                   cl.completo AS checklist_ok
            FROM   ordens_servico o
            LEFT JOIN checklist cl ON cl.os_id = o.id
            WHERE  o.status=? ORDER BY o.prazo ASC
        ''', (k,)).fetchall()
    db.close()
    return render_template('kanban.html', dados=dados)

# ── Erros / NC ─────────────────────────────────────────────────────────────────

@app.route('/erros')
def erros():
    db   = get_db()
    lst  = db.execute('''
        SELECT e.*, o.numero AS os_numero, o.cliente
        FROM   erros_nc e
        LEFT JOIN ordens_servico o ON o.id = e.os_id
        ORDER  BY CASE e.status WHEN 'aberto' THEN 0 ELSE 1 END, e.data_registro DESC
    ''').fetchall()
    stats = {t: db.execute("SELECT COUNT(*) FROM erros_nc WHERE tipo=?", (t,)).fetchone()[0] for t in TIPOS_ERRO}
    oss   = db.execute("SELECT id, numero, cliente FROM ordens_servico ORDER BY numero").fetchall()
    db.close()
    return render_template('erros.html', erros=lst, stats=stats, oss_lista=oss,
                           equipe=EQUIPE_ALL, tipos_erro=TIPOS_ERRO)

@app.route('/erros/novo', methods=['POST'])
def erro_novo():
    f  = request.form
    db = get_db()
    db.execute('''INSERT INTO erros_nc (os_id, tipo, descricao, identificado_por, acao_corretiva)
                  VALUES (?,?,?,?,?)''',
               (f.get('os_id') or None, f['tipo'], f['descricao'],
                f['identificado_por'], f.get('acao_corretiva', '')))
    db.commit(); db.close()
    return redirect(url_for('erros'))

@app.route('/erros/<int:eid>/resolver', methods=['POST'])
def erro_resolver(eid):
    data = request.get_json() or {}
    db   = get_db()
    db.execute('''UPDATE erros_nc SET status='resolvido', acao_corretiva=?,
                  data_resolucao=CURRENT_TIMESTAMP WHERE id=?''',
               (data.get('acao', ''), eid))
    db.commit(); db.close()
    return jsonify(success=True)

# ── Produtividade ──────────────────────────────────────────────────────────────

@app.route('/produtividade')
def produtividade():
    db  = get_db()
    mes = request.args.get('mes', datetime.now().strftime('%Y-%m'))
    dados = []
    for d in DESENHISTAS:
        conc  = db.execute('''SELECT COUNT(*) FROM ordens_servico WHERE responsavel_desenhista=?
                              AND status='liberado_fabrica' AND strftime('%Y-%m',data_conclusao)=?''', (d, mes)).fetchone()[0]
        ativo = db.execute('''SELECT COUNT(*) FROM ordens_servico WHERE responsavel_desenhista=?
                              AND status!='liberado_fabrica' ''', (d,)).fetchone()[0]
        errs  = db.execute('''SELECT COUNT(*) FROM erros_nc e JOIN ordens_servico o ON o.id=e.os_id
                              WHERE o.responsavel_desenhista=? AND strftime('%Y-%m',e.data_registro)=?''', (d, mes)).fetchone()[0]
        total = db.execute('''SELECT COUNT(*) FROM ordens_servico WHERE responsavel_desenhista=?
                              AND strftime('%Y-%m',data_conclusao)=?''', (d, mes)).fetchone()[0]
        praz  = db.execute('''SELECT COUNT(*) FROM ordens_servico WHERE responsavel_desenhista=?
                              AND strftime('%Y-%m',data_conclusao)=? AND data_conclusao<=prazo''', (d, mes)).fetchone()[0]
        taxa  = round(praz / total * 100) if total else 0
        dados.append(dict(desenhista=d, concluidas=conc, em_andamento=ativo,
                          erros=errs, taxa_prazo=taxa, total_mes=total))
    db.close()
    return render_template('produtividade.html', dados=dados, mes=mes)

# ── Relatório ──────────────────────────────────────────────────────────────────

@app.route('/relatorio')
def relatorio():
    db  = get_db()
    mes = request.args.get('mes', datetime.now().strftime('%Y-%m'))

    entregues = db.execute('''SELECT * FROM ordens_servico
                              WHERE status='liberado_fabrica' AND strftime('%Y-%m',data_conclusao)=?
                              ORDER BY data_conclusao DESC''', (mes,)).fetchall()
    atrasadas = db.execute('''SELECT * FROM ordens_servico
                              WHERE status!='liberado_fabrica' AND prazo < date('now')
                              ORDER BY prazo ASC''').fetchall()
    erros_mes = db.execute('''SELECT e.*, o.numero AS os_numero FROM erros_nc e
                              LEFT JOIN ordens_servico o ON o.id=e.os_id
                              WHERE strftime('%Y-%m',e.data_registro)=?
                              ORDER BY e.data_registro DESC''', (mes,)).fetchall()
    ec = {t: db.execute("SELECT COUNT(*) FROM erros_nc WHERE tipo=? AND strftime('%Y-%m',data_registro)=?",
                        (t, mes)).fetchone()[0] for t in TIPOS_ERRO}

    prod = []
    for d in DESENHISTAS:
        conc  = db.execute('''SELECT COUNT(*) FROM ordens_servico WHERE responsavel_desenhista=?
                              AND status='liberado_fabrica' AND strftime('%Y-%m',data_conclusao)=?''', (d, mes)).fetchone()[0]
        atras = db.execute('''SELECT COUNT(*) FROM ordens_servico WHERE responsavel_desenhista=?
                              AND status='liberado_fabrica' AND strftime('%Y-%m',data_conclusao)=?
                              AND data_conclusao>prazo''', (d, mes)).fetchone()[0]
        errs  = db.execute('''SELECT COUNT(*) FROM erros_nc e JOIN ordens_servico o ON o.id=e.os_id
                              WHERE o.responsavel_desenhista=? AND strftime('%Y-%m',e.data_registro)=?''', (d, mes)).fetchone()[0]
        prod.append(dict(desenhista=d, concluidas=conc, atrasadas=atras, erros=errs))

    db.close()
    return render_template('relatorio.html', mes=mes, entregues=entregues, atrasadas=atrasadas,
                           erros_mes=erros_mes, erros_cat=ec, prod=prod)

# ── API JSON ───────────────────────────────────────────────────────────────────

@app.route('/api/stats')
def api_stats():
    db  = get_db()
    mes = datetime.now().strftime('%Y-%m')
    d   = {
        'ativas':         db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status!='liberado_fabrica'").fetchone()[0],
        'atrasadas':      db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status!='liberado_fabrica' AND prazo<date('now')").fetchone()[0],
        'concluidas_mes': db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status='liberado_fabrica' AND strftime('%Y-%m',data_conclusao)=?", (mes,)).fetchone()[0],
        'erros_abertos':  db.execute("SELECT COUNT(*) FROM erros_nc WHERE status='aberto'").fetchone()[0],
        'por_status':     {k: db.execute("SELECT COUNT(*) FROM ordens_servico WHERE status=?", (k,)).fetchone()[0] for k in STATUS_KEYS},
    }
    db.close()
    return jsonify(d)

@app.route('/api/erros-chart')
def api_erros_chart():
    db = get_db()
    d  = {t: db.execute("SELECT COUNT(*) FROM erros_nc WHERE tipo=?", (t,)).fetchone()[0] for t in TIPOS_ERRO}
    db.close()
    return jsonify(d)

# ── Inicialização ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
