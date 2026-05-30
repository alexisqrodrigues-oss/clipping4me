
# Plano: Mac como servidor público com login

Três blocos independentes. Faço o que depende de código (1 e 2), e te entrego um passo-a-passo pro que é do seu Mac (3).

---

## 1. Sistema de login no backend

**Tecnologia simples, sem dependências externas pesadas:**
- Usuários salvos em `users.json` dentro de `/Users/axis/Dev/clipping4me/Documents/`
- Senha com hash **bcrypt** (única dependência nova: `bcrypt`)
- Sessões com **token opaco** (random hex de 32 bytes), salvo em `sessions.json`
- Sem e-mail, sem recuperação de senha (admin reseta manualmente)
- Dois papéis: `admin` e `user`

**Novos endpoints no FastAPI:**

| Método | Rota | Quem pode | O que faz |
|---|---|---|---|
| `POST` | `/auth/login` | público | recebe `{username, password}` → devolve `{token, user}` |
| `POST` | `/auth/logout` | autenticado | invalida o token |
| `GET` | `/auth/me` | autenticado | dados do usuário atual |
| `GET` | `/admin/users` | admin | lista usuários |
| `POST` | `/admin/users` | admin | cria `{username, password, role}` |
| `PATCH` | `/admin/users/{id}` | admin | trocar senha ou role |
| `DELETE` | `/admin/users/{id}` | admin | remove (exceto a si mesmo) |

**Bootstrap:** na primeira execução o backend cria um admin `axis` com a senha definida em `ADMIN_BOOTSTRAP_PASSWORD` (env). Se a env não existir, gera uma random e imprime no log uma única vez.

**Proteção:** todas as rotas `/jobs*`, `/jobs/upload`, `/media/*` e `/admin/*` passam a exigir `Authorization: Bearer <token>`. `/health` continua público.

---

## 2. Login + admin no frontend

**Estrutura de rotas reorganizada:**
```
src/routes/
├── login.tsx                              ← público
├── _authenticated.tsx                     ← guard
├── _authenticated.index.tsx               ← /  (lista de jobs)
├── _authenticated.new.tsx                 ← /new
├── _authenticated.jobs.$jobId.tsx         ← /jobs/:id
└── _authenticated.admin.tsx               ← /admin (só admin)
```

Quem não estiver logado é mandado pra `/login`. Quem não for admin não vê `/admin`.

**Como o token vive:**
- Guardado em `localStorage` com chave `clipping4me:token`
- Enviado automaticamente em todo `fetch` pro backend (header `Authorization: Bearer …`)
- Se uma chamada volta `401`, faz logout e redireciona pra login

**Tela `/login`:** dois campos (usuário + senha), botão entrar. Sem cadastro público.

**Tela `/admin`:** tabela de usuários + form pra criar. Botões: trocar senha, mudar role, deletar.

**Header (todas as páginas):**
- Mostra `username (role)`
- Botão "Sair"
- Link "Admin" só se for admin
- Indicador `● online/offline` que já existe

---

## 3. Mac como servidor sempre ligado (instruções pra rodar no Mac)

### 3a. Configurar pra não dormir

Em **Ajustes do Sistema → Bateria/Energia → Opções**:
- ✅ "Impedir que o computador entre em repouso automaticamente quando a tela está desligada"
- ✅ "Iniciar automaticamente após queda de energia"
- ✅ "Acordar para acesso à rede"

Em **Ajustes do Sistema → Bloqueio de Tela**:
- "Desativar tela após" → 5 min (ok, mas computador NÃO dorme)

### 3b. Acesso público estável (Tailscale Funnel — mais simples, sem domínio próprio)

```bash
brew install --cask tailscale
open -a Tailscale          # faz login com Google/GitHub (free tier 100 devices)
sudo tailscale up
sudo tailscale serve --https=443 http://localhost:8000
sudo tailscale funnel --https=443 on
tailscale funnel status    # mostra a URL pública HTTPS, ex.: https://axis-mac.tail1234.ts.net
```

Essa URL é **fixa**, HTTPS, gratuita, e sobrevive a restart do Mac.

**Alternativa se você já tem um domínio:** Cloudflare Tunnel nomeado (URL tipo `clipping.seudominio.com`). Te passo o passo-a-passo se preferir essa rota.

### 3c. Auto-start (LaunchAgents)

Crio dois arquivos `.plist` (entrego prontos):
- `~/Library/LaunchAgents/me.clipping4.backend.plist` — sobe `bash run.sh` no boot
- O Tailscale já tem auto-start próprio (item "Launch at login" na bandeja)

Comandos pra ativar:
```bash
launchctl load -w ~/Library/LaunchAgents/me.clipping4.backend.plist
```

Logs ficam em `~/Library/Logs/clipping4me.log` e `clipping4me.err.log`.

### 3d. Apontar a UI pro novo endereço

Na UI (qualquer aparelho), clica no chip `● online` no header → cola a URL do Tailscale Funnel → salvar. Persiste no `localStorage` daquele navegador.

---

## Ordem de execução que eu sigo

1. Backend: `auth.py`, `requirements.txt` (+ bcrypt), proteção das rotas, endpoints de admin, bootstrap do admin inicial
2. Frontend: `auth.ts`, `/login`, restruturação pra `_authenticated/*`, `/admin`, header com username/logout, atualizar `backend.ts` pra mandar token e tratar 401
3. Entregar o `.plist` do LaunchAgent + comandos exatos do Tailscale, prontos pra colar

Ao final você terá:
- URL pública estável HTTPS do Mac
- Login obrigatório (admin `axis` com senha que você define)
- Painel admin pra criar mais usuários quando quiser
- Backend que sobe sozinho se o Mac reiniciar

Posso começar?
