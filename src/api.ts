import { MiddlewareConsumer, Module as AppModule, NestModule, RequestMethod } from '@nestjs/common';
import { RequestMiddleware } from './middlewares/request.middleware';
import { ResponseMiddleware } from './middlewares/response.middleware';
import { Deployment } from './deployment';
import { Registration } from './registration';

export namespace Api {
  @AppModule({
    imports: [
      Deployment.Module,
      Registration.Module
    ]
  })
  export class Module implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      consumer
        .apply(RequestMiddleware, ResponseMiddleware)
        .forRoutes({ path: '*path', method: RequestMethod.ALL });
    }
  }
}
