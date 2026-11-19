# Food Service API

API REST desenvolvida em **NestJS**, **TypeScript**, **Prisma ORM** e **PostgreSQL** para gestão de operações de food service (usuários, autenticação JWT/RBAC, clientes, produtos, controle de estoque, pedidos, pagamentos com integração Stripe em modo de teste e relatórios gerenciais).

---

## Tecnologias Principais

- **Runtime:** Node.js 22
- **Gerenciador de Pacotes:** pnpm 10
- **Framework:** NestJS 11
- **Banco de Dados & ORM:** PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`)
- **Autenticação & Segurança:** Passport JWT, bcrypt, Helmet, Throttler
- **Pagamentos:** Stripe SDK (test mode)
- **Documentação:** OpenAPI / Swagger + Scalar
- **Testes:** Jest + Supertest

---

## Pré-requisitos

- **Node.js** `>= 22`
- **pnpm** `10.x` (ou via `corepack enable`)
- **Docker** e **Docker Compose** (para subir o banco de dados local e executar os testes E2E isolados)

---

## Instalação e Configuração

1. **Instale as dependências:**

   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Configure as variáveis de ambiente:**

   Copie o arquivo de exemplo e ajuste os valores conforme o seu ambiente:

   ```bash
   cp .env.example .env
   ```

   Principais variáveis em `.env`:

   | Variável                | Descrição                                                  |
   | ----------------------- | ---------------------------------------------------------- |
   | `NODE_ENV`              | Ambiente de execução (`development`, `production`, `test`) |
   | `DATABASE_URL`          | String de conexão do PostgreSQL da aplicação               |
   | `ALLOWED_ORIGINS`       | Origens permitidas no CORS (separadas por vírgula)         |
   | `JWT_SECRET`            | Chave secreta para assinatura JWT (mínimo 32 caracteres)   |
   | `PORT`                  | Porta HTTP da aplicação (padrão: `3000`)                   |
   | `STRIPE_SECRET_KEY`     | Opcional — chave de teste do Stripe (`sk_test_...`)        |
   | `STRIPE_WEBHOOK_SECRET` | Opcional — segredo de webhook do Stripe (`whsec_...`)      |

3. **Gere o cliente Prisma e aplique as migrations:**

   ```bash
   pnpm exec prisma generate
   pnpm exec prisma migrate deploy
   ```

---

## Executando a Aplicação

### Modo Local (Desenvolvimento)

Com o PostgreSQL ativo e configurado em `DATABASE_URL`:

```bash
# Subir apenas o banco principal via Docker (opcional)
docker compose up -d db

# Aplicar migrations
pnpm exec prisma migrate deploy

# Iniciar em modo watch
pnpm run start:dev
```

### Modo Produção (Build local)

```bash
pnpm build
pnpm run start:prod
```

### Via Docker Compose (API + PostgreSQL)

Sobe o banco de dados principal (`db` na porta `5432`) e a API containerizada:

```bash
docker compose up --build
```

> **Observação:** o serviço de banco de testes (`db_test`) utiliza `profiles: ['test']` e não é iniciado durante a execução normal da aplicação.

---

## Executando os Testes

### Testes Unitários

Não dependem de banco de dados nem de Docker:

```bash
# Executar todos os testes unitários
pnpm test

# Executar em modo watch
pnpm run test:watch

# Executar com relatório de cobertura
pnpm run test:cov
```

### Testes E2E (Integração HTTP + PostgreSQL)

Os testes E2E rodam em série (`--runInBand`) através do script `scripts/test-e2e.sh`:

```bash
pnpm run test:e2e
```

- **Execução local (sem `TEST_DATABASE_URL` definida):** o script sobe automaticamente o container efêmero `db_test` (`postgres:16-alpine` em memória via `tmpfs`, porta `5433`), aplica as migrations com `prisma migrate deploy`, executa todas as suítes E2E e remove o container ao finalizar — sem interferir no banco oficial da aplicação.
- **Execução em CI/CD (com `TEST_DATABASE_URL` definida):** o script utiliza diretamente o banco provisionado pela esteira, sem subir containers Docker adicionais.

---

## Qualidade de Código e Build

```bash
# Verificar formatação (Prettier)
pnpm run format:check

# Corrigir formatação
pnpm run format

# Verificar lint (ESLint)
pnpm run lint:check

# Corrigir lint automaticamente
pnpm run lint

# Gerar build de produção
pnpm build
```
