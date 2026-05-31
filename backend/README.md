# Clipping4me — Backend no seu Mac

Roda no seu Mac e expõe o backend em `https://api.clipping4.me` via Cloudflare Tunnel.

> **Quer deixar tudo definitivo no seu domínio?**
> Veja **[DEPLOY_MAC.md](./DEPLOY_MAC.md)** — passo a passo de Cloudflare + LaunchAgent.

## 1. Instalar dependências de sistema (uma vez)

```bash
# Homebrew (se ainda não tiver): https://brew.sh
brew install python@3.11 ffmpeg yt-dlp ollama
```

Depois suba o Ollama e baixe um modelo:

```bash
brew services start ollama
ollama pull qwen2.5-coder:7b # pode trocar depois se quiser
```

## 2. Subir o backend

```bash
cd /Users/axis/Dev/clipping4me/backend
ADMIN_BOOTSTRAP_PASSWORD='SuaSenhaForte' bash run.sh
```

Na primeira execução o `run.sh` prefere Python 3.11, cria `.venv`, instala tudo e cria um usuário admin (`admin` por padrão) com a senha que você passar em `ADMIN_BOOTSTRAP_PASSWORD`. Whisper baixa ~500MB do modelo na primeira transcrição.

Sem `ADMIN_BOOTSTRAP_PASSWORD`, uma senha aleatória é gerada e impressa **uma vez** no log — anote.

Saída esperada:
```
Uvicorn running on http://0.0.0.0:8765
```

Teste:
```bash
curl http://localhost:8765/health
# {"ok": true}
```

## 3. Conectar a UI

1. Abra a UI. Vai aparecer a tela de login.
2. Entre com `admin` + sua senha (ou outro valor, se você definir `ADMIN_USERNAME`).
3. O padrão já é `https://api.clipping4.me`, então normalmente você não precisa trocar nada.
4. Pra criar mais usuários: menu **Admin** (só visível pra admins).

## Estrutura de arquivos gerados

Tudo fica em `~/Clipping4me/` por padrão, com o repo em `/Users/axis/Dev/clipping4me`:

```
~/Clipping4me/
├── Cortes/                              # output final, organizado por podcast
│   └── 2026-05-30 Flow Podcast/
│       └── 01 - O erro que todo iniciante comete/
│           ├── 01 Render final/render.mp4
│           ├── 02 Sequencia de cortes/
│           └── 03 Materiais/
│               ├── descricao.txt
│               ├── observacoes.txt
│               ├── legenda.srt
│               └── thumb.jpg
├── Jobs/                                # arquivos de trabalho por job (downloads, audio.wav, etc.)
├── Cache/
├── media/                               # symlinks que o backend serve em /media
└── jobs.json                            # estado (persistência simples)
```

## Variáveis de ambiente

| Var | Default | O que faz |
|---|---|---|
| `CLIPPING4ME_ROOT` | `~/Clipping4me` | onde tudo é salvo |
| `OLLAMA_URL` | `http://localhost:11434` | endpoint do Ollama |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | modelo usado para escolher cortes |
| `FRONTEND_URL` | `https://clipping4.me` | frontend autorizado no CORS |
| `WHISPER_MODEL` | `small` | `tiny`, `base`, `small`, `medium`, `large` |
| `MAX_CLIPS` | `8` | máximo de cortes por job |
| `CLIP_MIN_SEC` / `CLIP_MAX_SEC` | `30` / `90` | duração-alvo dos cortes |

## Como funciona

```
POST /jobs          (YouTube)            ┐
POST /jobs/upload   (upload de vídeo)    │
                                         ▼
              ┌── BackgroundTask ──┐
              │  yt-dlp / arquivo  │  → ~/Clipping4me/Jobs/<id>/source.mp4
              │  ffmpeg → WAV 16k  │
              │  Whisper (local)   │  → segments com timestamps
              │  Ollama (local)    │  → JSON com cortes escolhidos
              │  ffmpeg cortes 9:16│  → render.mp4 + thumb.jpg
              └────────────────────┘
                       │
                       ▼
         GET /jobs/<id>  → estado + clips
         /media/<job>/<clip>/render.mp4  (servido como arquivo estático)
```

## Problemas comuns

- **`ModuleNotFoundError: No module named 'pkg_resources'` ao instalar `openai-whisper`** → rode `bash run.sh`; ele já instala com `setuptools<81` e `--no-build-isolation`.
- **`ollama: command not found`** → `brew install ollama && brew services start ollama`.
- **`yt-dlp: HTTP 403`** → atualize: `brew upgrade yt-dlp`.
- **Whisper muito lento** → use `WHISPER_MODEL=base` ou `tiny`.
- **LLM devolve JSON inválido** → o backend já faz fallback; se persistir, troque o modelo (`qwen2.5:7b` costuma ser mais obediente).
- **UI continua em "modo demo"** → confira `curl http://localhost:8765/health` e se o tunnel do Cloudflare está ativo para `api.clipping4.me`.