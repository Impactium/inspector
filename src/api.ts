import { MiddlewareConsumer, Module as AppModule, NestModule, RequestMethod } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RequestMiddleware } from './middlewares/request.middleware';
import { ResponseMiddleware } from './middlewares/response.middleware';
import { Deployment } from './deployment';
import { Registration } from './registration';
import { Telegram } from './telegram';
import { Domain } from './domain';

export namespace Api {
  @AppModule({
    imports: [
      ScheduleModule.forRoot(),
      Telegram.Module,
      Deployment.Module,
      Registration.Module,
      Domain.Module
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
