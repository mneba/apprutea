-- =====================================================================
-- Correção: RENOVACAO_EXCEDE_ANTERIOR perde a data/parcelas/taxa do
-- vendedor ao ser bloqueada. Espelha o padrão de vendas_pendentes.
-- Rode este arquivo inteiro no SQL Editor do Supabase, em ordem.
-- =====================================================================

-- 1) Tabela de staging (espelha vendas_pendentes, sem os campos de
--    cadastro de cliente novo, pois o cliente já existe)
CREATE TABLE IF NOT EXISTS public.renovacoes_pendentes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL,
    emprestimo_anterior_id uuid,
    vendedor_id uuid NOT NULL,
    rota_id uuid NOT NULL,
    empresa_id uuid,
    solicitacao_id uuid,
    status character varying(20) NOT NULL DEFAULT 'PENDENTE',
    valor_principal numeric(15,2) NOT NULL,
    numero_parcelas integer NOT NULL,
    taxa_juros numeric(8,2) NOT NULL DEFAULT 0,
    frequencia character varying(20) NOT NULL,
    data_primeiro_vencimento date NOT NULL,
    dia_semana_cobranca integer,
    dia_mes_cobranca integer,
    dias_mes_cobranca integer[],
    iniciar_proximo_mes boolean DEFAULT false,
    observacoes_emprestimo text,
    microseguro_valor numeric(15,2),
    valor_limite numeric(15,2),
    valor_aprovado numeric(15,2),
    motivo_alteracao text,
    motivo_rejeicao text,
    latitude numeric,
    longitude numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT renovacoes_pendentes_pkey PRIMARY KEY (id),
    CONSTRAINT renovacoes_pendentes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
    CONSTRAINT renovacoes_pendentes_emprestimo_anterior_id_fkey FOREIGN KEY (emprestimo_anterior_id) REFERENCES public.emprestimos(id),
    CONSTRAINT renovacoes_pendentes_rota_id_fkey FOREIGN KEY (rota_id) REFERENCES public.rotas(id),
    CONSTRAINT renovacoes_pendentes_solicitacao_id_fkey FOREIGN KEY (solicitacao_id) REFERENCES public.solicitacoes_autorizacao(id) ON DELETE SET NULL,
    CONSTRAINT renovacoes_pendentes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES public.vendedores(id) ON DELETE CASCADE,
    CONSTRAINT chk_renovacoes_pendentes_status CHECK (status::text = ANY (ARRAY['PENDENTE','APROVADO','REJEITADO','CONCLUIDO','CANCELADO']::text[]))
);

CREATE INDEX IF NOT EXISTS idx_renovacoes_pendentes_rota ON public.renovacoes_pendentes (rota_id);
CREATE INDEX IF NOT EXISTS idx_renovacoes_pendentes_vendedor ON public.renovacoes_pendentes (vendedor_id);
CREATE INDEX IF NOT EXISTS idx_renovacoes_pendentes_cliente ON public.renovacoes_pendentes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_renovacoes_pendentes_solicitacao ON public.renovacoes_pendentes (solicitacao_id) WHERE solicitacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_renovacoes_pendentes_status ON public.renovacoes_pendentes (status) WHERE status::text = ANY (ARRAY['PENDENTE','APROVADO']::text[]);

ALTER TABLE public.renovacoes_pendentes OWNER TO postgres;
GRANT ALL ON TABLE public.renovacoes_pendentes TO anon;
GRANT ALL ON TABLE public.renovacoes_pendentes TO authenticated;
GRANT ALL ON TABLE public.renovacoes_pendentes TO postgres;
GRANT ALL ON TABLE public.renovacoes_pendentes TO service_role;

CREATE OR REPLACE TRIGGER tr_renovacoes_pendentes_updated_at
    BEFORE UPDATE ON public.renovacoes_pendentes
    FOR EACH ROW EXECUTE FUNCTION public.trigger_updated_at();

COMMENT ON TABLE public.renovacoes_pendentes IS
  'Renovações que excedem o valor do último empréstimo quitado e aguardam aprovação do admin. fn_renovar_emprestimo materializa o empréstimo ao consumir a aprovação.';

-- 2) Link a partir de solicitacoes_autorizacao
ALTER TABLE public.solicitacoes_autorizacao
  ADD COLUMN IF NOT EXISTS renovacao_pendente_id uuid REFERENCES public.renovacoes_pendentes(id) ON DELETE SET NULL;

-- =====================================================================
-- 3) fn_renovar_emprestimo — troca só o bloco de validação que
--    bloqueia/consome a renovação que excede o empréstimo anterior.
--    Resto da função idêntico ao original.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_renovar_emprestimo(p_cliente_id uuid, p_empresa_id uuid, p_rota_id uuid, p_vendedor_id uuid, p_user_id uuid, p_valor_principal numeric, p_numero_parcelas integer, p_taxa_juros numeric, p_frequencia character varying, p_data_primeiro_vencimento date, p_dia_semana_cobranca integer DEFAULT NULL::integer, p_dia_mes_cobranca integer DEFAULT NULL::integer, p_dias_mes_cobranca integer[] DEFAULT NULL::integer[], p_iniciar_proximo_mes boolean DEFAULT false, p_microseguro_valor numeric DEFAULT NULL::numeric, p_observacoes text DEFAULT NULL::text, p_latitude numeric DEFAULT NULL::numeric, p_longitude numeric DEFAULT NULL::numeric, p_produto_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(sucesso boolean, mensagem text, cliente_id uuid, cliente_nome character varying, emprestimo_anterior_id uuid, novo_emprestimo_id uuid, valor_total numeric, valor_parcela numeric, microseguro_id uuid, microseguro_valor numeric, parcelas jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_cliente RECORD;
    v_emprestimo_anterior RECORD;
    v_novo_emprestimo_id UUID;
    v_microseguro_id UUID;
    v_valor_total NUMERIC;
    v_valor_parcela NUMERIC;
    v_valor_juros NUMERIC;
    v_liquidacao_id UUID;
    v_parcelas JSONB;
    v_tipo_emprestimo VARCHAR;
    v_parcelas_hoje INTEGER := 0;
    v_valor_esperado_hoje NUMERIC := 0;
    v_data_liquidacao DATE;
    v_produto_id UUID;
BEGIN
    -- ═══════════════════════════════════════════════════════════════════════
    -- VALIDAÇÕES BÁSICAS
    -- ═══════════════════════════════════════════════════════════════════════

    IF p_cliente_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'cliente_id é obrigatório'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_empresa_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'empresa_id é obrigatório'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_rota_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'rota_id é obrigatório'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_vendedor_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'vendedor_id é obrigatório'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'user_id é obrigatório'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM rotas r
        WHERE r.id = p_rota_id AND r.vendedor_id = p_vendedor_id AND r.empresa_id = p_empresa_id
    ) THEN
        RETURN QUERY SELECT FALSE,
            'Vendedor não autorizado para esta rota ou empresa divergente'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_valor_principal IS NULL OR p_valor_principal <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Valor do empréstimo deve ser maior que zero'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_numero_parcelas IS NULL OR p_numero_parcelas <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Número de parcelas deve ser maior que zero'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_taxa_juros IS NULL OR p_taxa_juros < 0 THEN
        RETURN QUERY SELECT FALSE, 'Taxa de juros inválida'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_frequencia IS NULL OR p_frequencia NOT IN ('DIARIO','SEMANAL','QUINZENAL','MENSAL','FLEXIVEL') THEN
        RETURN QUERY SELECT FALSE, 'Frequência inválida'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_data_primeiro_vencimento IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Data do primeiro vencimento é obrigatória'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_frequencia = 'SEMANAL' AND p_dia_semana_cobranca IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Dia da semana obrigatório para SEMANAL'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_frequencia = 'MENSAL' AND p_dia_mes_cobranca IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Dia do mês obrigatório para MENSAL'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF p_frequencia = 'FLEXIVEL' AND (p_dias_mes_cobranca IS NULL OR array_length(p_dias_mes_cobranca,1) = 0) THEN
        RETURN QUERY SELECT FALSE, 'Dias do mês obrigatórios para FLEXIVEL'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- RESOLVER PRODUTO
    -- ═══════════════════════════════════════════════════════════════════════

    v_produto_id := p_produto_id;
    IF v_produto_id IS NULL THEN
        SELECT p.id INTO v_produto_id FROM produtos p
        WHERE p.empresa_id = p_empresa_id AND p.is_padrao = true AND p.ativo = true LIMIT 1;
        IF v_produto_id IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Nenhum produto padrão configurado para a empresa'::TEXT,
                NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
                NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- VALIDAR CLIENTE
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT c.id, c.nome, c.status INTO v_cliente
    FROM clientes c WHERE c.id = p_cliente_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Cliente não encontrado'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    IF v_cliente.status = 'SUSPENSO' THEN
        RETURN QUERY SELECT FALSE, format('Cliente suspenso (status: %s)', v_cliente.status)::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- VERIFICAR LIQUIDAÇÃO ABERTA
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT ld.id, ld.data_abertura::DATE INTO v_liquidacao_id, v_data_liquidacao
    FROM liquidacoes_diarias ld
    WHERE ld.rota_id = p_rota_id AND ld.status IN ('ABERTO','REABERTO') LIMIT 1;

    IF v_liquidacao_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Não há liquidação aberta para esta rota.'::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- VALIDAR SALDO
    -- ═══════════════════════════════════════════════════════════════════════

    DECLARE
        v_saldo_valido BOOLEAN; v_saldo_msg TEXT;
    BEGIN
        SELECT t.valido, t.mensagem INTO v_saldo_valido, v_saldo_msg
        FROM fn_validar_saldo_emprestimo(v_liquidacao_id, p_valor_principal) t;
        IF NOT v_saldo_valido THEN
            RETURN QUERY SELECT FALSE, v_saldo_msg,
                NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
                NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
        END IF;
    END;

    -- ═══════════════════════════════════════════════════════════════════════
    -- VALIDAR TAXA DE JUROS
    -- ═══════════════════════════════════════════════════════════════════════

    DECLARE
        v_taxa_valida BOOLEAN; v_taxa_msg TEXT;
    BEGIN
        SELECT t.valido, t.mensagem INTO v_taxa_valida, v_taxa_msg
        FROM fn_validar_taxa_juros(p_vendedor_id, p_taxa_juros) t;
        IF NOT v_taxa_valida THEN
            RETURN QUERY SELECT FALSE, v_taxa_msg,
                NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
                NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
        END IF;
    END;

    -- ═══════════════════════════════════════════════════════════════════════
    -- VERIFICAR EMPRÉSTIMO EM ABERTO
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT e.id, e.status, e.valor_saldo INTO v_emprestimo_anterior
    FROM emprestimos e
    WHERE e.cliente_id = p_cliente_id AND e.rota_id = p_rota_id
    AND e.status IN ('ATIVO','VENCIDO')
    ORDER BY e.created_at DESC LIMIT 1;

    IF FOUND THEN
        RETURN QUERY SELECT FALSE,
            format('Cliente possui empréstimo em aberto (Saldo: $ %s). Quite primeiro.',
                   v_emprestimo_anterior.valor_saldo)::TEXT,
            NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID, NULL::NUMERIC,
            NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB; RETURN;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- BUSCAR ÚLTIMO EMPRÉSTIMO QUITADO
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT e.id, e.valor_principal INTO v_emprestimo_anterior
    FROM emprestimos e
    WHERE e.cliente_id = p_cliente_id AND e.rota_id = p_rota_id AND e.status = 'QUITADO'
    ORDER BY e.created_at DESC LIMIT 1;

    -- ═══════════════════════════════════════════════════════════════════════
    -- ⭐ VALIDAÇÃO: valor da renovação não pode exceder o último quitado
    -- Se exceder: verifica aprovação (via renovacoes_pendentes); caso
    -- contrário persiste os termos pedidos e bloqueia.
    -- ═══════════════════════════════════════════════════════════════════════

    IF v_emprestimo_anterior.id IS NOT NULL
       AND p_valor_principal > v_emprestimo_anterior.valor_principal
       AND COALESCE((
           SELECT rv.validar_valor_max_renovacoes
           FROM restricoes_vendedor rv
           WHERE rv.vendedor_id = p_vendedor_id
       ), TRUE)
    THEN
        DECLARE
            v_solic_aprovada_id UUID;
            v_renovacao_pendente_id UUID;
        BEGIN
            -- Verificar se há aprovação (solicitação + staging) para este valor exato
            SELECT sa.id, rp.id INTO v_solic_aprovada_id, v_renovacao_pendente_id
            FROM solicitacoes_autorizacao sa
            JOIN renovacoes_pendentes rp ON rp.id = sa.renovacao_pendente_id
            WHERE sa.cliente_id = p_cliente_id
              AND sa.rota_id = p_rota_id
              AND sa.tipo_solicitacao = 'RENOVACAO_EXCEDE_ANTERIOR'
              AND sa.status = 'APROVADO'
              AND rp.status = 'APROVADO'
              AND rp.valor_aprovado = p_valor_principal
            ORDER BY sa.created_at DESC
            LIMIT 1;

            IF v_solic_aprovada_id IS NOT NULL THEN
                -- Aprovação encontrada — consumir e prosseguir com a renovação
                UPDATE solicitacoes_autorizacao sa
                SET status = 'CANCELADO',
                    motivo_resolucao = 'Renovação efetivada pelo vendedor',
                    data_resolucao = NOW()
                WHERE sa.id = v_solic_aprovada_id;

                UPDATE renovacoes_pendentes
                SET status = 'CONCLUIDO'
                WHERE id = v_renovacao_pendente_id;
                -- cai fora do bloco e segue normalmente
            ELSE
                -- Sem aprovação — cancelar pendentes e criar nova solicitação,
                -- persistindo os termos exatamente como o vendedor pediu.
                UPDATE renovacoes_pendentes rp
                SET status = 'CANCELADO'
                WHERE rp.id IN (
                    SELECT sa.renovacao_pendente_id
                    FROM solicitacoes_autorizacao sa
                    WHERE sa.cliente_id = p_cliente_id
                      AND sa.tipo_solicitacao = 'RENOVACAO_EXCEDE_ANTERIOR'
                      AND sa.status = 'PENDENTE'
                );

                UPDATE solicitacoes_autorizacao sa
                SET status = 'CANCELADO',
                    motivo_resolucao = 'Substituída por nova solicitação',
                    data_resolucao = NOW()
                WHERE sa.cliente_id = p_cliente_id
                  AND sa.tipo_solicitacao = 'RENOVACAO_EXCEDE_ANTERIOR'
                  AND sa.status = 'PENDENTE';

                INSERT INTO renovacoes_pendentes (
                    cliente_id, emprestimo_anterior_id, vendedor_id, rota_id, empresa_id,
                    valor_principal, numero_parcelas, taxa_juros, frequencia,
                    data_primeiro_vencimento, dia_semana_cobranca, dia_mes_cobranca,
                    dias_mes_cobranca, iniciar_proximo_mes, observacoes_emprestimo,
                    microseguro_valor, valor_limite, latitude, longitude
                ) VALUES (
                    p_cliente_id, v_emprestimo_anterior.id, p_vendedor_id, p_rota_id, p_empresa_id,
                    p_valor_principal, p_numero_parcelas, p_taxa_juros, p_frequencia,
                    p_data_primeiro_vencimento, p_dia_semana_cobranca, p_dia_mes_cobranca,
                    p_dias_mes_cobranca, p_iniciar_proximo_mes, p_observacoes,
                    p_microseguro_valor, v_emprestimo_anterior.valor_principal, p_latitude, p_longitude
                ) RETURNING id INTO v_renovacao_pendente_id;

                INSERT INTO solicitacoes_autorizacao (
                    vendedor_id, rota_id, tipo_solicitacao, cliente_id, emprestimo_id,
                    valor_solicitado, valor_limite, motivo_solicitacao, status, created_at,
                    renovacao_pendente_id
                ) VALUES (
                    p_vendedor_id, p_rota_id, 'RENOVACAO_EXCEDE_ANTERIOR',
                    p_cliente_id, v_emprestimo_anterior.id,
                    p_valor_principal, v_emprestimo_anterior.valor_principal,
                    format(
                        'Renovação de $ %s excede o último empréstimo quitado de $ %s para o cliente %s.',
                        p_valor_principal, v_emprestimo_anterior.valor_principal, v_cliente.nome
                    ),
                    'PENDENTE', NOW(),
                    v_renovacao_pendente_id
                )
                RETURNING id INTO v_solic_aprovada_id;

                UPDATE renovacoes_pendentes
                SET solicitacao_id = v_solic_aprovada_id
                WHERE id = v_renovacao_pendente_id;

                RETURN QUERY SELECT
                    FALSE,
                    format(
                        '[AUTORIZAÇÃO] A renovação de $ %s excede o valor do último empréstimo ($ %s). Uma solicitação foi enviada ao administrador.',
                        p_valor_principal,
                v_emprestimo_anterior.valor_principal
            )::TEXT,
                    NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID,
                    NULL::NUMERIC, NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB;
                RETURN;
            END IF;
        END;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- DEFINIR TIPO DE EMPRÉSTIMO
    -- ═══════════════════════════════════════════════════════════════════════

    v_tipo_emprestimo := CASE
        WHEN v_emprestimo_anterior.id IS NOT NULL THEN 'RENOVACAO'
        ELSE 'NOVO'
    END;

    -- ═══════════════════════════════════════════════════════════════════════
    -- CRIAR EMPRÉSTIMO
    -- ═══════════════════════════════════════════════════════════════════════

    v_valor_total := p_valor_principal * (1 + p_taxa_juros / 100);
    v_valor_juros := v_valor_total - p_valor_principal;
    v_valor_parcela := ROUND(v_valor_total / p_numero_parcelas, 2);

    INSERT INTO emprestimos (
        cliente_id, rota_id, empresa_id, vendedor_id, liquidacao_id, produto_id,
        emprestimo_origem_id, valor_principal, numero_parcelas, numero_parcelas_pagas,
        numero_parcelas_restantes, taxa_juros, valor_total, valor_parcela, valor_saldo,
        total_pago, frequencia_pagamento, data_emprestimo, data_primeiro_vencimento,
        dia_semana_cobranca, dia_mes_cobranca, dias_mes_cobranca, iniciar_proximo_mes,
        tipo_emprestimo, status, observacoes, criado_por_user_id,
        latitude_ultimo_pagamento, longitude_ultimo_pagamento
    ) VALUES (
        p_cliente_id, p_rota_id, p_empresa_id, p_vendedor_id, v_liquidacao_id, v_produto_id,
        v_emprestimo_anterior.id, p_valor_principal, p_numero_parcelas, 0,
        p_numero_parcelas, p_taxa_juros, v_valor_total, v_valor_parcela, v_valor_total,
        0, p_frequencia, CURRENT_DATE, p_data_primeiro_vencimento,
        p_dia_semana_cobranca, p_dia_mes_cobranca, p_dias_mes_cobranca, p_iniciar_proximo_mes,
        v_tipo_emprestimo, 'ATIVO',
        CASE WHEN v_emprestimo_anterior.id IS NOT NULL
            THEN format('Renovação do empréstimo %s. %s',
                        v_emprestimo_anterior.id, COALESCE(p_observacoes,''))
            ELSE COALESCE(p_observacoes,'Novo empréstimo')
        END,
        p_user_id, p_latitude, p_longitude
    ) RETURNING id INTO v_novo_emprestimo_id;

    -- ═══════════════════════════════════════════════════════════════════════
    -- CONTAR PARCELAS QUE VENCEM HOJE + ATUALIZAR LIQUIDAÇÃO
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT COUNT(*), COALESCE(SUM(ep.valor_parcela),0)
    INTO v_parcelas_hoje, v_valor_esperado_hoje
    FROM emprestimo_parcelas ep
    WHERE ep.emprestimo_id = v_novo_emprestimo_id
    AND ep.data_vencimento <= v_data_liquidacao
    AND ep.status IN ('PENDENTE','VENCIDO');

    UPDATE liquidacoes_diarias SET
        total_emprestado_dia  = total_emprestado_dia + p_valor_principal,
        total_juros_dia       = total_juros_dia + v_valor_juros,
        qtd_emprestimos_dia   = qtd_emprestimos_dia + 1,
        clientes_renovados    = CASE WHEN v_tipo_emprestimo = 'RENOVACAO'
                                     THEN clientes_renovados + 1
                                     ELSE clientes_renovados END,
        clientes_novos        = CASE WHEN v_tipo_emprestimo = 'NOVO'
                                     THEN clientes_novos + 1
                                     ELSE clientes_novos END,
        caixa_final           = caixa_final - p_valor_principal,
        carteira_final        = carteira_final + v_valor_total,
        valor_esperado_dia    = valor_esperado_dia + v_valor_esperado_hoje,
        pagamentos_nao_pagos  = pagamentos_nao_pagos + v_parcelas_hoje,
        percentual_recebimento = CASE
            WHEN (valor_esperado_dia + v_valor_esperado_hoje) > 0
            THEN LEAST(
                (valor_recebido_dia / (valor_esperado_dia + v_valor_esperado_hoje)) * 100,
                999.99
            )
            ELSE 0
        END,
        updated_at = NOW()
    WHERE id = v_liquidacao_id;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MICROSEGURO
    -- ═══════════════════════════════════════════════════════════════════════

    IF p_microseguro_valor IS NOT NULL AND p_microseguro_valor > 0 THEN
        DECLARE v_ms_sucesso BOOLEAN; v_ms_mensagem TEXT;
        BEGIN
            SELECT t.sucesso, t.mensagem, t.venda_id
            INTO v_ms_sucesso, v_ms_mensagem, v_microseguro_id
            FROM fn_vender_microseguro_cliente_existente(
                p_cliente_id  := p_cliente_id,
                p_valor       := p_microseguro_valor,
                p_vendedor_id := p_vendedor_id,
                p_rota_id     := p_rota_id,
                p_user_id     := p_user_id,
                p_emprestimo_id := v_novo_emprestimo_id,
                p_latitude    := p_latitude,
                p_longitude   := p_longitude
            ) t;
            IF NOT v_ms_sucesso THEN
                RAISE WARNING 'Microseguro não registrado: %', v_ms_mensagem;
                v_microseguro_id := NULL;
            END IF;
        END;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- BUSCAR PARCELAS GERADAS
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT jsonb_agg(jsonb_build_object(
        'numero', ep.numero_parcela,
        'vencimento', ep.data_vencimento,
        'valor', ep.valor_parcela,
        'status', ep.status
    ) ORDER BY ep.numero_parcela)
    INTO v_parcelas
    FROM emprestimo_parcelas ep WHERE ep.emprestimo_id = v_novo_emprestimo_id;

    -- ═══════════════════════════════════════════════════════════════════════
    -- RETORNO
    -- ═══════════════════════════════════════════════════════════════════════

    RETURN QUERY SELECT
        TRUE,
        format('%s registrada com sucesso',
               CASE WHEN v_tipo_emprestimo = 'RENOVACAO' THEN 'Renovação' ELSE 'Venda' END)::TEXT,
        p_cliente_id, v_cliente.nome::VARCHAR,
        v_emprestimo_anterior.id, v_novo_emprestimo_id,
        v_valor_total, v_valor_parcela,
        v_microseguro_id, p_microseguro_valor, v_parcelas;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, 'Erro: ' || SQLERRM,
        NULL::UUID, NULL::VARCHAR, NULL::UUID, NULL::UUID,
        NULL::NUMERIC, NULL::NUMERIC, NULL::UUID, NULL::NUMERIC, NULL::JSONB;
END;
$function$;

-- =====================================================================
-- 4) fn_buscar_detalhes_renovacao_pendente — espelha
--    fn_buscar_detalhes_venda_pendente, usada pelo painel web.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_buscar_detalhes_renovacao_pendente(p_renovacao_pendente_id uuid)
 RETURNS TABLE(
    id uuid, cliente_id uuid, cliente_nome text, cliente_documento text,
    emprestimo_anterior_id uuid, vendedor_id uuid, rota_id uuid, empresa_id uuid,
    solicitacao_id uuid, status character varying,
    valor_principal numeric, numero_parcelas integer, taxa_juros numeric,
    frequencia character varying, data_primeiro_vencimento date,
    dia_semana_cobranca integer, dia_mes_cobranca integer, dias_mes_cobranca integer[],
    iniciar_proximo_mes boolean, observacoes_emprestimo text, microseguro_valor numeric,
    valor_limite numeric, valor_aprovado numeric, motivo_alteracao text, motivo_rejeicao text,
    created_at timestamp with time zone
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        rp.id,
        rp.cliente_id,
        c.nome::text AS cliente_nome,
        c.documento::text AS cliente_documento,
        rp.emprestimo_anterior_id,
        rp.vendedor_id,
        rp.rota_id,
        rp.empresa_id,
        rp.solicitacao_id,
        rp.status,
        rp.valor_principal,
        rp.numero_parcelas,
        rp.taxa_juros,
        rp.frequencia,
        rp.data_primeiro_vencimento,
        rp.dia_semana_cobranca,
        rp.dia_mes_cobranca,
        rp.dias_mes_cobranca,
        rp.iniciar_proximo_mes,
        rp.observacoes_emprestimo,
        rp.microseguro_valor,
        rp.valor_limite,
        rp.valor_aprovado,
        rp.motivo_alteracao,
        rp.motivo_rejeicao,
        rp.created_at
    FROM renovacoes_pendentes rp
    LEFT JOIN clientes c ON c.id = rp.cliente_id
    WHERE rp.id = p_renovacao_pendente_id;
END;
$function$;

-- =====================================================================
-- 5) fn_resolver_renovacao_pendente — espelha fn_resolver_venda_pendente,
--    sem os campos de cadastro de cliente (não se aplicam aqui).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_resolver_renovacao_pendente(p_renovacao_pendente_id uuid, p_acao character varying, p_admin_user_id uuid, p_motivo text DEFAULT NULL::text, p_dados_editados jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(sucesso boolean, mensagem text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_solicitacao_id uuid;
    v_status_atual varchar;
BEGIN
    SELECT solicitacao_id, status
    INTO v_solicitacao_id, v_status_atual
    FROM renovacoes_pendentes
    WHERE id = p_renovacao_pendente_id;

    IF v_solicitacao_id IS NULL AND v_status_atual IS NULL THEN
        RETURN QUERY SELECT false, 'Renovação pendente não encontrada'::text;
        RETURN;
    END IF;

    IF v_status_atual <> 'PENDENTE' THEN
        RETURN QUERY SELECT false, format('Esta renovação já foi %s', v_status_atual)::text;
        RETURN;
    END IF;

    IF p_acao = 'APROVAR' THEN
        IF p_dados_editados IS NOT NULL THEN
            UPDATE renovacoes_pendentes SET
                valor_principal          = COALESCE((p_dados_editados->>'valor_principal')::numeric, valor_principal),
                numero_parcelas          = COALESCE((p_dados_editados->>'numero_parcelas')::integer, numero_parcelas),
                taxa_juros               = COALESCE((p_dados_editados->>'taxa_juros')::numeric, taxa_juros),
                frequencia               = COALESCE((p_dados_editados->>'frequencia')::varchar, frequencia),
                data_primeiro_vencimento = COALESCE((p_dados_editados->>'data_primeiro_vencimento')::date, data_primeiro_vencimento),
                dia_semana_cobranca      = COALESCE((p_dados_editados->>'dia_semana_cobranca')::integer, dia_semana_cobranca),
                dia_mes_cobranca         = COALESCE((p_dados_editados->>'dia_mes_cobranca')::integer, dia_mes_cobranca),
                iniciar_proximo_mes      = COALESCE((p_dados_editados->>'iniciar_proximo_mes')::boolean, iniciar_proximo_mes),
                observacoes_emprestimo   = COALESCE(p_dados_editados->>'observacoes_emprestimo', observacoes_emprestimo),
                microseguro_valor        = COALESCE((p_dados_editados->>'microseguro_valor')::numeric, microseguro_valor),
                valor_aprovado           = COALESCE((p_dados_editados->>'valor_aprovado')::numeric, (p_dados_editados->>'valor_principal')::numeric, valor_principal)
            WHERE id = p_renovacao_pendente_id;
        ELSE
            UPDATE renovacoes_pendentes SET
                valor_aprovado = valor_principal
            WHERE id = p_renovacao_pendente_id;
        END IF;

        UPDATE renovacoes_pendentes SET status = 'APROVADO' WHERE id = p_renovacao_pendente_id;

        IF v_solicitacao_id IS NOT NULL THEN
            UPDATE solicitacoes_autorizacao SET
                status = 'APROVADO',
                resolvido_por = p_admin_user_id,
                data_resolucao = now(),
                motivo_resolucao = p_motivo
            WHERE id = v_solicitacao_id;
        END IF;

        RETURN QUERY SELECT true, 'Renovação aprovada com sucesso'::text;

    ELSIF p_acao = 'REJEITAR' THEN
        UPDATE renovacoes_pendentes SET
            status = 'REJEITADO',
            motivo_rejeicao = p_motivo
        WHERE id = p_renovacao_pendente_id;

        IF v_solicitacao_id IS NOT NULL THEN
            UPDATE solicitacoes_autorizacao SET
                status = 'REJEITADO',
                resolvido_por = p_admin_user_id,
                data_resolucao = now(),
                motivo_resolucao = p_motivo
            WHERE id = v_solicitacao_id;
        END IF;

        RETURN QUERY SELECT true, 'Renovação rejeitada'::text;

    ELSE
        RETURN QUERY SELECT false, 'Ação inválida (use APROVAR ou REJEITAR)'::text;
    END IF;
END;
$function$;

-- =====================================================================
-- 6) fn_listar_solicitacoes_central — só adiciona renovacao_pendente_id
--    ao RETURNS TABLE e ao SELECT, igual já existe para venda_pendente_id.
--    Resto idêntico ao original que você mandou.
--    DROP necessário: mudar as colunas do RETURNS TABLE não é permitido
--    via CREATE OR REPLACE puro.
-- =====================================================================
DROP FUNCTION IF EXISTS public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[]);

CREATE OR REPLACE FUNCTION public.fn_listar_solicitacoes_central(
	p_user_id uuid,
	p_status character varying DEFAULT NULL::character varying,
	p_rota_id uuid DEFAULT NULL::uuid,
	p_tipo character varying DEFAULT NULL::character varying,
	p_limite integer DEFAULT 50,
	p_offset integer DEFAULT 0,
	p_empresa_id uuid DEFAULT NULL::uuid,
	p_cliente text DEFAULT NULL::text,
	p_data_solicitada date DEFAULT NULL::date,
	p_busca text DEFAULT NULL::text,
	p_tipos text[] DEFAULT NULL::text[])
    RETURNS TABLE(id uuid, tipo_solicitacao character varying, data_solicitada date, motivo_solicitacao text, status character varying, created_at timestamp with time zone, expira_em timestamp with time zone, vendedor_id uuid, vendedor_nome character varying, vendedor_codigo character varying, rota_id uuid, rota_nome character varying, empresa_id uuid, empresa_nome character varying, cliente_id uuid, cliente_nome character varying, emprestimo_id uuid, parcela_id uuid, valor_solicitado numeric, valor_limite numeric, resolvido_por uuid, resolvido_por_nome character varying, data_resolucao timestamp with time zone, motivo_resolucao text, ja_visualizada boolean, venda_pendente_id uuid, renovacao_pendente_id uuid, pais character varying, estado character varying, cidade_nome character varying)
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE SECURITY DEFINER PARALLEL UNSAFE
    ROWS 1000

AS $BODY$
DECLARE
    v_empresas_ids JSONB;
    v_tipo_usuario VARCHAR;
    v_busca TEXT := NULLIF(TRIM(COALESCE(p_busca, '')), '');
    v_cliente TEXT := NULLIF(TRIM(COALESCE(p_cliente, '')), '');
BEGIN
    SELECT empresas_ids, tipo_usuario INTO v_empresas_ids, v_tipo_usuario
    FROM user_profiles
    WHERE user_id = p_user_id;

    RETURN QUERY
    SELECT
        s.id, s.tipo_solicitacao, s.data_solicitada, s.motivo_solicitacao, s.status,
        s.created_at, s.expira_em, s.vendedor_id,
        v.nome AS vendedor_nome, v.codigo_vendedor AS vendedor_codigo,
        s.rota_id, r.nome AS rota_nome, r.empresa_id, e.nome AS empresa_nome,
        s.cliente_id, COALESCE(c.nome, vp.cliente_nome)::varchar AS cliente_nome,
        s.emprestimo_id, s.parcela_id, s.valor_solicitado, s.valor_limite,
        s.resolvido_por, up.nome AS resolvido_por_nome, s.data_resolucao, s.motivo_resolucao,
        COALESCE(s.visualizado_por @> jsonb_build_array(p_user_id::TEXT), FALSE) AS ja_visualizada,
        s.venda_pendente_id,
        s.renovacao_pendente_id,
        h.pais, h.estado, ci.nome AS cidade_nome
    FROM solicitacoes_autorizacao s
    JOIN vendedores v ON s.vendedor_id = v.id
    JOIN rotas r ON s.rota_id = r.id
    LEFT JOIN empresas e ON e.id = r.empresa_id
    LEFT JOIN hierarquias h ON h.id = e.hierarquia_id
    LEFT JOIN cidades ci ON ci.id = e.cidade_id
    LEFT JOIN clientes c ON s.cliente_id = c.id
    LEFT JOIN vendas_pendentes vp ON vp.id = s.venda_pendente_id
    LEFT JOIN user_profiles up ON s.resolvido_por = up.user_id
    WHERE
      (
          v_tipo_usuario = 'SUPER_ADMIN'
          OR v_empresas_ids IS NULL
          OR v_empresas_ids = '[]'::JSONB
          OR EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(v_empresas_ids) el
              WHERE r.empresa_id::TEXT = el
          )
      )
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_rota_id IS NULL OR s.rota_id = p_rota_id)
      AND (p_tipo IS NULL OR s.tipo_solicitacao = p_tipo)
      AND (p_tipos IS NULL OR s.tipo_solicitacao = ANY(p_tipos))
      AND (p_empresa_id IS NULL OR r.empresa_id = p_empresa_id)
      AND (p_data_solicitada IS NULL OR s.data_solicitada = p_data_solicitada)
      AND (v_cliente IS NULL OR COALESCE(c.nome, vp.cliente_nome) ILIKE '%' || v_cliente || '%')
      AND (
          v_busca IS NULL
          OR v.nome ILIKE '%' || v_busca || '%'
          OR r.nome ILIKE '%' || v_busca || '%'
          OR COALESCE(c.nome, vp.cliente_nome) ILIKE '%' || v_busca || '%'
      )
    ORDER BY
        CASE WHEN s.status = 'PENDENTE' THEN 0 ELSE 1 END,
        s.created_at DESC
    LIMIT p_limite
    OFFSET p_offset;
END;
$BODY$;

ALTER FUNCTION public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[])
    OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[]) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[]) TO anon;

GRANT EXECUTE ON FUNCTION public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[]) TO authenticated;

GRANT EXECUTE ON FUNCTION public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[]) TO postgres;

GRANT EXECUTE ON FUNCTION public.fn_listar_solicitacoes_central(uuid, character varying, uuid, character varying, integer, integer, uuid, text, date, text, text[]) TO service_role;
