"""Script para popular banco com dados de demonstração."""
import sqlite3
from datetime import date, timedelta
import os

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'metalurgica.db')

def run():
    conn = sqlite3.connect(DB)
    c = conn.cursor()

    today = date.today()

    oss = [
        ('OS-2024-001', today - timedelta(days=5),  'Samarco Mineração',     'Redutor Falk 2060J2 – Reforma geral',          'complexa',  'Lucas',   today + timedelta(days=10), 'Revisar todos os rolamentos. Cliente urgente.'),
        ('OS-2024-002', today - timedelta(days=3),  'Vale S.A.',              'Redutor SEW R97 – Troca de eixo',               'media',     'Breno',   today + timedelta(days=12), ''),
        ('OS-2024-003', today - timedelta(days=8),  'Usiminas',               'Caixa redutora Flender B3SH10 – Reparar carcaça','simples',   'Gustavo', today + timedelta(days=2),  'Verificar folgas dos mancais'),
        ('OS-2024-004', today - timedelta(days=12), 'CSN – Cia Siderúrgica',  'Redutor Dodge TXT215 – Revisão completa',       'complexa',  'Wesley',  today - timedelta(days=1),  'URGENTE – linha parada'),
        ('OS-2024-005', today - timedelta(days=2),  'ArcelorMittal',          'Redutor Rexnord 12000 – Substituição engrenagens','media',    'Lucas',   today + timedelta(days=13), ''),
        ('OS-2024-006', today - timedelta(days=6),  'Gerdau',                 'Redutor Radicon W85 – Desmontagem e laudo',     'simples',   'Breno',   today + timedelta(days=9),  ''),
        ('OS-2024-007', today - timedelta(days=10), 'Petrobras',              'Redutor Lufkin 1200 – Reforma total',           'complexa',  'Gustavo', today + timedelta(days=5),  'Peças especiais – verificar com almoxarifado'),
        ('OS-2024-008', today - timedelta(days=1),  'Alcoa Brasil',           'Redutor SEW K97 – Troca de vedações',           'simples',   'Wesley',  today + timedelta(days=14), ''),
    ]

    os_ids = []
    for o in oss:
        try:
            c.execute('''INSERT INTO ordens_servico
                (numero, data_abertura, cliente, descricao_peca, complexidade,
                 responsavel_desenhista, prazo, observacoes)
                VALUES (?,?,?,?,?,?,?,?)''', o)
            oid = c.lastrowid
            os_ids.append(oid)
            c.execute("INSERT INTO checklist (os_id) VALUES (?)", (oid,))
            c.execute('''INSERT INTO historico_status (os_id, status_novo, alterado_por, observacao)
                VALUES (?,'desenho_andamento','Sistema','OS criada')''', (oid,))
        except sqlite3.IntegrityError:
            c.execute("SELECT id FROM ordens_servico WHERE numero=?", (o[0],))
            os_ids.append(c.fetchone()[0])

    # Avançar algumas OSs para status diferentes
    def advance(num, status_novo, status_ant, usuario='Patrick'):
        c.execute("UPDATE ordens_servico SET status=? WHERE numero=?", (status_novo, num))
        c.execute("SELECT id FROM ordens_servico WHERE numero=?", (num,))
        row = c.fetchone()
        if row:
            c.execute('''INSERT INTO historico_status (os_id, status_anterior, status_novo, alterado_por)
                         VALUES (?,?,?,?)''', (row[0], status_ant, status_novo, usuario))

    advance('OS-2024-002', 'com_processista',  'desenho_andamento', 'Breno')
    advance('OS-2024-003', 'com_processista',  'desenho_andamento', 'Gustavo')
    advance('OS-2024-003', 'revisao_desenho',  'com_processista',   'Processista 1')
    advance('OS-2024-006', 'revisao_processo', 'revisao_desenho',   'Patrick')
    advance('OS-2024-007', 'com_processista',  'desenho_andamento', 'Gustavo')

    # Checklist completo para OS-002 (que avançou)
    c.execute('''UPDATE checklist SET
        cotas_montagem=1, tolerancias_ajuste=1, acabamento_superficial=1,
        material_cabecalho=1, dimensoes_conferidas=1, chaveta_rosca_furo=1,
        vista_corte=1, escala_legivel=1, preenchido_por='Breno',
        data_preenchimento=CURRENT_TIMESTAMP, completo=1
        WHERE os_id=(SELECT id FROM ordens_servico WHERE numero='OS-2024-002')''')

    # OS concluída este mês
    c.execute('''INSERT OR IGNORE INTO ordens_servico
        (numero, data_abertura, cliente, descricao_peca, complexidade,
         responsavel_desenhista, prazo, observacoes, status, data_conclusao)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',
        ('OS-2024-C01', today - timedelta(days=20), 'Braskem',
         'Redutor SEW F97 – Revisão preventiva',
         'media', 'Lucas',
         today - timedelta(days=5), '',
         'liberado_fabrica', (today - timedelta(days=6)).isoformat()))

    c.execute('''INSERT OR IGNORE INTO ordens_servico
        (numero, data_abertura, cliente, descricao_peca, complexidade,
         responsavel_desenhista, prazo, observacoes, status, data_conclusao)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',
        ('OS-2024-C02', today - timedelta(days=18), 'Votorantim',
         'Caixa Sumitomo RNHJ – Troca de mancais',
         'simples', 'Wesley',
         today - timedelta(days=3), '',
         'liberado_fabrica', (today - timedelta(days=4)).isoformat()))

    # Erros de exemplo
    erros = [
        ('OS-2024-001', 'erro_engenharia',  'Cota de montagem do rolamento ausente na vista de corte', 'Patrick', 'Corrigir e revisar toda a prancha', 'aberto'),
        ('OS-2024-003', 'erro_engenharia',  'Tolerância de ajuste H7/k6 incorreta no colo do eixo',   'Breno',   'Conferir tabela ISO e corrigir', 'resolvido'),
        ('OS-2024-004', 'erro_fabrica',     'Usinagem do eixo fora de tolerância (0.08mm acima)',       'Wesley',  'Retornar para usinagem – retrabalho', 'aberto'),
        ('OS-2024-002', 'pendencia_vendas', 'Modelo exato do redutor não confirmado pelo cliente',       'Lucas',   '', 'aberto'),
        (None,          'erro_processo',    'Sequência de montagem incorreta no roteiro de fabricação', 'Processista 1', 'Corrigir roteiro e revalidar', 'resolvido'),
    ]
    for os_num, tipo, desc, ident, acao, status in erros:
        os_id = None
        if os_num:
            c.execute("SELECT id FROM ordens_servico WHERE numero=?", (os_num,))
            row = c.fetchone()
            if row: os_id = row[0]
        res_date = 'CURRENT_TIMESTAMP' if status == 'resolvido' else 'NULL'
        c.execute(f'''INSERT INTO erros_nc (os_id, tipo, descricao, identificado_por, acao_corretiva, status{', data_resolucao' if status=='resolvido' else ''})
                      VALUES (?,?,?,?,?,?{',CURRENT_TIMESTAMP' if status=='resolvido' else ''})''',
                  (os_id, tipo, desc, ident, acao, status))

    conn.commit()
    conn.close()
    print("✅ Dados de demonstração inseridos com sucesso!")

if __name__ == '__main__':
    run()
