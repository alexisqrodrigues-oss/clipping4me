# Deploy: Mac sempre ligado, acessível de qualquer lugar

Roteiro completo. Faça **uma vez** e está pronto.

---

## 1. Configurar o Mac pra não dormir

**Ajustes do Sistema → Bateria (ou Energia) → Opções:**
- ✅ "Impedir que o computador entre em repouso automaticamente quando a tela está desligada"
- ✅ "Iniciar automaticamente após queda de energia"
- ✅ "Acordar para acesso à rede"

**Ajustes do Sistema → Bloqueio de Tela:**
- "Desativar tela após" → 5 min (ok, a tela apaga mas o Mac não dorme)
- "Exigir senha após desativar tela ou início do protetor de tela" → imediatamente

**Opcional (recomendado):**
- Ajustes → Compartilhamento → ativar **Login Remoto (SSH)** caso queira administrar sem monitor.

---

## 2. Subir o backend uma primeira vez (manualmente)

Pra criar o admin inicial.

```bash
cd /CAMINHO/DO/SEU/clone/clipping4me/backend
ADMIN_BOOTSTRAP_PASSWORD='SuaSenhaForte123' bash run.sh
```

O `run.sh` já tenta usar Python 3.11 automaticamente e aplica o workaround do Whisper no macOS.

Espere ver `Uvicorn running on http://0.0.0.0:8000`. Em outro terminal:

```bash
curl http://localhost:8000/health
# {"ok": true}

curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SuaSenhaForte123"}'
# {"token": "...", "user": {...}}
```

Funcionou? **Ctrl+C** pra parar e siga pro passo 3 (auto-start).

> Se não passou `ADMIN_BOOTSTRAP_PASSWORD`, o backend gera uma senha
> aleatória e imprime UMA vez no terminal — anote.

---

## 3. Acesso público com URL HTTPS estável (Tailscale Funnel)

Mais simples que ter domínio, gratuito (free tier: até 3 nós Funnel).

```bash
brew install --cask tailscale
open -a Tailscale
# Faça login com Google/GitHub na bandeja superior

sudo tailscale up

# Expõe localhost:8000 via HTTPS
sudo tailscale serve --bg --https=443 http://localhost:8000
sudo tailscale funnel --bg 443

# Veja sua URL pública
tailscale funnel status
# https://<seu-mac>.tail<xxxxx>.ts.net  ← copie essa URL
```

Essa URL:
- É **HTTPS** (browsers modernos exigem isso)
- É **fixa** (mesma URL pra sempre)
- **Sobrevive a restart** (Tailscale tem auto-start automático)
- **Não exige abrir portas** no roteador

Na UI (no celular, laptop, qualquer lugar): clica no chip `● online` no header → cola essa URL → salvar.

---

## 4. Auto-start do backend (LaunchAgent)

Use o instalador do repo para gerar o `plist` com o caminho real do seu clone:

```bash
bash backend/install-launchagent.sh
```

Verifica:
```bash
launchctl list | grep clipping4
# PID-ou-vazio  0  me.clipping4.backend

tail -f ~/Library/Logs/clipping4me.log
```

Pra parar / desativar:
```bash
launchctl unload ~/Library/LaunchAgents/me.clipping4.backend.plist
```

Pra recarregar (depois de editar o .plist):
```bash
launchctl unload ~/Library/LaunchAgents/me.clipping4.backend.plist
launchctl load -w ~/Library/LaunchAgents/me.clipping4.backend.plist
```

> Se você mover a pasta do projeto depois, rode `bash backend/install-launchagent.sh` de novo.

---

## 5. Daqui pra frente

- Reiniciou o Mac? Backend sobe sozinho via LaunchAgent. Tailscale sobe sozinho. Tudo só funciona.
- Esqueceu a senha do admin? Pare o backend (`launchctl unload …`), delete `~/Clipping4me/users.json`, suba de novo com `ADMIN_BOOTSTRAP_PASSWORD=…`. Vai recriar o admin.
- Quer dar acesso pra alguém? Login como admin → `/admin` → cria usuário com role `user`.
- Quer revogar acesso? `/admin` → deletar usuário (mata também todas as sessões dele).

---

## Alternativa: Cloudflare Tunnel (se você tem um domínio)

Se você já tem um domínio (próprio ou comprado no Cloudflare):

```bash
brew install cloudflared
cloudflared tunnel login              # autoriza no Cloudflare
cloudflared tunnel create clipping4me
cloudflared tunnel route dns clipping4me clipping.seudominio.com

# config em ~/.cloudflared/config.yml:
# tunnel: clipping4me
# credentials-file: /Users/SEU_USUARIO/.cloudflared/<UUID>.json
# ingress:
#   - hostname: clipping.seudominio.com
#     service: http://localhost:8000
#   - service: http_status:404

sudo cloudflared service install      # auto-start no boot
```

URL final: `https://clipping.seudominio.com` — fixa e bonita.