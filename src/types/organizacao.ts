// ============================================
// TIPOS DO MÓDULO DE ORGANIZAÇÃO
// ============================================

// Cidade vive em database.ts (tipo de domínio core).
// Re-exportamos aqui por conveniência para manter compat com imports antigos.
export type { Cidade } from './database';
import type { Cidade } from './database';

export interface EmpresaResumo {
  id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade_id?: string;
  cidade_nome?: string;
  total_rotas: number;
  total_clientes: number;
  total_emprestimos: number;
}
export interface RotaResumo {
  id: string;
  nome: string;
  descricao?: string;
  vendedor_id?: string;
  vendedor_nome?: string;
  total_clientes: number;
  total_emprestimos: number;
  status: 'ATIVA' | 'INATIVA';
  trabalha_domingo?: boolean;
}
export interface ResumoGeral {
  total_empresas: number;
  total_rotas_ativas: number;
  total_clientes: number;
  total_emprestimos_ativos: number;
}
export interface Socio {
  id?: string;
  empresa_id: string;
  user_id?: string;
  nome: string;
  documento: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  percentual_participacao: number;
  data_entrada?: string;
  data_saida?: string;
  status: 'ATIVO' | 'INATIVO';
}
export interface VendedorDisponivel {
  id: string;
  nome: string;
  codigo_vendedor: string;
}
export interface UsuarioEmpresa {
  id: string;
  user_id: string;
  nome: string;
  email?: string;
  tipo_usuario: string;
  is_socio: boolean;
  percentual_participacao?: number;
}

// ============================================
// HIERARQUIAS E CIDADES
// ============================================

// Nota: Cidade foi movida para database.ts e é re-exportada acima.
// Hierarquia também já existe em database.ts; mantemos uma versão simplificada
// aqui para compatibilidade com código que importa de organizacao.
export interface Hierarquia {
  id: string;
  pais: string;
  estado: string;
}

export interface CidadeComResumo extends Cidade {
  pais: string;
  estado: string;
  total_empresas: number;
}