'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronRight, X } from 'lucide-react';
import { hierarquiaService } from '@/services/auth';
import type { Hierarquia } from '@/types/database';

interface Empresa {
  id: string;
  nome: string;
  hierarquia_id: string;
}

export function SeletorLocalizacao() {
  const [isOpen, setIsOpen] = useState(false);
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [paisSelecionado, setPaisSelecionado] = useState<string | null>(null);
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string | null>(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [rotaSelecionada, setRotaSelecionada] = useState<string | null>(null);
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

  // Carregar hierarquias
  useEffect(() => {
    async function carregarDados() {
      try {
        const data = await hierarquiaService.listarTodas();
        setHierarquias(data);
      } catch (err) {
        console.error('Erro ao carregar hierarquias:', err);
      }
    }
    carregarDados();
  }, []);

  // Países únicos
  const paises = [...new Set(hierarquias.map(h => h.pais))];

  // Cidades do país selecionado
  const cidadesDoPais = hierarquias.filter(h => h.pais === paisSelecionado);

  // Gerar breadcrumb
  const getBreadcrumb = () => {
    const parts = [];
    if (paisSelecionado) parts.push(paisSelecionado);
    if (cidadeSelecionada) {
      const cidade = hierarquias.find(h => h.id === cidadeSelecionada);
      if (cidade) parts.push(cidade.estado);
    }
    if (empresaSelecionada) parts.push(empresaSelecionada.nome);
    return parts;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
      >
        <MapPin className="w-4 h-4 text-blue-600" />
        {breadcrumb.length > 0 ? (
          <div className="flex items-center gap-1 text-sm">
            {breadcrumb.map((item, index) => (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                <span className={index === breadcrumb.length - 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}>
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
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
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
            {/* Lista de Países */}
            <div className="space-y-1">
              {paises.map((pais) => (
                <div key={pais}>
                  {/* País */}
                  <button
                    onClick={() => {
                      setPaisSelecionado(paisSelecionado === pais ? null : pais);
                      if (paisSelecionado !== pais) {
                        setCidadeSelecionada(null);
                        setEmpresaSelecionada(null);
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

                  {/* Cidades do País */}
                  {paisSelecionado === pais && (
                    <div className="ml-4 mt-1 space-y-1">
                      {cidadesDoPais.map((cidade) => (
                        <button
                          key={cidade.id}
                          onClick={() => {
                            setCidadeSelecionada(cidadeSelecionada === cidade.id ? null : cidade.id);
                            setEmpresaSelecionada(null);
                          }}
                          className={`
                            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
                            ${cidadeSelecionada === cidade.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}
                          `}
                        >
                          <ChevronRight className={`w-3 h-3 transition-transform ${cidadeSelecionada === cidade.id ? 'rotate-90' : ''}`} />
                          {cidade.estado}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mensagem se não houver dados */}
            {paises.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma localização cadastrada</p>
              </div>
            )}
          </div>

          {/* Footer com Rota */}
          {cidadeSelecionada && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <div className="text-xs text-gray-500 mb-1">Rota selecionada:</div>
              <div className="text-sm font-medium text-gray-700">
                {rotaSelecionada || 'Nenhuma rota selecionada'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
