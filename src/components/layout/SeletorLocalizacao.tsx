'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronRight, X, Building2, Navigation } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { usuariosService } from '@/services/usuarios';
import type { Hierarquia, Empresa, Rota } from '@/types/database';

export function SeletorLocalizacao() {
  const { profile, isSuperAdmin, localizacao, setLocalizacao } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Seleções temporárias
  const [paisSelecionado, setPaisSelecionado] = useState<string | null>(null);
  const [hierarquiaIdSelecionada, setHierarquiaIdSelecionada] = useState<string | null>(null);
  const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar dados quando abrir
  useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [hierarquiasData, empresasData] = await Promise.all([
        usuariosService.listarHierarquias(),
        usuariosService.listarEmpresas(),
      ]);

      // Se não for SUPER_ADMIN, filtrar apenas hierarquias e empresas do usuário
      if (!isSuperAdmin && profile) {
        const cidadesPermitidas = profile.cidades_ids || [];
        const empresasPermitidas = profile.empresas_ids || [];
        
        setHierarquias(hierarquiasData.filter(h => cidadesPermitidas.includes(h.id)));
        setEmpresas(empresasData.filter(e => empresasPermitidas.includes(e.id)));
      } else {
        setHierarquias(hierarquiasData);
        setEmpresas(empresasData);
      }

      // Inicializar seleções com localização atual
      if (localizacao.hierarquia) {
        setPaisSelecionado(localizacao.hierarquia.pais);
        setHierarquiaIdSelecionada(localizacao.hierarquia_id);
      }
      if (localizacao.empresa_id) {
        setEmpresaIdSelecionada(localizacao.empresa_id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar rotas quando empresa mudar
  useEffect(() => {
    if (empresaIdSelecionada) {
      carregarRotas(empresaIdSelecionada);
    } else {
      setRotas([]);
    }
  }, [empresaIdSelecionada]);

  const carregarRotas = async (empresaId: string) => {
    try {
      const rotasData = await usuariosService.listarRotasPorEmpresa(empresaId);
      
      // Filtrar por permissões se não for SUPER_ADMIN
      if (!isSuperAdmin && profile) {
        const rotasPermitidas = profile.rotas_ids || [];
        setRotas(rotasData.filter(r => rotasPermitidas.includes(r.id)));
      } else {
        setRotas(rotasData);
      }
    } catch (err) {
      console.error('Erro ao carregar rotas:', err);
    }
  };

  // Países únicos
  const paises = [...new Set(hierarquias.map((h) => h.pais))];

  // Estados/cidades do país selecionado
  const estadosDoPais = hierarquias.filter((h) => h.pais === paisSelecionado);

  // Empresas da hierarquia selecionada
  const empresasDaHierarquia = empresas.filter(
    (e) => e.hierarquia_id === hierarquiaIdSelecionada
  );

  // Selecionar empresa e salvar no contexto
  const handleSelecionarEmpresa = (empresa: Empresa) => {
    const hierarquia = hierarquias.find(h => h.id === empresa.hierarquia_id);
    
    setLocalizacao({
      hierarquia_id: empresa.hierarquia_id,
      hierarquia: hierarquia || null,
      empresa_id: empresa.id,
      empresa: empresa,
      rota_id: null,
      rota: null,
    });
    
    setIsOpen(false);
  };

  // Selecionar rota
  const handleSelecionarRota = (rota: Rota) => {
    setLocalizacao({
      ...localizacao,
      rota_id: rota.id,
      rota: rota,
    });
    
    setIsOpen(false);
  };

  // Gerar breadcrumb
  const getBreadcrumb = () => {
    const parts = [];
    if (localizacao.hierarquia) {
      parts.push(localizacao.hierarquia.pais);
      parts.push(localizacao.hierarquia.estado);
    }
    if (localizacao.empresa) {
      parts.push(localizacao.empresa.nome);
    }
    if (localizacao.rota) {
      parts.push(localizacao.rota.nome);
    }
    return parts;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors max-w-md"
      >
        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
        {breadcrumb.length > 0 ? (
          <div className="flex items-center gap-1 text-sm truncate">
            {breadcrumb.map((item, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                <span className={`truncate ${index === breadcrumb.length - 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                  {item}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-500">Selecione a localização</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800">Localização</span>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {/* Lista de Países */}
                {paises.map((pais) => (
                  <div key={pais}>
                    {/* País */}
                    <button
                      onClick={() => {
                        setPaisSelecionado(paisSelecionado === pais ? null : pais);
                        if (paisSelecionado !== pais) {
                          setHierarquiaIdSelecionada(null);
                          setEmpresaIdSelecionada(null);
                        }
                      }}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors
                        ${paisSelecionado === pais ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}
                      `}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronRight className={`w-4 h-4 transition-transform ${paisSelecionado === pais ? 'rotate-90' : ''}`} />
                        {pais}
                      </span>
                    </button>

                    {/* Estados do País */}
                    {paisSelecionado === pais && (
                      <div className="ml-4 mt-1 space-y-1">
                        {estadosDoPais.map((hierarquia) => (
                          <div key={hierarquia.id}>
                            <button
                              onClick={() => {
                                setHierarquiaIdSelecionada(
                                  hierarquiaIdSelecionada === hierarquia.id ? null : hierarquia.id
                                );
                                setEmpresaIdSelecionada(null);
                              }}
                              className={`
                                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                ${hierarquiaIdSelecionada === hierarquia.id 
                                  ? 'bg-blue-600 text-white' 
                                  : 'hover:bg-gray-100 text-gray-600'}
                              `}
                            >
                              <ChevronRight className={`w-3 h-3 transition-transform ${hierarquiaIdSelecionada === hierarquia.id ? 'rotate-90' : ''}`} />
                              {hierarquia.estado}
                            </button>

                            {/* Empresas da Hierarquia */}
                            {hierarquiaIdSelecionada === hierarquia.id && empresasDaHierarquia.length > 0 && (
                              <div className="ml-4 mt-1 space-y-1">
                                {empresasDaHierarquia.map((empresa) => (
                                  <button
                                    key={empresa.id}
                                    onClick={() => handleSelecionarEmpresa(empresa)}
                                    className={`
                                      w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                                      ${localizacao.empresa_id === empresa.id
                                        ? 'bg-green-100 text-green-700 border border-green-300'
                                        : 'hover:bg-gray-100 text-gray-600'}
                                    `}
                                  >
                                    <Building2 className="w-3 h-3" />
                                    {empresa.nome}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Mensagem se não houver dados */}
                {paises.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma localização disponível</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer com Rota Selecionada */}
          {localizacao.empresa && rotas.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <div className="text-xs text-gray-500 mb-2">Selecione a rota:</div>
              <div className="flex flex-wrap gap-2">
                {rotas.map((rota) => (
                  <button
                    key={rota.id}
                    onClick={() => handleSelecionarRota(rota)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                      ${localizacao.rota_id === rota.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'}
                    `}
                  >
                    <Navigation className="w-3 h-3 inline mr-1" />
                    {rota.nome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
