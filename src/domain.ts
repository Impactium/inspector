import { Injectable, Logger, Module as NestModule } from "@nestjs/common";
import { Telegram } from "./telegram";
import { Storage } from "./storage";
import { Cron, CronExpression } from "@nestjs/schedule";

export namespace Domain {
  export const name = 'Domain';

  @Injectable()
  export class Service {
    private static readonly logger = new Logger(Domain.name);

    private static readonly ignore = new Set(['EAI_AGAIN']);

    private readonly alive = new Set<string>();

    constructor(
      private readonly telegramService: Telegram.Service
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async checkAll() {
      const domains = await Storage.get();

      Domain.Service.logger.log(`DOMAINS_LIST:${domains.size}`);

      for (const url of domains) {
        try {
          await fetch(url);

          if (!this.alive.has(url)) this.update(url, true);
        } catch (error) {
          const code = error.cause.code;

          if (Domain.Service.ignore.has(code)) {
            Domain.Service.logger.verbose(`DOMAIN_ERROR_IGNORED:${url}`);
            continue;
          }

          if (this.alive.has(url)) this.update(url, false, code);
        }
      }
    }

    update(url: string, alive: boolean, reason = '') {
      if (alive) {
        this.alive.add(url);
        this.telegramService.alive(url);
      } else {
        this.alive.delete(url);
        this.telegramService.dead(url, reason);
      }
    };
  }

  @NestModule({
    imports: [Telegram.Module],
    providers: [Domain.Service],
  })
  export class Module { }
}
