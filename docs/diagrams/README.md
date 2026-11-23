# Documentação UML — Food Service API

Esta pasta reúne os diagramas UML da **Food Service API**, organizados por **tipo de diagrama**, **camada arquitetural** e **módulo de domínio**.

## Estrutura

### 1. Diagramas de Casos de Uso (`use-cases/`)

Modelam a fronteira do sistema, os atores (perfis RBAC e integrações externas) e os relacionamentos de inclusão (`<<include>>`) e extensão (`<<extend>>`):

- [01 — Acesso e Cadastros (Auth, Users, Customers)](./use-cases/01-acesso-e-cadastros.md)
- [02 — Operações, Relatórios e Observabilidade (Products, Stock, Orders, Payments, Reports, Observability)](./use-cases/02-operacoes-e-relatorios.md)

### 2. Diagramas de Classes (`classes/`)

Modelam a estrutura estática com estereótipos (`<<entity>>`, `<<enumeration>>`, `<<controller>>`, `<<useCase>>`, `<<repository>>`, `<<gateway>>`, `<<guard>>`, `<<interceptor>>`, `<<filter>>`), visibilidade (`+` público, `-` privado) e cardinalidades:

- [01 — Domínio: Entidades e Enumerações](./classes/01-dominio-entidades.md)
- [02 — Módulos de Acesso: Auth, Users e Customers](./classes/02-auth-e-usuarios.md)
- [03 — Módulos de Catálogo e Estoque: Products e Stock](./classes/03-catalogo-e-estoque.md)
- [04 — Módulos Transacionais e Analíticos: Orders, Payments e Reports](./classes/04-pedidos-pagamentos-e-relatorios.md)
- [05 — Infraestrutura Transversal e Observabilidade](./classes/05-transversal-e-observabilidade.md)

### 3. Diagramas de Sequência (`sequence/`)

Modelam as interações temporais, blocos condicionais (`alt`/`opt`), iterações (`loop`), ativação de objetos e controle transacional (`FOR UPDATE`, `RepeatableRead`, idempotência):

- [01 — Pipeline HTTP, Autenticação JWT e Observabilidade](./sequence/01-auth-e-observabilidade.md)
- [02 — Ciclo de Vida de Pedidos e Controle Concorrente de Estoque](./sequence/02-pedidos-e-estoque.md)
- [03 — Pagamentos, Estornos e Reconciliação via Stripe Webhook](./sequence/03-pagamentos-e-stripe-webhook.md)
- [04 — Relatórios Consistentes e Limpeza Agendada de Usuários](./sequence/04-relatorios-e-limpeza-usuarios.md)
