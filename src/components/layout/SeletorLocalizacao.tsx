'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronRight, X, Building2, Navigation, Check, Loader2, Search } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { prefetchModulos } from '@/lib/prefetchModulos';
import { usuariosService } from '@/services/usuarios';
import { organizacaoService } from '@/services/organizacao';
import type { Hierarquia, Cidade, Empresa, Rota } from '@/types/database';

// Normaliza para busca: minúsculas e sem acentos, para que "noreña"
// encontre "Noreña" e "fenix" encontre "Fênix".
function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function SeletorLocalizacao() {
  const { profile, isSuperAdmin, localizacao, setLocalizacao } = useUser();

  // Calcular se deve ocultar o seletor:
  // Não-SUPER_ADMIN com 1 empresa e 1 rota, E já tem rota selecionada
  const deveOcultarSeletor = !isSuperAdmin && profile && (
    (profile.empresas_ids || []).length <= 1 &&
    (profile.rotas_ids || []).length <= 1 &&
    localizacao.rota_id !== null // Só oculta se já tiver selecionado
  );
  const [isOpen, setIsOpen] = useState(false);
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRotas, setLoadingRotas] = useState(false);
  // Busca GLOBAL de rotas — só aparece para SUPER_ADMIN. Procura em todas as
  // empresas de todos os países, porque quem administra costuma saber o nome
  // da rota mas não onde ela está pendurada.
  const [buscaRota, setBuscaRota] = useState('');
  const [rotasTodas, setRotasTodas] = useState<Rota[]>([]);

  // Seleções temporárias
  const [paisSelecionado, setPaisSelecionado] = useState<string | null>(null);
  const [hierarquiaIdSelecionada, setHierarquiaIdSelecionada] = useState<string | null>(null);
  const [cidadeIdSelecionada, setCidadeIdSelecionada] = useState<string | null>(null);
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

  // Aquecer o cache dos módulos assim que houver empresa/rota definidas.
  // Um único efeito cobre os dois casos: o usuário acabou de escolher no
  // seletor, ou a página abriu com a localização que já estava salva.
  // O seletor vive no layout do dashboard, então isto roda uma vez por
  // carregamento e a cada troca de seleção.
  useEffect(() => {
    prefetchModulos({
      empresaId: localizacao.empresa_id,
      rotaId: localizacao.rota_id,
    });
  }, [localizacao.empresa_id, localizacao.rota_id]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [hierarquiasData, cidadesResumo, empresasData, rotasTodasData] = await Promise.all([
        usuariosService.listarHierarquias(),
        organizacaoService.listarTodasCidades(),
        usuariosService.listarEmpresas(),
        // Só o SUPER_ADMIN tem a busca global, então só ele paga esta query.
        isSuperAdmin ? usuariosService.listarRotas() : Promise.resolve([] as Rota[]),
      ]);

      setRotasTodas(rotasTodasData);

      // Reduzir CidadeComResumo para Cidade (campos básicos)
      const cidadesData: Cidade[] = cidadesResumo.map((c) => ({
        id: c.id,
        hierarquia_id: c.hierarquia_id,
        nome: c.nome,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      // Filtrar por permissões para usuários não SUPER_ADMIN
      if (!isSuperAdmin && profile) {
        const hierarquiasPermitidas = profile.hierarquias_ids || [];
        const cidadesPermitidas = profile.cidades_ids || [];
        const empresasPermitidas = profile.empresas_ids || [];

        setHierarquias(hierarquiasData.filter(h => hierarquiasPermitidas.includes(h.id)));
        setCidades(cidadesData.filter(c => cidadesPermitidas.includes(c.id)));
        setEmpresas(empresasData.filter(e => empresasPermitidas.includes(e.id)));
      } else {
        setHierarquias(hierarquiasData);
        setCidades(cidadesData);
        setEmpresas(empresasData);
      }

      // Inicializar seleções com localização atual
      if (localizacao.hierarquia) {
        setPaisSelecionado(localizacao.hierarquia.pais);
        setHierarquiaIdSelecionada(localizacao.hierarquia_id);
      }
      if (localizacao.cidade_id) {
        setCidadeIdSelecionada(localizacao.cidade_id);
      }
      if (localizacao.empresa_id) {
        setEmpresaIdSelecionada(localizacao.empresa_id);
        carregarRotas(localizacao.empresa_id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarRotas = async (empresaId: string) => {
    setLoadingRotas(true);
    try {
      const rotasData = await usuariosService.listarRotasPorEmpresa(empresaId);

      // Filtrar por permissões se não for SUPER_ADMIN
      if (!isSuperAdmin && profile) {
        const rotasPermitidas = profile.rotas_ids || [];
        // Array vazio = acesso a todas as rotas da empresa
        setRotas(rotasPermitidas.length === 0
          ? rotasData
          : rotasData.filter(r => rotasPermitidas.includes(r.id)));
      } else {
        setRotas(rotasData);
      }

      return rotasData;
    } catch (err) {
      console.error('Erro ao carregar rotas:', err);
      return [];
    } finally {
      setLoadingRotas(false);
    }
  };

  // Países únicos
  const paises = [...new Set(hierarquias.map((h) => h.pais))];

  // Estados do país selecionado
  const estadosDoPais = hierarquias.filter((h) => h.pais === paisSelecionado);

  // Cidades da hierarquia (estado) selecionada
  const cidadesDaHierarquia = (hierarquiaId: string | null) =>
    hierarquiaId ? cidades.filter((c) => c.hierarquia_id === hierarquiaId) : [];

  // Empresas da cidade selecionada
  const empresasDaCidade = (cidadeId: string | null) =>
    cidadeId ? empresas.filter((e) => e.cidade_id === cidadeId) : [];

  // ============================================================
  // BUSCA GLOBAL DE ROTAS (SUPER_ADMIN)
  // ============================================================
  // `rotas` não tem empresa_id — o vínculo mora em `empresas.rotas_ids`.
  // Então o índice é montado ao contrário: percorre as empresas e resolve
  // cada rota_id, o que já entrega o caminho completo país › estado ›
  // cidade › empresa para exibir e para gravar na localização de uma vez.
  const indiceRotas = useMemo(() => {
    if (!isSuperAdmin || rotasTodas.length === 0) return [];

    const rotaPorId = new Map(rotasTodas.map((r) => [r.id, r]));

    return empresas.flatMap((empresa) => {
      const hierarquia = hierarquias.find((h) => h.id === empresa.hierarquia_id) || null;
      const cidade = empresa.cidade_id
        ? cidades.find((c) => c.id === empresa.cidade_id) || null
        : null;

      return (empresa.rotas_ids || []).flatMap((rotaId) => {
        const rota = rotaPorId.get(rotaId);
        // rota inativa ou removida ainda pode constar em rotas_ids
        if (!rota) return [];
        return [{
          rota,
          empresa,
          cidade,
          hierarquia,
          // pré-normalizado: evita recalcular a cada tecla digitada
          busca: normalizarBusca(`${rota.nome} ${empresa.nome}`),
        }];
      });
    });
  }, [isSuperAdmin, rotasTodas, empresas, cidades, hierarquias]);

  const termoBusca = isSuperAdmin ? normalizarBusca(buscaRota) : '';
  const buscandoRota = termoBusca.length > 0;

  const LIMITE_RESULTADOS = 60;
  const resultadosBusca = useMemo(() => {
    if (!buscandoRota) return [];
    return indiceRotas.filter((item) => item.busca.includes(termoBusca));
  }, [buscandoRota, indiceRotas, termoBusca]);

  // Selecionar empresa - SÓ FECHA SE NÃO TIVER ROTAS
  const handleSelecionarEmpresa = async (empresa: Empresa) => {
    const hierarquia = hierarquias.find(h => h.id === empresa.hierarquia_id);
    const cidade = empresa.cidade_id ? cidades.find(c => c.id === empresa.cidade_id) : null;

    setLocalizacao({
      hierarquia_id: empresa.hierarquia_id,
      hierarquia: hierarquia || null,
      cidade_id: empresa.cidade_id || null,
      cidade: cidade || null,
      empresa_id: empresa.id,
      empresa: empresa,
      rota_id: null,
      rota: null,
    });

    setEmpresaIdSelecionada(empresa.id);
    setBuscaRota(''); // rotas mudaram: termo antigo não faz mais sentido

    // Carregar rotas para verificar se tem
    setLoadingRotas(true);
    try {
      const rotasData = await usuariosService.listarRotasPorEmpresa(empresa.id);

      let rotasFiltradas = rotasData;
      if (!isSuperAdmin && profile) {
        const rotasPermitidas = profile.rotas_ids || [];
        // Array vazio = acesso a todas as rotas da empresa
        rotasFiltradas = rotasPermitidas.length === 0
          ? rotasData
          : rotasData.filter(r => rotasPermitidas.includes(r.id));
      }

      setRotas(rotasFiltradas);

      // Se não tem rotas, fecha o dropdown
      if (rotasFiltradas.length === 0) {
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Erro ao carregar rotas:', err);
      setIsOpen(false);
    } finally {
      setLoadingRotas(false);
    }
  };

  // Selecionar um resultado da busca global: grava os quatro níveis de uma
  // vez, já que o índice conhece o caminho inteiro da rota.
  const handleSelecionarResultadoBusca = (item: (typeof indiceRotas)[number]) => {
    setLocalizacao({
      hierarquia_id: item.hierarquia?.id || item.empresa.hierarquia_id || null,
      hierarquia: item.hierarquia,
      cidade_id: item.cidade?.id || null,
      cidade: item.cidade,
      empresa_id: item.empresa.id,
      empresa: item.empresa,
      rota_id: item.rota.id,
      rota: item.rota,
    });

    // Deixa a árvore expandida no lugar certo para a próxima abertura
    setPaisSelecionado(item.hierarquia?.pais || null);
    setHierarquiaIdSelecionada(item.empresa.hierarquia_id || null);
    setCidadeIdSelecionada(item.cidade?.id || null);
    setEmpresaIdSelecionada(item.empresa.id);

    // Rodapé passa a listar as rotas da empresa de destino
    carregarRotas(item.empresa.id);

    setBuscaRota('');
    setIsOpen(false);
  };

  // Selecionar rota - sempre fecha
  const handleSelecionarRota = (rota: Rota) => {
    setLocalizacao({
      ...localizacao,
      rota_id: rota.id,
      rota: rota,
    });
    setIsOpen(false);
  };

  // Limpar rota (selecionar "Todas as rotas")
  const handleLimparRota = () => {
    setLocalizacao({
      ...localizacao,
      rota_id: null,
      rota: null,
    });
    setIsOpen(false);
  };

  // Toggle estado: expande/fecha. Se hierarquia tem só 1 cidade, auto-seleciona ela.
  const handleToggleHierarquia = (hierarquiaId: string) => {
    if (hierarquiaIdSelecionada === hierarquiaId) {
      // Fechar
      setHierarquiaIdSelecionada(null);
      setCidadeIdSelecionada(null);
      setEmpresaIdSelecionada(null);
      return;
    }

    // Abrir
    setHierarquiaIdSelecionada(hierarquiaId);
    setEmpresaIdSelecionada(null);

    const cidadesAqui = cidadesDaHierarquia(hierarquiaId);
    if (cidadesAqui.length === 1) {
      // Auto-select: vai direto para mostrar empresas
      setCidadeIdSelecionada(cidadesAqui[0].id);
    } else {
      setCidadeIdSelecionada(null);
    }
  };

  // Toggle cidade
  const handleToggleCidade = (cidadeId: string) => {
    setCidadeIdSelecionada(cidadeIdSelecionada === cidadeId ? null : cidadeId);
    setEmpresaIdSelecionada(null);
  };

  // Gerar breadcrumb
  const getBreadcrumb = () => {
    const parts: string[] = [];
    if (localizacao.hierarquia) {
      parts.push(localizacao.hierarquia.pais);
      parts.push(localizacao.hierarquia.estado);
    }
    if (localizacao.cidade) {
      parts.push(localizacao.cidade.nome);
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

  // Para usuários com 1 empresa e no máximo 1 rota: badge estático sem dropdown
  if (deveOcultarSeletor) {
    const nomeEmpresa = localizacao.empresa?.nome || '';
    const nomeCidade = localizacao.cidade?.nome || '';
    const label = [nomeCidade, nomeEmpresa].filter(Boolean).join(' › ');

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
        {label ? (
          <span title={label} className="text-sm text-gray-700 font-medium truncate max-w-[240px]">
            {label}
          </span>
        ) : (
          <span className="text-sm text-gray-400">Carregando...</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors max-w-2xl min-w-0 overflow-hidden"
      >
        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
        {breadcrumb.length > 0 ? (
          <div className="flex items-center gap-1 text-sm min-w-0 overflow-hidden">
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1;
              return (
                // Todo nível tem largura teto e trunca: o último (rota) tem um
                // teto maior por ser o mais relevante, mas também cede quando o
                // conjunto passa do `max-w-2xl` do botão — antes ele era
                // `whitespace-nowrap` e vazava para fora da caixa.
                <span key={index} className="flex items-center gap-1 min-w-0">
                  {index > 0 && <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                  <span
                    title={item}
                    className={
                      isLast
                        ? 'truncate text-blue-600 font-medium max-w-[280px]'
                        : 'truncate text-gray-600 max-w-[110px]'
                    }
                  >
                    {item}
                  </span>
                </span>
              );
            })}
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

          {/* Busca global de rotas — exclusiva do SUPER_ADMIN */}
          {isSuperAdmin && (
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={buscaRota}
                  onChange={(e) => setBuscaRota(e.target.value)}
                  placeholder="Buscar rota em todas as empresas..."
                  className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white"
                />
                {buscaRota && (
                  <button
                    type="button"
                    onClick={() => setBuscaRota('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : buscandoRota ? (
              /* Resultados da busca substituem a árvore de países */
              <div className="space-y-1">
                {resultadosBusca.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma rota encontrada</p>
                    <p className="text-xs text-gray-400 mt-1">Tente outro trecho do nome</p>
                  </div>
                ) : (
                  <>
                    <div className="px-1 pb-1 text-xs text-gray-400">
                      {resultadosBusca.length}{' '}
                      {resultadosBusca.length === 1 ? 'rota encontrada' : 'rotas encontradas'}
                    </div>
                    {resultadosBusca.slice(0, LIMITE_RESULTADOS).map((item) => {
                      const caminho = [
                        item.hierarquia?.pais,
                        item.hierarquia?.estado,
                        item.cidade?.nome,
                        item.empresa.nome,
                      ].filter(Boolean).join(' › ');
                      const selecionada = localizacao.rota_id === item.rota.id
                        && localizacao.empresa_id === item.empresa.id;

                      return (
                        <button
                          key={`${item.empresa.id}-${item.rota.id}`}
                          onClick={() => handleSelecionarResultadoBusca(item)}
                          className={`
                            w-full flex items-start gap-2 px-3 py-2 rounded-lg text-left transition-colors
                            ${selecionada
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'hover:bg-gray-100 text-gray-700'}
                          `}
                        >
                          <Navigation className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate" title={item.rota.nome}>
                              {item.rota.nome}
                            </span>
                            <span className="block text-xs text-gray-500 truncate" title={caminho}>
                              {caminho}
                            </span>
                          </span>
                          {selecionada && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                    {resultadosBusca.length > LIMITE_RESULTADOS && (
                      <div className="px-3 py-2 text-xs text-gray-400 italic">
                        Mostrando {LIMITE_RESULTADOS} de {resultadosBusca.length}. Refine a busca.
                      </div>
                    )}
                  </>
                )}
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
                          setCidadeIdSelecionada(null);
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
                        {estadosDoPais.map((hierarquia) => {
                          // Quantidade de empresas ativas deste estado
                          const totalEmpresas = (hierarquia as any).total_empresas_ativas || 0;
                          const cidadesAqui = cidadesDaHierarquia(hierarquia.id);
                          const cidadeUnica = cidadesAqui.length === 1;
                          const expandido = hierarquiaIdSelecionada === hierarquia.id;

                          return (
                            <div key={hierarquia.id}>
                              {/* Estado */}
                              <button
                                onClick={() => handleToggleHierarquia(hierarquia.id)}
                                className={`
                                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                                  ${expandido
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-gray-100 text-gray-600'}
                                `}
                              >
                                <span className="flex items-center gap-2">
                                  <ChevronRight className={`w-3 h-3 transition-transform ${expandido ? 'rotate-90' : ''}`} />
                                  {hierarquia.estado}
                                </span>
                                {totalEmpresas > 0 && (
                                  <span className={`
                                    px-2 py-0.5 rounded-full text-xs font-medium
                                    ${expandido
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-200 text-gray-600'}
                                  `}>
                                    {totalEmpresas} {totalEmpresas === 1 ? 'empresa' : 'empresas'}
                                  </span>
                                )}
                              </button>

                              {/* Cidades / Empresas dentro do estado */}
                              {expandido && (
                                <div className="ml-4 mt-1 space-y-1">
                                  {cidadesAqui.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-gray-400 italic">
                                      Nenhuma cidade cadastrada
                                    </div>
                                  ) : cidadeUnica ? (
                                    // 1 cidade só: pula direto pra empresas
                                    empresasDaCidade(cidadesAqui[0].id).length > 0 ? (
                                      <div className="space-y-1">
                                        {empresasDaCidade(cidadesAqui[0].id).map((empresa) => (
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
                                            {localizacao.empresa_id === empresa.id && (
                                              <Check className="w-3 h-3 ml-auto" />
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="px-3 py-2 text-xs text-gray-400 italic">
                                        Nenhuma empresa cadastrada
                                      </div>
                                    )
                                  ) : (
                                    // 2+ cidades: mostra nível extra
                                    cidadesAqui.map((cidade) => {
                                      const empresasAqui = empresasDaCidade(cidade.id);
                                      const cidadeExpandida = cidadeIdSelecionada === cidade.id;

                                      return (
                                        <div key={cidade.id}>
                                          <button
                                            onClick={() => handleToggleCidade(cidade.id)}
                                            className={`
                                              w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors
                                              ${cidadeExpandida
                                                ? 'bg-blue-500 text-white'
                                                : 'hover:bg-gray-100 text-gray-500'}
                                            `}
                                          >
                                            <span className="flex items-center gap-2">
                                              <ChevronRight className={`w-3 h-3 transition-transform ${cidadeExpandida ? 'rotate-90' : ''}`} />
                                              {cidade.nome}
                                            </span>
                                            {empresasAqui.length > 0 && (
                                              <span className={`
                                                px-2 py-0.5 rounded-full text-xs font-medium
                                                ${cidadeExpandida
                                                  ? 'bg-blue-400 text-white'
                                                  : 'bg-gray-200 text-gray-600'}
                                              `}>
                                                {empresasAqui.length}
                                              </span>
                                            )}
                                          </button>

                                          {cidadeExpandida && empresasAqui.length > 0 && (
                                            <div className="ml-4 mt-1 space-y-1">
                                              {empresasAqui.map((empresa) => (
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
                                                  {localizacao.empresa_id === empresa.id && (
                                                    <Check className="w-3 h-3 ml-auto" />
                                                  )}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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

          {/* Footer com Rotas da Empresa Selecionada.
              Some durante a busca global: ali a rota já é escolhida direto no
              resultado, e manter as duas listas confunde. */}
          {localizacao.empresa && !buscandoRota && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              {loadingRotas ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="ml-2 text-sm text-gray-500">Carregando rotas...</span>
                </div>
              ) : rotas.length > 0 ? (
                <>
                  <div className="text-xs text-gray-500 mb-2">Selecione a rota (opcional):</div>

                  {/* Teto de altura: com dezenas de rotas o wrap crescia para
                      fora da viewport e as últimas ficavam inalcançáveis. */}
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                    <button
                      onClick={handleLimparRota}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                        ${!localizacao.rota_id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'}
                      `}
                    >
                      Todas
                    </button>
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
                </>
              ) : (
                <div className="text-xs text-gray-500 text-center py-1">
                  Nenhuma rota cadastrada para esta empresa
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}