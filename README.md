# 🛣️ Apprutea

**Sistema de Gestão de Microcrédito e Rotas**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)](https://supabase.com/)

## 📋 Sobre

Apprutea é um sistema completo de gestão de microcrédito com suporte a rotas de cobrança, liquidação diária, controle de clientes e empréstimos.

### 🌐 Suporte Bilíngue
- 🇧🇷 Português (Brasil)
- 🇪🇸 Español

## 🚀 Tecnologias

- **Frontend:** Next.js 14 (App Router) + TypeScript
- **Estilização:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL)
- **Deploy:** Vercel
- **i18n:** next-intl

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/mneba/apprutea.git

# Entre no diretório
cd apprutea

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# Execute em desenvolvimento
npm run dev
```

## 🔐 Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon
```

## 📁 Estrutura do Projeto

```
apprutea/
├── src/
│   ├── app/
│   │   └── [locale]/           # Rotas com suporte i18n
│   │       ├── (auth)/
│   │       │   └── login/      # Página de login
│   │       └── (dashboard)/    # Área logada (em breve)
│   ├── components/
│   │   ├── ui/                 # Componentes base
│   │   └── layout/             # Componentes de layout
│   ├── lib/
│   │   ├── supabase/           # Clientes Supabase
│   │   └── utils.ts            # Utilitários
│   ├── i18n/                   # Configuração i18n
│   ├── messages/               # Traduções (pt-BR, es)
│   └── types/                  # TypeScript types
├── public/                     # Assets estáticos
└── docs/                       # Documentação
```

## 🎯 Módulos

| Módulo | Status | Descrição |
|--------|--------|-----------|
| Login | ✅ Pronto | Autenticação por email ou código |
| Dashboard | 🔄 Em breve | Visão geral do sistema |
| Liquidação | 🔄 Em breve | Controle diário de sessões |
| Clientes | 🔄 Em breve | Gestão de clientes |
| Empréstimos | 🔄 Em breve | Controle de empréstimos |
| Pagamentos | 🔄 Em breve | Registro de pagamentos |
| Relatórios | 🔄 Em breve | Analytics e relatórios |
| Configurações | 🔄 Em breve | Configurações do sistema |

## 🔒 Tipos de Usuário

| Tipo | Acesso |
|------|--------|
| SUPER_ADMIN | Total |
| ADMIN | Por empresa |
| MONITOR | Por rotas |
| USUARIO_PADRAO | Limitado |
| VENDEDOR | App móvel |

## 📱 Apps Relacionados

- **Webapp Admin** (este projeto) - Gestão completa via web
- **App Vendedor** (Replit) - PWA para vendedores em campo

## 🚀 Deploy

O projeto está configurado para deploy automático na Vercel:

1. Conecte o repositório GitHub na Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push na `main`

## 📄 Licença

Projeto privado - Todos os direitos reservados.

---

**Cliente:** Bella Kids  
**Versão:** 0.1.0  
**Última Atualização:** Junho 2025
