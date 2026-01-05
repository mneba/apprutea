// ============================================
// TIPOS DO MÓDULO DE ORGANIZAÇÃO
// ============================================

export interface EmpresaResumo {
  id: string;
  nome: string;
  total_rotas: number;
  total_clientes: number;
  total_emprestimos: number;
}

export interface RotaResumo {
  id: string;
  nome: string;
  vendedor_id?: string;
  vendedor_nome?: string;
  total_clientes: number;
  total_emprestimos: number;
  status: 'ATIVA' | 'INATIVA';
}

export interface ResumoGeral {
  total_empresas: number;
  total_rotas_ativas: number;
  total_clientes: number;
  total_emprestimos_ativos: number;
}
