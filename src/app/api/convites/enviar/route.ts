import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando envio de convite');
    const body = await request.json();
    console.log('📦 Body recebido:', { email: body.email, empresaId: body.empresaId });
    const { email, empresaId, forcarRenovacao = false } = body;

    if (!email || !empresaId) {
      return NextResponse.json({ erro: 'E-mail e empresa são obrigatórios' }, { status: 400 });
    }

    // Client server-side para pegar o usuário logado via cookies
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }

    // Client admin para operações privilegiadas
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar se é ADMIN ou SUPER_ADMIN
    const { data: perfil } = await supabaseAdmin
      .from('user_profiles')
      .select('tipo_usuario')
      .eq('user_id', user.id)
      .single();

    if (!perfil || !['SUPER_ADMIN', 'ADMIN'].includes(perfil.tipo_usuario)) {
      return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
    }

    // Criar ou renovar convite
    const { data: resultado, error } = await supabaseAdmin.rpc('fn_criar_convite', {
      p_email: email,
      p_empresa_id: empresaId,
      p_criado_por: user.id,
      p_forcar_renovacao: forcarRenovacao,
    });

    if (error) throw error;

    if (!resultado.sucesso) {
      return NextResponse.json(resultado, { status: 200 });
    }

    // Buscar nome da empresa
    const { data: empresa } = await supabaseAdmin
      .from('empresas')
      .select('nome')
      .eq('id', empresaId)
      .single();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://apprutea.vercel.app';
    const linkConvite = `${baseUrl}/pt-BR/registro?convite=${resultado.token}`;

    // Enviar e-mail via Brevo
    const respostaBrevo = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Apprutea', email: 'noreply@apprutea.com' },
        to: [{ email }],
        subject: `Você foi convidado para a ${empresa?.nome || 'empresa'} no Apprutea`,
        htmlContent: `
          <!DOCTYPE html><html><head><meta charset="utf-8"></head>
          <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
                      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Apprutea</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="margin:0 0 16px;color:#111827;">Você foi convidado! 🎉</h2>
                      <p style="color:#6b7280;font-size:15px;line-height:1.6;">
                        Você recebeu um convite para a <strong>${empresa?.nome || 'empresa'}</strong> no Apprutea.
                        O link é válido por <strong>7 dias</strong>.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
                        <tr>
                          <td style="background-color:#2563eb;border-radius:8px;">
                            <a href="${linkConvite}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                              Criar minha conta →
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="color:#9ca3af;font-size:12px;word-break:break-all;">${linkConvite}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                      <p style="color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} Apprutea.</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body></html>
        `,
      }),
    });

    if (!respostaBrevo.ok) {
      const erroBrevo = await respostaBrevo.json();
      console.error('Erro Brevo:', erroBrevo);
      throw new Error('Falha ao enviar e-mail');
    }

    return NextResponse.json({
      sucesso: true,
      status: resultado.status,
      mensagem: resultado.status === 'RENOVADO'
        ? 'Convite renovado e reenviado.'
        : 'Convite enviado com sucesso.',
    });

  } catch (err: any) {
    console.error('Erro ao enviar convite - detalhes:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return NextResponse.json({ erro: err.message || 'Erro interno' }, { status: 500 });
  }
}