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

      setTimeout(this.all, 1000 * 60);
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
