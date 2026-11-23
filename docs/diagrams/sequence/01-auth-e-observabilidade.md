# UML — Sequência: Pipeline HTTP, Autenticação JWT e Observabilidade

Detalha o ciclo completo de uma requisição HTTP passando por correlação, rate limit, autenticação/RBAC, logging estruturado e métricas.

## 1. Login e Emissão de Token JWT

```mermaid
sequenceDiagram
  autonumber
  actor Client as Cliente HTTP
  participant MW as CorrelationIdMiddleware
  participant Throttler as ThrottlerGuard
  participant JwtGuard as JwtAuthGuard
  participant Int as HttpLoggingInterceptor
  participant Ctrl as AuthController
  participant UC as LoginUseCase
  participant Repo as UsersRepository
  participant Metrics as MetricsService

  Client->>MW: POST /api/v1/auth/login (X-Request-Id?)
  activate MW
  MW->>MW: Preserva X-Request-Id ou gera UUID
  MW->>MW: Define header de resposta X-Request-Id
  MW->>Throttler: next()
  deactivate MW

  Throttler->>JwtGuard: canActivate() (dentro do limite 100 req/min)
  JwtGuard->>Int: canActivate() -> true (@Public)
  activate Int
  Int->>Ctrl: intercept() — inicia hrtime
  Ctrl->>UC: execute(loginDto)
  UC->>Repo: findByLoginOrEmail(dto.login)
  Repo-->>UC: User | null
  UC->>UC: bcrypt.compare(password, passwordHash)

  alt Usuário ausente, inativo, excluído ou senha inválida
    UC-->>Int: throw UnauthorizedException (401)
    Int->>Metrics: recordHttpRequest(POST, /api/v1/auth/login, 401, durationMs)
    Int->>Int: logger.error(JSON estruturado com requestId)
    Int-->>Client: 401 Unauthorized + X-Request-Id
  else Credenciais válidas
    UC->>UC: jwtService.signAsync({ sub, role })
    UC-->>Ctrl: { accessToken, user }
    Ctrl-->>Int: 201 Created
    Int->>Metrics: recordHttpRequest(POST, /api/v1/auth/login, 201, durationMs)
    Int->>Int: logger.log(JSON estruturado com requestId)
    Int-->>Client: 201 Created + X-Request-Id
  end
  deactivate Int
```

## 2. Validação de Rota Protegida (JWT + RBAC)

```mermaid
sequenceDiagram
  autonumber
  actor Client as Cliente HTTP
  participant JwtGuard as JwtAuthGuard
  participant Strategy as JwtStrategy
  participant ValidateUC as ValidateAccessTokenUseCase
  participant Repo as UsersRepository
  participant Roles as RolesGuard
  participant Ctrl as Controller Alvo

  Client->>JwtGuard: Requisição com Bearer Token
  JwtGuard->>Strategy: Valida assinatura e expiração JWT
  Strategy->>ValidateUC: execute(payload.sub)
  ValidateUC->>Repo: findActiveByIdWithCredentials(userId)
  Repo-->>ValidateUC: User | null

  alt Usuário inativo ou inexistente
    ValidateUC-->>Client: 401 UnauthorizedException
  else Usuário ativo
    ValidateUC-->>Strategy: AuthenticatedUser { id, login, role }
    Strategy-->>JwtGuard: request.user = AuthenticatedUser
    JwtGuard->>Roles: canActivate(context)
    alt Role não autorizada para a rota
      Roles-->>Client: 403 ForbiddenException
    else Role autorizada
      Roles->>Ctrl: Executa handler da rota
      Ctrl-->>Client: 200 / 201
    end
  end
```
