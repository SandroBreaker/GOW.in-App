
# 🎮 GOW.in - Plataforma de iGaming Mobile-First

> Uma plataforma de jogos de aposta simulada, desenvolvida com **Vanilla JavaScript**, **HTML5**, **CSS3** e **Supabase**.

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-purple)
![Tech](https://img.shields.io/badge/Stack-VanillaJS-yellow)
![Backend](https://img.shields.io/badge/Backend-Supabase-green)

## 📋 Sobre o Projeto

**GOW.in** é uma aplicação web do tipo SPA (Single Page Application) focada na experiência mobile para jogos de azar (Slots, Crash e Tower). O projeto foi construído sem frameworks frontend (como React ou Vue), utilizando JavaScript puro e Módulos ES6 para garantir leveza e alta performance.

A persistência de dados (usuários, saldo, transações) é gerenciada pelo **Supabase** (PostgreSQL), e o sistema de pagamentos simula uma integração com a **Invictus Pay** via PIX.

---

## 🚀 Tecnologias Utilizadas

*   **Frontend:** HTML5 Semântico, CSS3 (Grid/Flexbox, Variáveis, Animações), Vanilla JavaScript (ES Modules).
*   **Backend / Database:** Supabase (Auth, Database, Realtime).
*   **Pagamentos:** Integração API REST (Invictus Pay) com Polling System.
*   **Gráficos:** HTML5 Canvas (para jogos como Aviator e efeitos de partículas).

---

## 📂 Estrutura de Pastas

```bash
/
├── index.html          # Ponto de entrada (SPA Router)
├── styles.css          # Estilos globais e Design System
├── js/
│   ├── main.js         # Lógica principal, Auth, Inicialização
│   ├── ui.js           # Manipulação do DOM, Renderização de componentes
│   ├── data.js         # Store local (volátil) e Configurações
│   └── supabaseClient.js # Cliente de conexão com o Banco de Dados
├── gameList/           # Jogos desenvolvidos internamente
│   ├── aviator/        # Jogo Crash (Canvas)
│   ├── dragon-cave/    # Jogo Tower/Mines
│   ├── akatsuki/       # Slot 5x4 (Naruto Theme)
│   ├── god of war/     # Slot 3x3 (GoW Theme)
│   ├── elden ring/     # Slot 5x4 (Elden Ring Theme)
│   └── Kaizoku-slot/   # Slot 3x3 (One Piece Theme)
└── assets/             # (Deve ser criada) Para imagens e sons locais
```

---

## 🎰 Jogos Disponíveis

### 1. Aviator Pro (Crash)
*   **Mecânica:** Canvas HTML5 desenhando curva exponencial Bézier.
*   **Features:** Histórico de rodadas, auto-looping, lógica de crash probabilística.

### 2. Dragon's Cave (Tower/Mines)
*   **Mecânica:** Grid progressivo. O jogador deve escolher ovos para subir de nível sem acordar o dragão.
*   **Features:** Multiplicadores progressivos, cashout a qualquer momento.

### 3. Slots Temáticos (Akatsuki, One Piece, GoW, Elden Ring)
*   **Mecânica:** Algoritmo Zig-Zag e Line-Match.
*   **Features:**
    *   **Akatsuki/Elden Ring:** Grid 5x4, alta volatilidade.
    *   **Kaizoku/GoW:** Grid 3x3, mecânica clássica.
    *   **Visual:** Ícones temáticos e efeitos CSS/Canvas para linhas de vitória.

---

## 💳 Sistema Financeiro

O projeto implementa um fluxo financeiro robusto:

1.  **Carteira (Wallet):** Saldo gerido no banco de dados com travas de segurança (Row Locking) para evitar saldo negativo.
2.  **Depósito (PIX):**
    *   Formulário com validação de CPF e busca de CEP (ViaCEP).
    *   Geração de QR Code via API Invictus Pay.
    *   **Polling:** O frontend verifica o status do pagamento a cada 5s e libera o saldo automaticamente após confirmação (`PAID`).
3.  **Transações:** Histórico completo de `DEPOSIT`, `WITHDRAW`, `GAME_WIN` e `GAME_BET` salvo no Supabase.

---

## 🛠️ Instalação e Configuração

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/gow-in.git
cd gow-in
```

### 2. Configurar Supabase
No painel do Supabase, execute o seguinte SQL para criar as tabelas necessárias:

```sql
-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabelas
CREATE TABLE public.players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    cpf TEXT UNIQUE,
    phone TEXT,
    vip_level INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.wallets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES public.players(id),
    balance NUMERIC(12, 2) DEFAULT 0.00 CHECK (balance >= 0)
);

CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES public.players(id),
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    external_id TEXT,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para carteira
CREATE OR REPLACE FUNCTION public.handle_new_player() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (player_id, balance) VALUES (NEW.id, 0.00);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_player_created AFTER INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.handle_new_player();

-- Função RPC para adicionar saldo (usada pelo Polling)
CREATE OR REPLACE FUNCTION public.add_balance(p_id UUID, amount NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    UPDATE public.wallets SET balance = balance + amount WHERE player_id = p_id;
    RETURN (SELECT balance FROM public.wallets WHERE player_id = p_id);
END;
$$ LANGUAGE plpgsql;
```

### 3. Assets (Imagens)
**Importante:** Como o projeto usa caminhos relativos para imagens nos jogos, você deve popular a pasta `gameList/[jogo]/assets/symbols/` com imagens `.png` ou editar os arquivos `app.js` de cada jogo para usar URLs externas.

### 4. Rodar o Projeto
Como o projeto utiliza ES Modules (`type="module"`), você precisa de um servidor local. Não abra o `index.html` diretamente no navegador.

Use o **Live Server** (VS Code) ou Python:
```bash
python3 -m http.server 8000
# Acesse http://localhost:8000
```

---

## ⚠️ Aviso Legal

Este projeto é uma **prova de conceito (PoC)** educacional para demonstração de habilidades em Engenharia de Software e Design de Interface.
*   Não envolve dinheiro real (o saldo é fictício ou ambiente de sandbox).
*   Não incentivamos jogos de azar.

---

**Desenvolvido com 💜 por [Seu Nome/GOW Team]**
