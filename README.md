# Clipping4Me

Fluxo local para clonar o repositório, dar um clique e subir frontend + backend local com Ollama no Mac.

## O que já ficou organizado neste repo

- `run.sh` na raiz para ser o bootstrap principal
- `Clipping4Me.command` para duplo clique no Finder
- `backend/run.sh` só cuida do backend Python
- `backend/install-launchagent.sh` gera o LaunchAgent com o caminho real do clone
- frontend aceita `?backend=` automaticamente, então o launcher já abre a UI apontando pro backend certo
- backend sem caminhos fixos de usuário/máquina

## Estrutura correta

```text
clipping4me/
├── run.sh
├── Clipping4Me.command
├── backend/
│   ├── run.sh
│   ├── install-launchagent.sh
│   ├── README.md
│   └── app/
└── src/
```

## Depois de clonar no Mac

### 1. Instale as dependências de sistema

```bash
brew install python@3.11 ffmpeg yt-dlp ollama
brew install --cask tailscale
```

### 2. Faça login no Tailscale e deixe o Ollama disponível

```bash
open -a Tailscale
tailscale login
```

Se preferir, o `run.sh` já tenta subir o Ollama sozinho.

### 3. Inicie com um clique

- Finder: duplo clique em `Clipping4Me.command`
- ou Terminal:

```bash
bash run.sh
```

Na primeira vez, se quiser definir a senha do admin:

```bash
ADMIN_BOOTSTRAP_PASSWORD='SuaSenhaForte' bash run.sh
```

## O que precisa estar ativo no Mac

- **Ollama** rodando
- **modelo do Ollama** baixado (`qwen2.5-coder:7b` por padrão)
- **backend Python** na porta `8000`
- **Tailscale conectado** se você quiser acesso HTTPS público fora do Mac

O launcher já sobe o que conseguir automaticamente e abre a UI com a URL correta do backend.

## Auto-start após reiniciar o Mac

Para deixar o backend subindo sozinho:

```bash
bash backend/install-launchagent.sh
```

O script gera o `plist` com o caminho real do clone, sem caminho hardcoded.