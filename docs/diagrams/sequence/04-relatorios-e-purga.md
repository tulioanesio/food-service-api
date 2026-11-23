# UML — Sequência: Relatórios Consistentes e Rotina de Purga

Detalha o isolamento transacional dos relatórios gerenciais e a rotina agendada de limpeza de usuários desativados.

## 1. Geração de Relatórios (`RepeatableRead`)

```mermaid
sequenceDiagram
  autonumber
  actor Manager as Gerente / Admin
  participant Ctrl as ReportsController
  participant UC as ReportsUseCases
  participant Repo as ReportsRepository
  participant DB as PostgreSQL

  Manager->>Ctrl: GET /api/v1/reports/{sales|products|stock}?from=...&to=...
  Ctrl->>UC: execute(dto)
  UC->>UC: Valida intervalo [from, to) (from < to)
  UC->>Repo: sales(...) / products(...) / stock(...)
  activate Repo
  Repo->>DB: BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ
  alt Relatório de Vendas
    Repo->>DB: order.aggregate (COMPLETED) + $queryRaw Payment (PAID por método)
  else Relatório de Produtos
    Repo->>DB: $queryRaw SUM(OrderItem) paginado + COUNT(DISTINCT productId)
  else Relatório de Estoque
    Repo->>DB: SELECT transaction_timestamp() AS asOf
    Repo->>DB: COUNT(*) + CTE WITH selected LEFT JOIN LATERAL StockMovement
  end
  DB-->>Repo: Snapshot consistente dos dados
  Repo->>DB: COMMIT
  deactivate Repo
  UC->>UC: Formata valores decimais (ROUND_HALF_UP), netMovement e paginação
  UC-->>Manager: 200 OK
```

## 2. Rotina Agendada de Purga de Usuários

```mermaid
sequenceDiagram
  autonumber
  participant Cron as @nestjs/schedule (Meia-noite)
  participant Sched as UserPurgeScheduler
  participant UC as PurgeDeletedUsersUseCase
  participant Repo as UsersRepository
  participant DB as PostgreSQL

  Cron->>Sched: purgeDeletedUsers()
  Sched->>UC: execute()
  UC->>UC: Calcula cutoff = now - 30 dias
  UC->>Repo: purgeDeletedBefore(cutoff)
  Repo->>DB: DELETE FROM "User" WHERE "deletedAt" <= cutoff
  DB-->>Repo: { count }
  Repo-->>Sched: { count }
```
