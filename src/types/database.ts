// Tipos do banco de dados

export interface Hierarquia {
  id: string;
  pais: string;
  estado: string;
  total_empresas_ativas?: number;
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

export interface MensagemSistema {
  id: string;
  usuario_origem_id?: string;
  usuario_destino_id: string;
  mensagem: string;
  lido: boolean;
  created_at?: string;
  updated_at?: string;
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
