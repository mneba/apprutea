import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, empresaId, forcarRenovacao = false } = await request.json();

    if (!email || !empresaId) {
      return NextResponse.json(
        { erro: 'E-mail e empresa são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verificar se usuário logado é ADMIN ou SUPER_ADMIN
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
    }

    const { data: perfil } = await supabase
      .from('user_profiles')
      .select('tipo_usuario')
      .eq('user_id', user.id)
      .single();

    if (!perfil || !['SUPER_ADMIN', 'ADMIN'].includes(perfil.tipo_usuario)) {
      return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 });
    }

    // Criar ou renovar convite via RPC
    const { data: resultado, error } = await supabase.rpc('fn_criar_convite', {
      p_email: email,
      p_empresa_id: empresaId,
      p_criado_por: user.id,
      p_forcar_renovacao: forcarRenovacao,
    });

    if (error) throw error;

    // Se não sucesso, retornar o status para o frontend tratar
    if (!resultado.sucesso) {
      return NextResponse.json(resultado, { status: 200 });
    }

    // Buscar nome da empresa
    const { data: empresa } = await supabase
      .from('empresas')
      .select('nome')
      .eq('id', empresaId)
      .single();

    // Montar link do convite
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
        sender: {
          name: 'Apprutea',
          email: 'noreply@apprutea.com',
        },
        to: [{ email }],
        subject: `Você foi convidado para a ${empresa?.nome || 'empresa'} no Apprutea`,
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 40px;text-align:center;">
                        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Apprutea</h1>
                        <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Sistema de Gestão de Microcrédito</p>
                      </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                      <td style="padding:40px;">
                        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">Você foi convidado! 🎉</h2>
                        <p style="margin:0 0 16px;color:#6b7280;font-size:15px;line-height:1.6;">
                          Você recebeu um convite para fazer parte da equipe da
                          <strong style="color:#111827;">${empresa?.nome || 'empresa'}</strong>
                          no Apprutea.
                        </p>
                        <p style="margin:0 0 32px;color:#6b7280;font-size:15px;line-height:1.6;">
                          Clique no botão abaixo para criar sua conta. O link é válido por <strong>7 dias</strong>.
                        </p>

                        <!-- Botão -->
                        <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                          <tr>
                            <td style="background-color:#2563eb;border-radius:8px;">
                              <a href="${linkConvite}"
                                style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">
                                Criar minha conta →
                              </a>
                            </td>
                          </tr>
                        </table>

                        <!-- Link alternativo -->
                        <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;">
                          Se o botão não funcionar, copie e cole o link abaixo:
                        </p>
                        <p style="margin:0;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;font-size:12px;color:#6b7280;word-break:break-all;">
                          ${linkConvite}
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
                        <p style="margin:0;color:#9ca3af;font-size:12px;">
                          Se você não esperava este convite, pode ignorar este e-mail.
                        </p>
                        <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
                          © ${new Date().getFullYear()} Apprutea. Todos os direitos reservados.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
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
        ? 'Convite renovado e e-mail reenviado com sucesso.'
        : 'Convite enviado com sucesso.',
    });

  } catch (err: any) {
    console.error('Erro ao enviar convite:', err);
    return NextResponse.json(
      { erro: err.message || 'Erro interno' },
      { status: 500 }
    );
  }
}