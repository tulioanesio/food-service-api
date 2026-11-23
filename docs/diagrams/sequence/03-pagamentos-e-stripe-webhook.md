# UML — Sequência: Pagamentos, Estornos e Reconciliação Stripe

Detalha o fluxo síncrono de criação/estorno de pagamentos e o processamento assíncrono de webhooks assinados pelo Stripe.

## 1. Registro de Pagamento (Manual vs Cartão Stripe)

```mermaid
sequenceDiagram
  autonumber
  actor Cashier as Caixa
  participant Ctrl as PaymentsController
  participant UC as CreatePaymentUseCase
  participant Repo as OrdersRepository
  participant StripeGW as StripeGateway
  participant StripeAPI as API Stripe

  Cashier->>Ctrl: POST /api/v1/orders/:id/payments
  Ctrl->>UC: execute(orderId, dto, userId)

  opt Método CREDIT_CARD ou DEBIT_CARD
    UC->>StripeGW: assertConfigured()
  end

  UC->>Repo: transaction — lock(orderId) + valida idempotencyKey e saldo restante
  alt Método manual (CASH / PIX / MEAL_VOUCHER)
    Repo-->>UC: Payment (status=PAID, provider=MANUAL)
    UC-->>Cashier: 201 { payment }
  else Método cartão (Stripe)
    Repo-->>UC: Payment (status=PENDING, provider=STRIPE)
    alt Payment já possui transactionId
      UC->>StripeGW: retrieve(transactionId)
    else Primeira tentativa
      UC->>StripeGW: create(payment) [idempotencyKey: payment:<id>]
    end
    StripeGW->>StripeAPI: PaymentIntents API
    alt Rejeição definitiva (400 StripeInvalidRequestError)
      StripeAPI-->>UC: 400
      UC->>Repo: Atualiza Payment.status = CANCELLED
      UC-->>Cashier: 400 BadRequestException
    else Falha transitória / rede
      StripeAPI-->>UC: Timeout / 5xx
      UC-->>Cashier: 503 ServiceUnavailableException (mantém reserva)
    else PaymentIntent válido
      StripeAPI-->>StripeGW: PaymentIntent (id, client_secret)
      UC->>UC: checkIntent(payment, intent)
      UC->>Repo: Atualiza Payment.transactionId = intent.id
      UC-->>Cashier: 201 { payment, clientSecret }
    end
  end
```

## 2. Reconciliação Assíncrona via Stripe Webhook

```mermaid
sequenceDiagram
  autonumber
  participant Stripe as Stripe Webhook
  participant Ctrl as PaymentsController
  participant UC as StripeWebhookUseCase
  participant GW as StripeGateway
  participant Repo as OrdersRepository

  Stripe->>Ctrl: POST /api/v1/payments/stripe/webhook (rawBody, stripe-signature)
  Ctrl->>UC: execute(rawBody, signature)
  UC->>GW: verify(rawBody, signature)

  alt Assinatura inválida ou evento livemode
    UC-->>Stripe: 400 BadRequestException
  else Evento válido (test mode)
    alt event.type == charge.refunded
      UC->>Repo: Busca Payment por transactionId ou metadata.paymentId
      UC->>Repo: transaction — lock(orderId) + atualiza para REFUNDED / REFUND_PENDING
      UC-->>Stripe: 200 { received: true }
    else event.type in [payment_intent.succeeded, canceled, payment_failed]
      UC->>Repo: Busca Payment por metadata.paymentId
      UC->>UC: checkIntent(payment, intent)
      UC->>Repo: transaction — lock(orderId) + atualiza PENDING -> PAID / CANCELLED / PENDING
      UC-->>Stripe: 200 { received: true }
    else Outro tipo de evento
      UC-->>Stripe: 200 { received: true }
    end
  end
```
