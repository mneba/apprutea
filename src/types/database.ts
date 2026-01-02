// Tipos do banco de dados

export interface Hierarquia {
  id: string;
  pais: string;
  estado: string;
  total_empresas_ativas?: number;
  created_at?: string;
}

export interface Empresa {
  id: string;
  hierarquia_id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  tipo_empresa: 'PROPRIA' | 'PARCEIRA';
  vendedores_ids?: string[];
  rotas_ids?: string[];
  status: 'ATIVA' | 'INATIVA';
  created_at?: string;
}

export interface Rota {
  id: string;
  nome: string;
  descricao?: string;
  status: 'ATIVA' | 'INATIVA';
  created_at?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  nome: string;
  telefone?: string;
  documento?: string;
  endereco?: string;
  justificativa?: string;
  empresa_pretendida?: string;
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  aprovado_por?: string;
  data_aprovacao?: string;
  observacoes_aprovacao?: string;
  tipo_usuario: 'SUPER_ADMIN' | 'ADMIN' | 'MONITOR' | 'USUARIO_PADRAO' | 'VENDEDOR';
  empresas_ids?: string[];
  cidades_ids?: string[];
  rotas_ids?: string[];
  token_acesso?: string;
  token_gerado_por?: string;
  token_gerado_em?: string;
  token_validado?: boolean;
  url_foto_usuario?: string;
  pagina_atual?: string;
  ultima_empresa_id?: string;
  ultima_cidade_id?: string;
  ultima_rota_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ModuloSistema {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  ativo: boolean;
  ordem_exibicao: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserPermissao {
  id?: string;
  user_id: string;
  modulo_id: string;
  pode_todos: boolean;
  pode_guardar: boolean;
  pode_buscar: boolean;
  pode_eliminar: boolean;
  concedido_por?: string;
  data_concessao?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MensagemSistema {
  id: string;
  usuario_origem_id?: string;
  usuario_destino_id: string;
  mensagem: string;
  lido: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Vendedor {
  id: string;
  nome: string;
  codigo_vendedor: string;
  telefone?: string;
  documento?: string;
  endereco?: string;
  salario?: number;
  percentual_recaudo?: number;
  percentual_vendas?: number;
  rotas_ids?: string[];
  status: 'ATIVO' | 'INATIVO';
  created_at?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  documento?: string;
  telefone?: string;
  endereco?: string;
  hierarquia_id?: string;
  empresa_id?: string;
  vendedor_id?: string;
  status: 'ATIVO' | 'INATIVO';
  created_at?: string;
}

export interface LiquidacaoDiaria {
  id: string;
  vendedor_id: string;
  rota_id: string;
  empresa_id: string;
  data_abertura: string;
  data_fechamento?: string;
  status: 'ABERTO' | 'FECHADO' | 'APROVADO';
  caixa_inicial: number;
  caixa_final: number;
  carteira_inicial: number;
  carteira_final: number;
  valor_esperado_dia: number;
  valor_recebido_dia: number;
  percentual_recebimento: number;
  clientes_iniciais: number;
  clientes_sincronizados: number;
  clientes_novos: number;
  clientes_renovados: number;
  clientes_cancelados: number;
  pagamentos_pagos: number;
  pagamentos_nao_pagos: number;
  valor_dinheiro: number;
  valor_transferencia: number;
  observacoes?: string;
  aprovado_por?: string;
  data_aprovacao?: string;
  created_at?: string;
}

// Tipos para formulários
export interface RegistroEtapa1 {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegistroEtapa2 {
  nome: string;
  telefone: string;
  hierarquia_id: string;
  empresa_pretendida: string;
}

export interface ValidarCodigo {
  codigo: string;
}
