# UML — Sequência: Ciclo de Vida de Pedidos e Controle de Estoque

Detalha o controle transacional, bloqueio pessimista (`SELECT ... FOR UPDATE`), ordenação determinística anti-deadlock e idempotência de estoque.

## 1. Confirmação e Cancelamento de Pedido com Estoque

```mermaid
sequenceDiagram
  autonumber
  actor Operator as Atendente / Gerente
  participant Ctrl as OrdersController
  participant UC as TransitionOrderUseCase
  participant Repo as OrdersRepository
  participant DB as PostgreSQL

  Operator->>Ctrl: POST /api/v1/orders/:id/confirm
  Ctrl->>UC: execute(id, CONFIRMED, userId)
  UC->>Repo: transaction(work)
  activate Repo
  Repo->>DB: BEGIN
  Repo->>DB: SELECT id FROM "Order" WHERE id = :id FOR UPDATE
  DB-->>Repo: Sale (items + payments)

  alt Pedido inexistente
    UC-->>Operator: 404 NotFoundException
  else Status atual já é CONFIRMED
    UC-->>Operator: 201 Order (idempotente, sem novo débito)
  else Transição para CONFIRMED
    UC->>Repo: products(itemProductIds)
    alt Algum produto inativo/removido
      UC-->>Operator: 409 ConflictException
    else Todos produtos ativos
      Note over UC: Ordena itens por productId para evitar deadlock
      loop Para cada item ordenado
        UC->>Repo: debit(productId, quantity)
        alt Saldo insuficiente (count == 0)
          UC-->>Operator: 409 ConflictException (ROLLBACK)
        else Débito realizado
          UC->>Repo: movement({ type: EXIT, orderId, productId, quantity })
        end
      end
      UC->>Repo: update(id, { status: CONFIRMED })
      Repo->>DB: COMMIT
      UC-->>Operator: 201 Order CONFIRMED
    end
  end
  deactivate Repo
```

## 2. Movimentação Idempotente de Estoque

```mermaid
sequenceDiagram
  autonumber
  actor StockMgr as Estoquista / Gerente
  participant Ctrl as StockController
  participant UC as MoveStockUseCase
  participant Repo as StockRepository
  participant DB as PostgreSQL

  StockMgr->>Ctrl: POST /api/v1/stock/:productId/movements
  Ctrl->>UC: execute(productId, dto, userId)
  UC->>Repo: transaction(work)
  activate Repo
  Repo->>DB: BEGIN
  Repo->>DB: Verifica produto ativo (productId)
  Repo->>DB: Upsert Stock + SELECT ... FOR UPDATE (productId)
  Repo->>DB: Busca StockMovement por (productId, idempotencyKey)

  alt Chave idempotente encontrada com mesmos parâmetros
    UC-->>StockMgr: 201 StockMovement existente (replay)
  else Chave idempotente encontrada com parâmetros divergentes
    UC-->>StockMgr: 409 ConflictException
  else Novo movimento
    UC->>UC: Valida saldo >= 0 e limite de inteiro 32-bit
    UC->>Repo: update(productId, incrementos de saldo)
    UC->>Repo: movement({ productId, userId, type, quantity, idempotencyKey })
    Repo->>DB: COMMIT
    UC-->>StockMgr: 201 StockMovement criado
  end
  deactivate Repo
```
