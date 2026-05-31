# Clipping4Me

Plataforma para gerar clipes curtos a partir de vídeos longos (YouTube, upload ou SRT) usando transcrição com Whisper e curadoria com LLM via Ollama. O frontend é hospedado pela Lovable (`clipping4.me`) e o backend roda localmente no seu Mac, exposto via Cloudflare Tunnel em `api.clipping4.me`.

- **Frontend (produção):** https://www.clipping4.me
- **Frontend (preview):** https://clipping4me.lovable.app
- **Backend público:** https://api.clipping4.me (tunnel para `localhost:8765` no seu Mac)

## Arquitetura

```text
Browser  ──►  www.clipping4.me (TanStack Start na Lovable)
               │
               ▼ chamadas HTTPS autenticadas
         api.clipping4.me (Cloudflare Tunnel)
               │
               ▼
         localhost:8765  (FastAPI no seu Mac)
               │
               ├── ffmpeg / yt-dlp  → download + corte
               ├── openai-whisper   → transcrição
               └── Ollama (qwen2.5) → seleção dos clipes
```

## Stack

- **Frontend:** React 19, TanStack Start, TanStack Query, Tailwind v4, shadcn/ui, framer-motion
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic v2, bcrypt, httpx
- **Mídia:** ffmpeg, yt-dlp, openai-whisper
- **LLM:** Ollama local (`qwen2.5-coder:7b` por padrão)
- **Túnel:** cloudflared

## Requisitos

- macOS com Homebrew
- Conta Cloudflare com o domínio `clipping4.me` (ou outro que você ajuste)
- ~5 GB livres (Whisper baixa ~500 MB no primeiro uso; modelos Ollama 4–8 GB)
- Dependências Python: use apenas [`backend/requirements.txt`](backend/requirements.txt).

## Setup rápido no Mac

### 1. Clonar

```bash
mkdir -p /Users/axis/Dev
cd /Users/axis/Dev
git clone https://github.com/alexisqrodrigues-oss/clipping4me.git
cd /Users/axis/Dev/clipping4me
```

### 2. Instalar dependências de sistema (uma vez)

```bash
brew install python@3.11 ffmpeg yt-dlp ollama cloudflared
brew services start ollama
ollama pull qwen2.5-coder:7b
```

### 3. Configurar o tunnel para `api.clipping4.me` (uma vez)

```bash
cloudflared tunnel login
bash backend/install-cloudflare.sh
```

### 4. Subir tudo

Duplo clique em `Clipping4Me.command`, ou via terminal:

```bash
ADMIN_BOOTSTRAP_PASSWORD='troque-isto' bash run.sh
```

A primeira execução cria o `.venv`, instala o `requirements.txt`, cria o usuário `admin` e abre a UI já apontando para o backend correto. Sem `ADMIN_BOOTSTRAP_PASSWORD`, uma senha aleatória é impressa **uma vez** no log — anote.

### 5. Auto-start após reboot (opcional)

```bash
bash backend/install-launchagent.sh
```

## Variáveis de ambiente principais (backend)

| Variável | Default | Descrição |
|---|---|---|
| `ADMIN_USERNAME` | `admin` | Usuário administrador inicial |
| `ADMIN_BOOTSTRAP_PASSWORD` | (aleatória) | Senha gravada no primeiro start |
| `OLLAMA_URL` | `http://localhost:11434` | Endpoint do Ollama |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | Modelo usado para sugerir clipes |
| `WHISPER_MODEL` | `small` | Modelo Whisper (`tiny`/`base`/`small`/`medium`) |
| `CLIPPING4ME_ROOT` | `~/Clipping4me` | Pasta raiz para jobs, mídia e estado |
| `HF_TOKEN` | (vazio) | Token necessário para diarização com WhisperX/pyannote |

Para detalhes de cada arquivo do backend, ver [`backend/README.md`](backend/README.md) e [`backend/DEPLOY_MAC.md`](backend/DEPLOY_MAC.md).

## Estrutura do repo

```text
clipping4me/
├── Clipping4Me.command         # atalho de duplo clique no Finder
├── run.sh                      # bootstrap (sobe Ollama + backend + UI)
├── README.md
├── public/                     # ativos estáticos do frontend
├── src/                        # frontend TanStack Start
│   ├── routes/                 # rotas file-based
│   ├── components/             # UI (shadcn + custom)
│   ├── lib/                    # client de backend, server fns
│   └── styles.css              # design tokens (Tailwind v4)
└── backend/
    ├── run.sh                  # cria .venv, instala deps, sobe FastAPI
    ├── requirements.txt        # deps Python canônicas
    ├── install-cloudflare.sh   # configura o tunnel
    ├── install-launchagent.sh  # auto-start no login do Mac
    └── app/
        ├── main.py             # rotas FastAPI
        ├── auth.py             # login + roles + bcrypt
        ├── pipeline.py         # download → transcrição → corte
        ├── cutter.py           # ffmpeg
        ├── llm.py              # cliente Ollama
        ├── storage.py          # persistência de jobs
        └── models.py           # schemas Pydantic
```

## Segurança

- Login obrigatório; admin gerencia usuários em `/admin`.
- Senhas com bcrypt; sem texto plano em disco.
- Cada job é isolado por `user_id` (multi-tenant); endpoints checam ownership.
- SSRF mitigado: downloads remotos restritos a `youtube.com` / `youtu.be`.
- Uploads limitados a 10 GB e extensões de áudio/vídeo conhecidas.
- A URL do backend não pode ser sobrescrita pelo cliente.

## Licença

Uso interno. Adicione um `LICENSE` se for abrir o repo.