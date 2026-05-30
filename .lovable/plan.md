
# Clipping4me — Plano de Ação

## Visão geral

Sistema que recebe vídeo (YouTube ou upload), transcreve, usa LLM local para identificar cortes virais e exporta takes em uma estrutura organizada de pastas no seu Mac.

## Atenção sobre stack (importante)

O template Lovable roda no runtime serverless (Cloudflare Workers). Ele **não consegue** executar `yt-dlp`, `ffmpeg`, `whisper.cpp` nem `ollama` — esses processos exigem o sistema operacional do seu Mac com acesso a disco, GPU e binários nativos.

Solução: dois processos rodando no seu Mac em paralelo:

```text
┌─────────────────────────┐        ┌────────────────────────────────┐
│  UI Web (Lovable)       │ HTTP   │  Backend local Python (FastAPI)│
│  React + Tailwind       │ ─────► │  - yt-dlp                      │
│  http://localhost:5173  │  WS    │  - whisper.cpp                 │
│                         │ ◄───── │  - ollama (LLM)                │
└─────────────────────────┘        │  - ffmpeg                      │
                                   │  - escreve em ~/Clipping4me    │
                                   └────────────────────────────────┘
```

A UI será desenvolvida no Lovable (rápido de iterar). O backend Python ficará num repo separado que você roda no terminal do Mac (`uvicorn app:api`). O Lovable cuida da interface; o "trabalho pesado" fica no backend local que você controla.

## Fase 0 — Bootstrap (~1 dia)

- Criar repo paralelo `clipping4me-backend` (Python 3.11 + FastAPI + uvicorn).
- Instalar dependências locais: `yt-dlp`, `ffmpeg` (brew), `whisper.cpp` (modelo `large-v3` ou `medium`), `ollama` (com `llama3.1:8b` ou `qwen2.5:14b`).
- Definir contrato HTTP entre UI e backend (endpoints + payloads).
- Estrutura de pastas raiz: `~/Clipping4me/Cortes/`, `~/Clipping4me/Jobs/` (work-in-progress), `~/Clipping4me/Cache/` (vídeos baixados).

## Fase 1 — MVP funcional (foco agora)

### 1.1 UI no Lovable
- Tela única "Nova ingestão": tabs **Link YouTube** | **Upload arquivo** | **Upload SRT**.
- Campo de instruções customizadas para o LLM (estilo, tom, tema preferido).
- Lista de jobs com status em tempo real (WebSocket): `baixando → transcrevendo → analisando → cortando → pronto`.
- Tela "Cortes": grid de cards por job, cada card mostra título, duração, preview do take e botão "Abrir pasta no Finder" (via endpoint do backend que chama `open`).

### 1.2 Backend — pipeline
Endpoints REST:
- `POST /jobs` — cria job (recebe link/upload/srt + instruções).
- `GET /jobs` e `GET /jobs/:id` — lista/detalhe.
- `WS /jobs/:id/stream` — eventos de progresso.
- `POST /jobs/:id/open` — abre pasta no Finder.

Pipeline por job:
1. **Ingestão**: se link, `yt-dlp` baixa vídeo + tenta SRT auto-gerado; se upload, salva em cache; se SRT enviado, pula transcrição.
2. **Transcrição** (se faltar SRT): `whisper.cpp` com timestamps por palavra → gera `.srt` e `.json` com timing preciso.
3. **Análise LLM** (Ollama local): envia SRT + instruções do usuário + system prompt focado em "cortes virais" e recebe JSON estruturado:
   ```json
   {
     "podcast_title": "...",
     "clips": [
       {
         "title": "...",
         "description": "...",
         "observations": "...",
         "music_suggestion": "...",
         "thumbnail_copy": "...",
         "segments": [
           {"role": "hook", "start": 123.4, "end": 130.2, "text": "..."},
           {"role": "dev", "start": 220.0, "end": 245.5, "text": "..."},
           {"role": "close", "start": 410.1, "end": 425.0, "text": "..."}
         ]
       }
     ]
   }
   ```
   Restrições no prompt: duração total 30–60s, sempre hook+desenvolvimento+fechamento, evitar mid-sentence cuts (snap para fronteiras de palavra do SRT).
4. **Corte com ffmpeg**: para cada segmento, `ffmpeg -ss X -to Y -c copy` (rápido, sem re-encode). Gera os arquivos `01_hook.mp4`, `02_...mp4`, etc.
5. **Materiais**: extrai SRT do trecho (recalculando timestamps relativos), escreve `descricao.txt` e `observacoes.txt` a partir do JSON do LLM. `Imagens de apoio` e `Musica` ficam como pastas vazias por enquanto.
6. **`01 Render final`**: vazio no MVP (será populado quando o editor existir — confirmado por você).

### 1.3 Estrutura de saída
```text
~/Clipping4me/Cortes/2026-05-30 Nome do Podcast/01 - Titulo do Corte/
├── 01 Render final/          (vazio até Fase 4)
├── 02 Sequencia de cortes/
│   ├── 01_hook.mp4
│   ├── 02_dev.mp4
│   └── 03_close.mp4
└── 03 Materiais/
    ├── Imagens de apoio/
    ├── Musica/
    ├── descricao.txt
    ├── observacoes.txt
    └── titulo_do_corte.srt
```

### Critério de aceite do MVP
Você cola um link de podcast de 2h, espera ~10–20min, abre o Finder e tem 5–10 pastas de cortes prontas para editar manualmente.

## Fase 2 — Qualidade do LLM (~1 semana após MVP)

- Few-shot examples no prompt com cortes virais reais que você curou.
- Sistema de feedback: na UI, botões 👍/👎 por corte → salva em SQLite local → vira contexto para próximos jobs ("usuário gosta de X, evita Y").
- Suporte a múltiplos perfis de instrução ("modo entrevista", "modo palestra técnica", "modo polêmica").
- Detecção de "momentos de alta energia" via análise de waveform (volume/pitch) como dica adicional ao LLM.

## Fase 3 — Refinamento dos cortes

- Snap automático em fronteiras de frase usando word-level timestamps.
- Detecção de silêncio com `ffmpeg silencedetect` para evitar começar/terminar no meio da respiração.
- Re-encode opcional com normalização de áudio (`loudnorm`) e crop para 9:16 com tracking simples do rosto (via `mediapipe` ou OpenCV — opcional).
- Geração automática de SRT estilizado (ASS) com palavra-por-palavra highlight.

## Fase 4 — Editor visual interno (grande)

Este é o salto de complexidade. Quebrado em sub-fases:

### 4.1 Timeline básica
- Editor de timeline web (canvas/WebGL via PixiJS ou Konva).
- Tracks de vídeo, áudio e legenda.
- Operações: trim, split, reorder, transform (scale/rotate/position), speed, volume, fade.
- Preview em tempo real usando `<video>` + Web Audio API; render final via `ffmpeg` no backend.

### 4.2 Bancos de assets
- Integração com Pexels/Pixabay (vídeo/imagem grátis) + Freesound/YouTube Audio Library (música).
- Biblioteca local de fontes e presets de texto.
- LLM sugere termos de busca a partir do `observacoes.txt`.

### 4.3 Editor de legenda
- Auto-captions a partir do SRT existente.
- Templates de estilo (CapCut-like): word-by-word, karaokê, popup.
- Editor visual de fonte, cor, stroke, animação.

### 4.4 Editor de thumbnail
- Canvas com layers (Konva/Fabric.js).
- Subject select + background remove via `rembg` local.
- Brush, máscaras, texto, ajustes de cor.
- LLM gera copy da thumbnail a partir do conteúdo do corte.

### 4.5 Render final
- Pipeline ffmpeg server-side compõe timeline + assets + legendas + thumbnail.
- Escreve em `01 Render final/` com naming padronizado.
- Export presets: Reels (9:16), Shorts (9:16), TikTok (9:16), YouTube Shorts, formato horizontal opcional.

## Detalhes técnicos chave

- **Comunicação UI ↔ Backend**: backend expõe CORS para `localhost:5173`. UI usa `fetch` + WebSocket nativos. Variável `VITE_BACKEND_URL` aponta para `http://localhost:8000`.
- **Upload "fake"**: o input `<input type="file">` lê o `File` no browser e envia via `POST multipart/form-data` para o backend, que salva em `~/Clipping4me/Cache/`. Do ponto de vista do usuário parece upload, mas tudo fica no Mac.
- **Modelos Ollama**: começar com `llama3.1:8b` (rápido), testar `qwen2.5:14b` ou `gemma2:27b` para qualidade. Whisper: `medium` é bom custo-benefício; `large-v3` se houver GPU/Metal.
- **Sem banco no MVP**: estado dos jobs em JSON no disco (`~/Clipping4me/Jobs/state.json`). SQLite entra na Fase 2 quando houver feedback.
- **Sem auth**: backend só aceita conexões de `127.0.0.1`. Nada exposto à internet.

## Ordem de execução sugerida

1. (Você) Instala dependências locais no Mac e cria repo do backend Python com endpoints stub.
2. (Lovable) Construímos a UI completa do MVP com mocks, conectada a `VITE_BACKEND_URL`.
3. (Você) Implementa cada etapa do pipeline backend, testando contra a UI real.
4. Itera nos prompts de LLM até a qualidade dos cortes te agradar (Fase 2).
5. Decide se quer começar Fase 3 (refino) ou pular para Fase 4 (editor) — Fase 4 é trabalho de meses.

## Riscos & decisões pendentes

- **Qualidade do LLM local** para selecionar cortes virais é o maior risco. Plano B: tornar o provider plugável (Ollama / OpenAI / Anthropic) para você comparar.
- **Fase 4 é um produto inteiro** (CapCut/Descript-like). Recomendo validar Fases 1–3 por pelo menos 1 mês antes de começar.
- **Repo do backend**: ele vive fora do Lovable. Posso te ajudar a esboçar o `main.py` inicial, mas a iteração contínua dele você faz no seu editor (Cursor/VS Code).

Se aprovar, ao entrar em build mode eu começo pela **Fase 1.1 — UI no Lovable** (telas de ingestão, lista de jobs com WebSocket, grid de cortes), já apontando para `VITE_BACKEND_URL` configurável.
