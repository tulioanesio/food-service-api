# Requisitos do Sistema de Gestao de Lanchonetes

## 1. Visao geral

O sistema tem como objetivo apoiar a operacao de uma lanchonete de medio porte, centralizando o cadastro de produtos, clientes e funcionarios, o registro de pedidos, os pagamentos, o controle de estoque e a consulta de indicadores operacionais.

O produto sera desenvolvido inicialmente como uma API web. A primeira versao deve priorizar o fluxo de venda no balcao, mas a organizacao dos requisitos permite evolucao posterior para retirada, delivery e multiplas unidades.

## 2. Problema atendido

A lanchonete precisa substituir controles manuais e informacoes dispersas por um sistema unico que reduza erros no registro de pedidos, facilite a identificacao de produtos disponiveis, mantenha o estoque atualizado e forneca informacoes confiaveis para a gestao.

## 3. Atores

| Ator            | Responsabilidades                                                 |
| --------------- | ----------------------------------------------------------------- |
| Administrador   | Gerenciar funcionarios, permissoes, produtos e configuracoes.     |
| Gerente         | Acompanhar operacao, estoque, vendas e relatorios.                |
| Atendente/Caixa | Cadastrar clientes, registrar pedidos e receber pagamentos.       |
| Estoquista      | Registrar entradas, perdas, ajustes e consultar estoque.          |
| Cozinha         | Consultar pedidos confirmados e atualizar o andamento do preparo. |
| Cliente         | Informar seus dados, realizar pedidos e receber o atendimento.    |
|                 |

## 4. Escopo da primeira versao

### Incluido

- Autenticacao e controle de acesso de funcionarios.
- Cadastro e consulta de clientes.
- Cadastro, consulta, atualizacao e desativacao de produtos.
- Registro e consulta de movimentacoes de estoque.
- Criacao de pedidos com varios produtos.
- Calculo e conferencia do total do pedido.
- Atualizacao do status do pedido.
- Registro de pagamentos.
- Consultas operacionais de vendas, pedidos e estoque.
- Documentacao da API e testes automatizados.

### Nao incluido inicialmente

- Integracao com iFood ou outros marketplaces.
- Emissao fiscal e integracao com SEFAZ.
- Integracao automatica com maquininhas de cartao.
- Programa de fidelidade.
- Delivery com rastreamento em tempo real.
- Gestao de compras e fornecedores.
- Multiplas filiais.
- Aplicativo mobile.

Esses itens podem ser adicionados em versoes futuras sem alterar o objetivo principal da primeira entrega.

## 5. Requisitos funcionais

### Autenticacao e funcionarios

**RF-01 - Autenticar funcionario**

O sistema deve permitir que um funcionario entre utilizando suas credenciais e deve rejeitar credenciais invalidas.

**RF-02 - Controlar permissoes**

O sistema deve controlar o acesso conforme o perfil do funcionario: administrador, gerente, caixa/atendente, estoquista ou cozinha.

**RF-03 - Gerenciar funcionarios**

O administrador deve poder cadastrar, consultar, atualizar e desativar funcionarios.

**RF-04 - Proteger credenciais**

O sistema nao deve armazenar senhas em texto puro e nao deve expo-las nas respostas da API.

### Clientes

**RF-05 - Cadastrar cliente**

O atendente deve poder cadastrar cliente com nome, CPF e telefone. O cadastro de cliente deve ser opcional para pedidos no balcao.

**RF-06 - Consultar clientes**

O sistema deve permitir consultar clientes por nome, CPF ou telefone.

**RF-07 - Atualizar cliente**

O atendente autorizado deve poder atualizar os dados de um cliente.

### Produtos

**RF-08 - Cadastrar produto**

O usuario autorizado deve poder cadastrar produto com nome, categoria, preco e situacao de disponibilidade.

**RF-09 - Consultar produtos**

O sistema deve listar produtos, permitir busca por nome ou categoria e informar se o produto esta disponivel.

**RF-10 - Atualizar produto**

O usuario autorizado deve poder atualizar dados e preco de um produto.

**RF-11 - Desativar produto**

O sistema deve permitir desativar um produto sem apagar seu historico de vendas.

### Estoque

**RF-12 - Consultar estoque**

O sistema deve informar a quantidade atual de cada produto e permitir identificar produtos abaixo do estoque minimo.

**RF-13 - Registrar entrada de estoque**

O estoquista deve poder registrar entrada de produtos informando quantidade e motivo.

**RF-14 - Registrar saida ou perda**

O estoquista deve poder registrar saida, perda ou ajuste de estoque informando quantidade e motivo.

**RF-15 - Consultar historico de estoque**

O sistema deve permitir consultar as movimentacoes de um produto por periodo, tipo e responsavel.

### Pedidos

**RF-16 - Criar pedido**

O atendente deve poder criar um pedido para um cliente cadastrado ou para um cliente nao identificado.

**RF-17 - Adicionar produtos ao pedido**

O pedido deve permitir adicionar um ou mais produtos, informando a quantidade de cada item.

**RF-18 - Calcular total do pedido**

O sistema deve calcular o total somando o preco vigente de cada produto multiplicado por sua quantidade.

**RF-19 - Preservar preco vendido**

O sistema deve preservar no pedido o preco aplicado no momento da venda, mesmo que o preco do produto seja alterado depois.

**RF-20 - Atualizar status do pedido**

O sistema deve permitir acompanhar o pedido pelos status: aberto, confirmado, em preparo, pronto, concluido ou cancelado.

**RF-21 - Cancelar pedido**

Usuario autorizado deve poder cancelar um pedido, informando o motivo e respeitando as regras de pagamento e estoque.

**RF-22 - Consultar pedidos**

O sistema deve permitir consultar pedidos por periodo, cliente, status e identificador.

### Pagamentos

**RF-23 - Registrar pagamento**

O caixa deve poder registrar pagamento em dinheiro, Pix, cartao de credito, cartao de debito ou vale-alimentacao.

**RF-24 - Permitir pagamento parcial ou dividido**

O sistema deve permitir mais de um registro de pagamento para o mesmo pedido quando necessario.

**RF-25 - Controlar situacao do pagamento**

O sistema deve registrar pagamento pendente, pago, estornado ou cancelado.

**RF-26 - Registrar troco**

Para pagamentos em dinheiro, o sistema deve registrar o valor recebido e o troco devolvido.

### Relatorios

**RF-27 - Consultar vendas**

O gerente deve poder consultar quantidade de pedidos, valor vendido e formas de pagamento por periodo.

**RF-28 - Consultar produtos vendidos**

O sistema deve informar os produtos mais vendidos em um periodo.

**RF-29 - Consultar situacao do estoque**

O gerente deve poder consultar estoque atual, entradas, saidas, perdas e produtos abaixo do minimo.

## 6. Requisitos nao funcionais

**RNF-01 - Usabilidade**

As operacoes principais devem ser simples, possuir mensagens de erro claras e utilizar nomes consistentes nas telas e na API.

**RNF-02 - Seguranca**

A API deve exigir autenticacao nas operacoes administrativas, aplicar permissoes por perfil, validar entradas e armazenar senhas com hash seguro.

**RNF-03 - Privacidade**

O sistema deve coletar somente dados necessarios, evitar exposicao de CPF e telefone em respostas desnecessarias e permitir controle de acesso aos dados de clientes.

**RNF-04 - Integridade**

A criacao do pedido, o registro do pagamento e a baixa de estoque devem impedir estados inconsistentes quando uma operacao falhar.

**RNF-05 - Desempenho**

Em ambiente local ou de homologacao, consultas comuns devem responder em ate dois segundos com uma carga de ate 100 usuarios simultaneos.

**RNF-06 - Disponibilidade**

A aplicacao deve iniciar de forma reproduzivel usando Docker e variaveis de ambiente documentadas.

**RNF-07 - Manutenibilidade**

O codigo deve seguir a organizacao do NestJS, possuir validacao de entrada, tipagem, documentacao da API e separacao entre controller, service e persistencia.

**RNF-08 - Testabilidade**

As regras principais devem possuir testes unitarios e as integracoes com banco devem possuir testes de integracao. A cobertura deve ser de pelo menos 75%.

**RNF-09 - Observabilidade**

Falhas inesperadas devem ser registradas com informacoes suficientes para diagnostico, sem registrar senhas ou dados sensiveis.

**RNF-10 - Controle de versao**

O projeto deve utilizar GitHub, branch `main`, commits atomicos e convencao de mensagens como Conventional Commits.

**RNF-11 - Integracao continua**

Cada push ou pull request deve executar instalacao, lint, validacao do Prisma, testes, cobertura e build.

## 7. Regras de negocio

- Um pedido deve possuir pelo menos um item.
- A quantidade de um item deve ser maior que zero.
- O preco de um produto deve ser maior que zero.
- Produtos desativados nao podem entrar em novos pedidos.
- O total do pedido deve ser igual a soma dos seus itens.
- Nao pode haver saida maior que a quantidade disponivel em estoque.
- O estoque deve ser atualizado somente quando o pedido for confirmado ou conforme a politica definida pela operacao.
- Um pedido cancelado nao pode voltar para preparo ou conclusao.
- Um pedido concluido nao pode ser alterado sem permissao de gerente.
- Um pagamento pago deve estar associado a um pedido existente.
- O valor total dos pagamentos confirmados nao deve ser menor que o total do pedido para concluir a venda.
- O cancelamento de um pedido pago deve registrar estorno ou justificativa.

## 8. Fluxo principal e criterios de aceitacao

### Fluxo: realizar venda no balcao

1. O funcionario autentica-se no sistema.
2. O funcionario localiza ou cadastra o cliente.
3. O funcionario cria um pedido.
4. O funcionario adiciona um ou mais produtos e suas quantidades.
5. O sistema valida disponibilidade e calcula o total.
6. O funcionario confirma o pedido.
7. O sistema registra a baixa do estoque.
8. O caixa registra o pagamento.
9. A cozinha atualiza o pedido para em preparo e depois pronto.
10. O atendente entrega o pedido e marca-o como concluido.

### Criterios de aceitacao

- Nao e possivel criar pedido sem itens.
- O total apresentado corresponde a soma dos itens.
- O sistema rejeita produto inativo ou sem estoque suficiente.
- O pagamento e associado ao pedido correto.
- O estoque e atualizado somente apos a confirmacao definida pela regra de negocio.
- O pedido percorre apenas transicoes de status validas.
- Uma falha durante a confirmacao nao deixa pedido e estoque em estados diferentes.
- O fluxo completo possui testes automatizados.

## 9. Fora de escopo para a primeira entrega

Nao sera necessario implementar, testar ou demonstrar nesta versao integracao fiscal, marketplace, delivery em tempo real, programa de fidelidade, compras com fornecedores, folha de pagamento, contabilidade ou aplicativo mobile.

## 10. Criterio de pronto do MVP

O MVP sera considerado pronto quando:

- O fluxo principal estiver funcionando de ponta a ponta.
- Os requisitos RF-05, RF-08, RF-12, RF-16, RF-18, RF-23 e RF-27 estiverem implementados.
- As regras de negocio principais possuirem testes.
- A cobertura de testes for igual ou superior a 75%.
- O lint, os testes e o build passarem no CI.
- A API estiver documentada.
- Os diagramas e o prototipo exigidos pela atividade estiverem entregues.
- O relatorio e a apresentacao estiverem revisados.
