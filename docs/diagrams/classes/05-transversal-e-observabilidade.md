# UML — Diagrama de Classes: Infraestrutura Transversal e Observabilidade

Componentes globais de persistência, saúde da aplicação, tratamento de exceções e observabilidade (correlação, logging estruturado e métricas Prometheus).

```mermaid
classDiagram
  direction TB

  namespace ObservabilityModule {
    class CorrelationIdMiddleware {
      <<middleware>>
      +use(req: RequestWithId, res: Response, next: NextFunction) void
    }

    class HttpLoggingInterceptor {
      <<interceptor>>
      -Logger logger
      -MetricsService metricsService
      +intercept(context: ExecutionContext, next: CallHandler) Observable
    }

    class MetricsController {
      <<controller>>
      -MetricsService metricsService
      +getMetrics(res: Response) Promise~string~
    }

    class MetricsService {
      <<service>>
      -Registry registry
      -Counter httpRequestsTotal
      -Histogram httpRequestDurationSeconds
      +recordHttpRequest(method, route, statusCode, durationMs) void
      +getMetrics() Promise~string~
      +getContentType() string
    }
  }

  namespace CommonFilters {
    class AllExceptionsFilter {
      <<filter>>
      -Logger logger
      +catch(exception: unknown, host: ArgumentsHost) void
    }

    class PrismaClientExceptionFilter {
      <<filter>>
      -Logger logger
      +catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) void
    }
  }

  namespace CoreInfrastructure {
    class PrismaService {
      <<service>>
      -ConfigService configService
      +onModuleInit() Promise~void~
      +onModuleDestroy() Promise~void~
    }

    class HealthController {
      <<controller>>
      -HealthCheckService health
      -PrismaHealthIndicator db
      -PrismaService prismaService
      +check() Promise~HealthCheckResult~
    }
  }

  HttpLoggingInterceptor --> MetricsService : registra
  MetricsController --> MetricsService : expõe
  HealthController --> PrismaService : pingCheck
```
