'use client';

import { useState, useEffect, Fragment } from 'react';
import { X, Shield, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import type { UserProfile, ModuloSistema, UserPermissao } from '@/types/database';

type TipoUsuario = 'SUPER_ADMIN' | 'ADMIN' | 'MONITOR' | 'USUARIO_PADRAO' | 'VENDEDOR';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
}

export function ModalPermissoes({ usuario, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);
  const [permissoes, setPermissoes] = useState<Record<string, UserPermissao>>({});
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>(usuario.tipo_usuario);

  // Carregar módulos e permissões
  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      try {
        const [modulosData, permissoesData] = await Promise.all([
          usuariosService.listarModulos(),
          usuariosService.listarPermissoesUsuario(usuario.user_id),
        ]);
        setModulos(modulosData);

        const permissoesMap: Record<string, UserPermissao> = {};
        permissoesData.forEach((p) => {
          permissoesMap[p.modulo_id] = p;
        });
        setPermissoes(permissoesMap);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarDados();
  }, [usuario.user_id]);

  // Toggle de permissão
  const togglePermissao = (
    moduloId: string,
    campo: 'pode_todos' | 'pode_guardar' | 'pode_buscar' | 'pode_eliminar'
  ) => {
    setPermissoes((prev) => {
      const permissao = prev[moduloId] || {
        modulo_id: moduloId,
        user_id: usuario.user_id,
        pode_todos: false,
        pode_guardar: false,
        pode_buscar: false,
        pode_eliminar: false,
      };

      if (campo === 'pode_todos' && !permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: {
            ...permissao,
            pode_todos: true,
            pode_guardar: true,
            pode_buscar: true,
            pode_eliminar: true,
          },
        };
      }

      if (campo === 'pode_todos' && permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: {
            ...permissao,
            pode_todos: false,
          },
        };
      }

      return {
        ...prev,
        [moduloId]: {
          ...permissao,
          [campo]: !permissao[campo],
        },
      };
    });
  };

  // Salvar permissões
  const handleSalvar = async () => {
    setSaving(true);
    try {
      if (tipoUsuario !== usuario.tipo_usuario) {
        await usuariosService.atualizarTipoUsuario(usuario.user_id, tipoUsuario);
      }

      await usuariosService.salvarPermissoes(usuario.user_id, Object.values(permissoes));
      onSave();
    } catch (err) {
      console.error('Erro ao salvar permissões:', err);
      alert('Erro ao salvar permissões. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleTipoUsuarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTipoUsuario(e.target.value as TipoUsuario);
  };

  // Agrupar módulos por categoria
  const modulosPorCategoria = modulos.reduce((acc, modulo) => {
    const categoria = modulo.categoria || 'Outros';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(modulo);
    return acc;
  }, {} as Record<string, ModuloSistema[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Permissões do Usuário</h2>
              <p className="text-sm text-gray-500">{usuario.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tipo de Usuário */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Usuário
                </label>
                <select
                  value={tipoUsuario}
                  onChange={handleTipoUsuarioChange}
                  className="w-full max-w-xs px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MONITOR">Monitor</option>
                  <option value="USUARIO_PADRAO">Usuário Padrão</option>
                </select>
              </div>

              {/* Tabela de Permissões */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Permissões por Módulo</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                          Módulo
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">
                          Todos
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">
                          Guardar
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">
                          Buscar
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-24">
                          Eliminar
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(modulosPorCategoria).map(([categoria, modulosCategoria]) => (
                        <Fragment key={categoria}>
                          <tr className="bg-gray-100">
                            <td
                              colSpan={5}
                              className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase"
                            >
                              {categoria}
                            </td>
                          </tr>
                          {modulosCategoria.map((modulo) => {
                            const permissao = permissoes[modulo.id];
                            return (
                              <tr key={modulo.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <span className="text-sm text-gray-700">{modulo.nome}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Checkbox
                                    checked={permissao?.pode_todos || false}
                                    onChange={() => togglePermissao(modulo.id, 'pode_todos')}
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Checkbox
                                    checked={permissao?.pode_guardar || false}
                                    onChange={() => togglePermissao(modulo.id, 'pode_guardar')}
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Checkbox
                                    checked={permissao?.pode_buscar || false}
                                    onChange={() => togglePermissao(modulo.id, 'pode_buscar')}
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Checkbox
                                    checked={permissao?.pode_eliminar || false}
                                    onChange={() => togglePermissao(modulo.id, 'pode_eliminar')}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} loading={saving}>
            Salvar Permissões
          </Button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`
        w-6 h-6 rounded border-2 flex items-center justify-center transition-all
        ${
          checked
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white border-gray-300 hover:border-blue-400'
        }
      `}
    >
      {checked && <Check className="w-4 h-4" />}
    </button>
  );
}
