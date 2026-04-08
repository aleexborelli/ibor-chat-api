# VisualChat QR - Base inicial

Base inicial do backend para atendimento WhatsApp espelhado com:

- Node.js
- Express
- Prisma
- PostgreSQL
- Socket.IO
- whatsapp-web.js

## Como usar

1. Copie `.env.example` para `.env`
2. Instale dependências:

```bash
npm install
```

3. Gere o Prisma Client:

```bash
npm run prisma:generate
```

4. Rode a migration inicial:

```bash
npm run prisma:migrate -- --name init
```

5. Execute o seed:

```bash
npm run db:seed
```

6. Suba o projeto:

```bash
npm run dev
```

## Endpoints iniciais

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/whatsapp/status`
- `GET /api/whatsapp/qr`
- `POST /api/whatsapp/disconnect`
- `GET /api/conversations?filter=all|mine|waiting`
- `GET /api/conversations/:id`
- `POST /api/conversations/:id/messages`
- `POST /api/conversations/:id/assume`
- `POST /api/conversations/:id/close`
- `POST /api/notes/:conversationId`

## Observações

- A persistência de sessão usa `LocalAuth`
- A pasta `.wwebjs_auth` deve ficar persistida na máquina/servidor
- A parte de transferência de conversa, mídia, áudio e frontend ainda será construída por cima desta base
