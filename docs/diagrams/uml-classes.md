# Diagrama UML — Classes de Domínio

Modelo de classes derivado diretamente de [schema.prisma](file:///home/pedronieto/projects/faculdade/food-service-api/prisma/schema.prisma).

```mermaid
classDiagram
  class UserRole {
    <<enumeration>>
    ADMIN
    MANAGER
    CASHIER
    ATTENDANT
    STOCK_MANAGER
    KITCHEN
  }

  class StockMovementType {
    <<enumeration>>
    ENTRY
    EXIT
    LOSS
    ADJUSTMENT
  }

  class OrderStatus {
    <<enumeration>>
    OPEN
    CONFIRMED
    PREPARING
    READY
    COMPLETED
    CANCELLED
  }

  class PaymentMethod {
    <<enumeration>>
    CASH
    PIX
    CREDIT_CARD
    DEBIT_CARD
    MEAL_VOUCHER
  }

  class PaymentStatus {
    <<enumeration>>
    REFUND_PENDING
    PENDING
    PAID
    REFUNDED
    CANCELLED
  }

  class User {
    +String id
    +String name
    +String login
    +String? email
    +String passwordHash
    +UserRole role
    +Boolean isActive
    +DateTime createdAt
    +DateTime updatedAt
    +DateTime? deletedAt
  }

  class Customer {
    +String id
    +String name
    +String? cpf
    +String? phone
    +DateTime createdAt
  }

  class Product {
    +String id
    +String name
    +String category
    +Decimal price
    +Boolean isActive
    +DateTime createdAt
    +DateTime updatedAt
    +DateTime? deletedAt
  }

  class Stock {
    +String id
    +String productId
    +Int totalQuantity
    +Int minimumQuantity
    +Int inputQuantity
    +Int outputQuantity
    +DateTime updatedAt
  }

  class StockMovement {
    +String id
    +String productId
    +String? idempotencyKey
    +String? orderId
    +String? userId
    +StockMovementType type
    +Int quantity
    +String? reason
    +DateTime createdAt
  }

  class Order {
    +String id
    +String? customerId
    +String? cancellationReason
    +Decimal total
    +OrderStatus status
    +DateTime createdAt
    +DateTime updatedAt
  }

  class OrderItem {
    +String id
    +String orderId
    +String productId
    +Int quantity
    +Decimal unitPrice
    +Decimal totalPrice
  }

  class Payment {
    +String id
    +String orderId
    +String? receivedById
    +PaymentMethod method
    +PaymentStatus status
    +Decimal amount
    +String? transactionId
    +String? idempotencyKey
    +String provider
    +Decimal? receivedAmount
    +Decimal? change
    +String? refundId
    +String? reversalReason
    +DateTime? paidAt
    +DateTime createdAt
  }

  User "1" --> "0..*" StockMovement : realiza
  User "1" --> "0..*" Payment : recebe
  Customer "0..1" --> "0..*" Order : realiza
  Product "1" --> "0..1" Stock : possui
  Product "1" --> "0..*" StockMovement : registra
  Product "1" --> "0..*" OrderItem : compõe
  Order "1" *-- "1..*" OrderItem : contém
  Order "1" --> "0..*" Payment : possui
  Order "0..1" --> "0..*" StockMovement : origina
```
