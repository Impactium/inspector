import { Injectable, Logger, Module as NestModule, OnModuleInit } from "@nestjs/common";
import { Telegram } from "./telegram";
import { Storage } from "./storage";

export namespace Domain {
  export const name = 'Domain';

  @Injectable()
  export class Service implements OnModuleInit {
    private readonly logger = new Logger(Domain.name);

    private readonly alive = new Set<string>();

    constructor(
      private readonly telegramService: Telegram.Service
    ) { }

    onModuleInit = () => this.all();

    async all() {
      const domains = await Storage.get();

      for (const url of domains) {
        this.check(url);
      }

      setTimeout(this.all, 60);
    }

    async check(url: string) {
      try {
        await fetch(url);
        const isAlive = this.alive.has(url);
        if (!isAlive) {
          this.update(url, true);
        }
      } catch (error) {
        const isAlive = this.alive.has(url);
        if (isAlive) {
          this.update(url, false, error.cause.code);
        }
      }
    }

    update(url: string, alive: boolean, reason = '') {
      this.alive[alive ? 'add' : 'delete'](url);
      if (alive) {
        this.telegramService.alive(url);
      } else {
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
