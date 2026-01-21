import { Injectable, Logger, Module as NestModule, OnModuleInit } from "@nestjs/common";
import { Telegram } from "./telegram";
import { Storage } from "./storage";

export namespace Domain {
  export const name = 'Domain';

  @Injectable()
  export class Service implements OnModuleInit {
    private readonly logger = new Logger(Domain.name);

    constructor(
      private readonly telegramService: Telegram.Service
    ) { }

    onModuleInit = () => this.all();

    async all() {
      const domains = await Storage.get();
      for (const url of domains) {
        this.check(url);
      }

      setTimeout(this.all, 1000 * 60 * 5);
    }

    check = (url: string) => fetch(url).catch(error => this.telegramService.fall(url, error.cause.code));
  }

  @NestModule({
    imports: [Telegram.Module],
    providers: [Domain.Service],
  })
  export class Module { }
}
