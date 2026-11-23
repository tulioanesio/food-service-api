# Diagramas UML — Sequência

Principais fluxos de execução da **Food Service API**.

## 1. Autenticação JWT e Observabilidade HTTP

```mermaid
sequenceDiagram
  autonumber
  actor Client as Cliente HTTP
  participant MW as CorrelationIdMiddleware
  participant Guard as JwtAuthGuard / RolesGuard
  participant Ctrl as AuthController
  participant UC as LoginUseCase
  participant Repo as UsersRepository
  participant Log as HttpLoggingInterceptor / MetricsService

  Client->>MW: POST /api/v1/auth/login (X-Request-Id?)
  MW->>MW: Gera/preserva requestId e define header X-Request-Id
  MW->>Guard: Encaminha requisição (@Public)
  Guard->>Log: Entra no interceptor (inicia hrtime)
  Log->>Ctrl: Executa rota
  Ctrl->>UC: execute(loginDto)
  UC->>Repo: findByLoginOrEmail(dto.login)
  Repo-->>UC: User | null
  UC->>UC: bcrypt.compare(password, passwordHash)
  alt Credenciais inválidas ou usuário inativo
    UC-->>Client: 401 UnauthorizedException
    Log->>Log: Registra métrica e log JSON (level=error)
  else Credenciais válidas
    UC->>UC: jwtService.signAsync({ sub, role })
    UC-->>Ctrl: { accessToken, user }
    Ctrl-->>Log: Resposta 201
    Log->>Log: Registra métrica e log JSON (level=info)
    Log-->>Client: 201 Created + X-Request-Id
  end
```

## 2. Criação, Confirmação e Pagamento com Stripe Webhook

```mermaid
sequenceDiagram
  autonumber
  actor Cashier as Caixa / Atendente
  participant OrderCtrl as OrdersController
  participant OrderUC as TransitionOrderUseCase
  participant PayCtrl as PaymentsController
  participant PayUC as CreatePaymentUseCase
  participant StripeGW as StripeGateway
  participant WebhookUC as StripeWebhookUseCase
  participant DB as PostgreSQL (Prisma)

  Cashier->>OrderCtrl: POST /api/v1/orders/:id/confirm
  OrderCtrl->>OrderUC: execute(id, CONFIRMED, userId)
  OrderUC->>DB: Transação + SELECT ... FOR UPDATE (Order)
  OrderUC->>DB: Debita Stock e cria StockMovement (EXIT)
  OrderUC->>DB: Atualiza Order.status = CONFIRMED
  OrderUC-->>Cashier: 201 Order CONFIRMED

  Cashier->>PayCtrl: POST /api/v1/orders/:id/payments (CREDIT_CARD)
  PayCtrl->>PayUC: execute(orderId, dto, userId)
  PayUC->>DB: Transação + cria Payment (PENDING, provider=STRIPE)
  PayUC->>StripeGW: create(payment) / retrieve(transactionId)
  StripeGW-->>PayUC: PaymentIntent (id, client_secret)
  PayUC->>DB: Atualiza Payment.transactionId
  PayUC-->>Cashier: 201 { payment, clientSecret }

  Note over StripeGW,WebhookUC: Confirmação assíncrona via Stripe
  StripeGW->>PayCtrl: POST /api/v1/payments/stripe/webhook (stripe-signature)
  PayCtrl->>WebhookUC: execute(rawBody, signature)
  WebhookUC->>StripeGW: verify(rawBody, signature)
  WebhookUC->>DB: Transação + lock Order + atualiza Payment (PAID, paidAt)
  WebhookUC-->>StripeGW: 200 { received: true }
```

## 3. Movimentação Idempotente de Estoque

```mermaid
sequenceDiagram
  autonumber
  actor StockMgr as Estoquista / Gerente
  participant Ctrl as StockController
  participant UC as MoveStockUseCase
  participant Repo as StockRepository / StockStore
  participant DB as PostgreSQL (Prisma)

  StockMgr->>Ctrl: POST /api/v1/stock/:productId/movements
  Ctrl->>UC: execute(productId, dto, userId)
  UC->>Repo: transaction(work)
  Repo->>DB: Verifica Product ativo e lock Stock (FOR UPDATE)
  Repo->>DB: Consulta StockMovement por (productId, idempotencyKey)
  alt Chave já utilizada com mesmos parâmetros
    UC-->>StockMgr: 201 Movimento anterior (replay idempotente)
  else Chave reutilizada com parâmetros diferentes
    UC-->>StockMgr: 409 ConflictException
  else Novo movimento válido
    UC->>DB: Atualiza Stock (totalQuantity, input/outputQuantity)
    UC->>DB: Cria StockMovement
    UC-->>StockMgr: 201 StockMovement
  end
```
