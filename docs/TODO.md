# TODO

## CI/CD

- [ ] Criar um projeto no SonarQube/SonarCloud para este repositorio.
- [ ] Cadastrar no GitHub Actions secret `SONAR_TOKEN` com permissao para analisar o projeto.
- [ ] Cadastrar no GitHub Actions variable `SONAR_ENABLED=true` para ativar a analise.
- [ ] Cadastrar no GitHub Actions variable `SONAR_HOST_URL` com a URL do SonarQube, por exemplo `https://sonarcloud.io`.
- [ ] Cadastrar no GitHub Actions variable `SONAR_PROJECT_KEY` com a chave exata do projeto no SonarQube.
- [ ] Se usar SonarCloud, cadastrar no GitHub Actions variable `SONAR_ORGANIZATION` com o identificador da organizacao.
- [ ] Criar no Render um Web Service usando este repositorio e o `Dockerfile` da raiz.
- [ ] Configurar o Web Service do Render para construir a partir deste repositorio e da branch `main`.
- [ ] Configurar no Render as variaveis `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` e `NODE_ENV`.
- [ ] Usar a `PORT` fornecida automaticamente pelo Render; nao fixar uma porta diferente no servico.
- [ ] Criar no Render um Deploy Hook para o Web Service.
- [ ] Cadastrar no GitHub Actions secret `RENDER_DEPLOY_HOOK_URL` com a URL do Deploy Hook.
- [ ] Cadastrar no GitHub Actions variable `RENDER_ENABLED=true` para ativar o deploy automatico.
- [ ] Confirmar que o branch de deploy do Render e `main`.

O publish usa o `GITHUB_TOKEN` automatico para enviar a imagem para o GHCR; nenhum secret adicional e necessario para essa etapa. O Deploy Hook aciona o Web Service configurado no Render.

O workflow nao usa o token do Render diretamente: ele chama o Deploy Hook, que e especifico do servico. Nao coloque tokens ou URLs privadas neste arquivo.

## Projeto

- [ ] Pegar algum lugar de lanchonete como base e fazer a analise (obrigatorio).
