# Clipping4me — Backend local

Roda 100% no seu Mac. A UI (este projeto Lovable) fala com este backend em `http://localhost:8000`.

## 1. Instalar dependências de sistema (uma vez)

```bash
# Homebrew (se ainda não tiver): https://brew.sh
brew install python@3.11 ffmpeg yt-dlp ollama
```

Depois suba o Ollama e baixe um modelo:

```bash
brew services start ollama
ollama pull llama3.1:8b      # ~5GB. Pode trocar por qwen2.5:7b, mistral, etc.
```

## 2. Subir o backend

```bash
cd backend
bash run.sh
```

Na primeira execução vai criar `.venv` e instalar tudo (Whisper baixa ~500MB do modelo na primeira transcrição).

Saída esperada:
```
Uvicorn running on http://0.0.0.0:8000
```

Teste:
```bash
curl http://localhost:8000/health
# {"ok": true}
```

## 3. Conectar a UI

No projeto Lovable a UI lê `VITE_BACKEND_URL`. O default já é `http://localhost:8000`, então **não precisa configurar nada** — basta abrir a UI com o backend rodando. O indicador "modo demo / backend conectado" no canto superior direito da home avisa quando ela conecta.

## Estrutura de arquivos gerados

Tudo fica em `~/Clipping4me/`:

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
| `OLLAMA_MODEL` | `llama3.1:8b` | modelo usado para escolher cortes |
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

- **`ollama: command not found`** → `brew install ollama && brew services start ollama`.
- **`yt-dlp: HTTP 403`** → atualize: `brew upgrade yt-dlp`.
- **Whisper muito lento** → use `WHISPER_MODEL=base` ou `tiny`.
- **LLM devolve JSON inválido** → o backend já faz fallback; se persistir, troque o modelo (`qwen2.5:7b` costuma ser mais obediente).
- **UI continua em "modo demo"** → confira `curl http://localhost:8000/health` e que não tem nada em `localhost:8000` bloqueando.