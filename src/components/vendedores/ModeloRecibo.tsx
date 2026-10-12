'use client';

// =====================================================================
// O MODELO DO RECIBO DE PAGAMENTO
// =====================================================================
//
// O vendedor registra a parcela, o app desenha este recibo como IMAGEM e
// compartilha pelo WhatsApp. Aqui é onde o modelo se edita — e, ao lado, se vê
// exatamente como vai sair.
//
// POR QUE A PRÉVIA É METADE DO TRABALHO
// O que se configura aqui só aparece na mão de um cliente, por WhatsApp, longe
// de quem configurou. Sem a prévia, descobrir que o rodapé ficou torto exige
// fazer um pagamento de verdade — e aí o recibo torto já foi para alguém.
//
// A PRÉVIA IMITA O CUPOM DE 80mm que o app desenha: fonte monoespaçada,
// largura estreita, valores alinhados à direita. Não é decoração — é o mesmo
// formato do comprovante da liquidação (ver LiquidacaoDetalhes.tsx no app do
// vendedor), que é o que o cliente já está acostumado a receber.
//
// O CONTRATO DOS MARCADORES não vive neste arquivo: vive no COMMENT da coluna
// `configuracoes_recibos.modelo_recibo`. Web e app são repositórios separados,
// sem código compartilhado, e é o comentário no banco que os mantém de acordo.
// Marcador novo entra nos três lugares.

import { useMemo } from 'react';
import { Receipt, MessageCircle } from 'lucide-react';

// ─── O formato ───────────────────────────────────────────────────────

export interface ModeloRecibo {
  titulo: string;
  cabecalho: string;
  rodape: string;
  /** Texto que acompanha a imagem na conversa do WhatsApp. */
  mensagem_whatsapp: string;
  mostrar_saldo: boolean;
  mostrar_proximo_vencimento: boolean;
  mostrar_vendedor: boolean;
}

export const MODELO_RECIBO_PADRAO: ModeloRecibo = {
  titulo: 'RECIBO DE PAGAMENTO',
  cabecalho: '{empresa}',
  rodape: 'Obrigado pelo pagamento!',
  mensagem_whatsapp: 'Olá {cliente}, segue o comprovante do seu pagamento de {valor_pago} em {data}.',
  mostrar_saldo: true,
  mostrar_proximo_vencimento: true,
  mostrar_vendedor: true,
};

/**
 * Preenche o modelo guardado, que pode estar incompleto.
 *
 * O `jsonb` do banco é escrito por versões diferentes do web ao longo do
 * tempo: um modelo gravado hoje não tem a chave que amanhã existir. Partir do
 * padrão e sobrescrever o que veio evita `undefined` chegando na tela como
 * texto vazio sem ninguém entender por quê.
 */
export function normalizarModelo(bruto: unknown): ModeloRecibo {
  if (!bruto || typeof bruto !== 'object') return { ...MODELO_RECIBO_PADRAO };
  return { ...MODELO_RECIBO_PADRAO, ...(bruto as Partial<ModeloRecibo>) };
}

// ─── Os marcadores ───────────────────────────────────────────────────

export interface DadosRecibo {
  cliente: string;
  valor_pago: string;
  parcela: string;
  saldo: string;
  proximo_vencimento: string;
  data: string;
  empresa: string;
  vendedor: string;
}

/**
 * Troca `{marcador}` pelo valor. Marcador desconhecido fica como está, à
 * vista: apagá-lo esconderia o erro de digitação justamente de quem pode
 * corrigi-lo, e o recibo sairia com uma frase faltando pedaço.
 */
export function preencherMarcadores(texto: string, dados: DadosRecibo): string {
  return (texto || '').replace(/\{(\w+)\}/g, (inteiro, chave: string) => {
    const valor = (dados as unknown as Record<string, string>)[chave];
    return valor !== undefined ? valor : inteiro;
  });
}

/** O exemplo da prévia. Números redondos o bastante para ninguém confundir
 *  com dado real, completos o bastante para a conta fechar na leitura. */
const EXEMPLO: DadosRecibo = {
  cliente: 'Rosy Martinez',
  valor_pago: '$ 50,00',
  parcela: '7/20',
  saldo: '$ 650,00',
  proximo_vencimento: '19/10/2026',
  data: '12/10/2026',
  empresa: 'Empresa do Mau',
  vendedor: 'Julio',
};

// ─── A prévia ────────────────────────────────────────────────────────

function Previa({ modelo, logoUrl }: { modelo: ModeloRecibo; logoUrl?: string }) {
  const p = (t: string) => preencherMarcadores(t, EXEMPLO);

  return (
    <div className="bg-gray-100 rounded-xl p-4 flex justify-center">
      <div className="bg-white shadow-sm w-[280px] px-4 py-5 font-mono text-[11px] leading-5 text-gray-800">
        {logoUrl && (
          <div className="flex justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="max-h-12 max-w-[160px] object-contain" />
          </div>
        )}

        {modelo.titulo && (
          <p className="text-center font-bold tracking-wide">{p(modelo.titulo)}</p>
        )}
        {modelo.cabecalho && (
          <p className="text-center">{p(modelo.cabecalho)}</p>
        )}

        <p className="border-t border-dashed border-gray-300 my-3" />

        <Linha rotulo="Cliente" valor={EXEMPLO.cliente} />
        <Linha rotulo="Data" valor={EXEMPLO.data} />
        {modelo.mostrar_vendedor && <Linha rotulo="Cobrador" valor={EXEMPLO.vendedor} />}

        <p className="border-t border-dashed border-gray-300 my-3" />

        <Linha rotulo={`Parcela ${EXEMPLO.parcela}`} valor={EXEMPLO.valor_pago} />
        {modelo.mostrar_saldo && <Linha rotulo="Saldo" valor={EXEMPLO.saldo} negrito />}
        {modelo.mostrar_proximo_vencimento && (
          <Linha rotulo="Próximo venc." valor={EXEMPLO.proximo_vencimento} />
        )}

        {modelo.rodape && (
          <>
            <p className="border-t border-dashed border-gray-300 my-3" />
            <p className="text-center">{p(modelo.rodape)}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, negrito }: { rotulo: string; valor: string; negrito?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={negrito ? 'font-bold' : ''}>{rotulo}</span>
      <span className={`tabular-nums ${negrito ? 'font-bold' : ''}`}>{valor}</span>
    </div>
  );
}

// ─── O editor ────────────────────────────────────────────────────────

const MARCADORES: { chave: keyof DadosRecibo; descricao: string }[] = [
  { chave: 'cliente', descricao: 'Nome do cliente' },
  { chave: 'valor_pago', descricao: 'Valor pago agora' },
  { chave: 'parcela', descricao: 'Parcela, ex.: 7/20' },
  { chave: 'saldo', descricao: 'Saldo do empréstimo' },
  { chave: 'proximo_vencimento', descricao: 'Data do próximo vencimento' },
  { chave: 'data', descricao: 'Data do pagamento' },
  { chave: 'empresa', descricao: 'Nome da empresa' },
  { chave: 'vendedor', descricao: 'Nome do cobrador' },
];

interface Props {
  modelo: ModeloRecibo;
  onChange: (modelo: ModeloRecibo) => void;
  logoUrl?: string;
}

export function EditorModeloRecibo({ modelo, onChange, logoUrl }: Props) {
  const set = <K extends keyof ModeloRecibo>(chave: K, valor: ModeloRecibo[K]) =>
    onChange({ ...modelo, [chave]: valor });

  const mensagemPreenchida = useMemo(
    () => preencherMarcadores(modelo.mensagem_whatsapp, EXEMPLO),
    [modelo.mensagem_whatsapp],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900">Modelo do recibo de pagamento</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Edição ── */}
        <div className="space-y-3">
          <Campo
            rotulo="Título"
            valor={modelo.titulo}
            onChange={(v) => set('titulo', v)}
            dica="Linha de cima, em destaque."
          />
          <Campo
            rotulo="Cabeçalho"
            valor={modelo.cabecalho}
            onChange={(v) => set('cabecalho', v)}
            dica="Logo abaixo do título. Aceita marcadores."
          />
          <Campo
            rotulo="Rodapé"
            valor={modelo.rodape}
            onChange={(v) => set('rodape', v)}
            dica="Última linha do comprovante."
          />

          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white space-y-2">
            <p className="text-sm font-medium text-gray-700">O que mostrar</p>
            <Chave
              rotulo="Saldo do empréstimo"
              marcado={modelo.mostrar_saldo}
              onChange={(v) => set('mostrar_saldo', v)}
            />
            <Chave
              rotulo="Próximo vencimento"
              marcado={modelo.mostrar_proximo_vencimento}
              onChange={(v) => set('mostrar_proximo_vencimento', v)}
            />
            <Chave
              rotulo="Nome do cobrador"
              marcado={modelo.mostrar_vendedor}
              onChange={(v) => set('mostrar_vendedor', v)}
            />
          </div>

          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              Mensagem que acompanha a imagem
            </label>
            <textarea
              value={modelo.mensagem_whatsapp}
              onChange={(e) => set('mensagem_whatsapp', e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {/* O recibo é a imagem; esta é a legenda que vai junto na conversa.
                Mostrar o texto já preenchido evita a surpresa de ver
                "Olá {cliente}" chegando literalmente no WhatsApp de alguém. */}
            <p className="mt-2 text-xs text-gray-500">
              Vai sair assim: <span className="text-gray-700">{mensagemPreenchida}</span>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Marcadores — escreva entre chaves e o app troca pelo valor
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {MARCADORES.map((m) => (
                <p key={m.chave} className="text-xs text-gray-500">
                  <code className="text-gray-700">{`{${m.chave}}`}</code> {m.descricao}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* ── Prévia ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Como vai sair</p>
          <Previa modelo={modelo} logoUrl={logoUrl} />
          <p className="text-xs text-gray-500">
            Os dados são de exemplo. A logo é a que está configurada acima.
          </p>
        </div>
      </div>
    </div>
  );
}

function Campo({
  rotulo, valor, onChange, dica,
}: { rotulo: string; valor: string; onChange: (v: string) => void; dica?: string }) {
  return (
    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
      <label className="block text-sm font-medium text-gray-700 mb-2">{rotulo}</label>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
      />
      {dica && <p className="mt-1.5 text-xs text-gray-500">{dica}</p>}
    </div>
  );
}

function Chave({
  rotulo, marcado, onChange,
}: { rotulo: string; marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={marcado}
        onChange={() => onChange(!marcado)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{rotulo}</span>
    </label>
  );
}
