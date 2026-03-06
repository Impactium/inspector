import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Module as NestModule } from '@nestjs/common';
import { Bot } from 'grammy';
import { Utils } from "./utils";
import { ApplicationError } from "./error";
import { Deployment } from "./deployment";
import { Domain } from "./domain";
import { Storage } from "./storage";

export namespace Telegram {
  export const CONSTRAINTS = {
    TOKEN: process.env.TELEGRAM_TOKEN || Utils._throw(ApplicationError.EnvironmentKeyNotProvided.new('TELEGRAM_TOKEN')),
    DEPLOYMENT_CHAT_ID: process.env.TELEGRAM_DEPLOYMENT_CHAT_ID || Utils._throw(ApplicationError.EnvironmentKeyNotProvided.new('TELEGRAM_DEPLOYMENT_CHAT_ID')),
    REGISTRATION_CHAT_ID: process.env.TELEGRAM_REGISTRATION_CHAT_ID || Utils._throw(ApplicationError.EnvironmentKeyNotProvided.new('TELEGRAM_REGISTRATION_CHAT_ID')),
    DOMAIN_CHAT_ID: process.env.TELEGRAM_DOMAIN_CHAT_ID || Utils._throw(ApplicationError.EnvironmentKeyNotProvided.new('TELEGRAM_DOMAIN_CHAT_ID')),
  } as const;

  export namespace Cache {
    export interface Type {
      message: number;
      timer: NodeJS.Timeout;
      text: string;
    }
    export const TTL = 1000 * 60 * 30;
  }

  @Injectable()
  export class Service implements OnModuleInit, OnModuleDestroy {
    private readonly bot = new Bot(CONSTRAINTS.TOKEN);
    private readonly cache = new Map<string, Telegram.Cache.Type>();

    async onModuleInit() {
      this.bot.command('add_domain', ctx => this.updateDomain(ctx.match, 'add', ctx));
      this.bot.command('delete_domain', ctx => this.updateDomain(ctx.match, 'delete', ctx));

      this.bot.on('callback_query:data', async ctx => {
        const data = ctx.callbackQuery?.data;
        if (!data) return;
        if (data.startsWith('delete_')) {
          const domain = data.replace('delete_', '');
          await this.updateDomain(domain, 'delete', ctx);
          await ctx.editMessageText(`<strong>⚠️ Домен удалён:</strong> <code>${domain}</code>`, { parse_mode: 'HTML' });
          await ctx.answerCallbackQuery({ text: `Домен ${domain} удалён` });
        }
      });

      this.bot.start();
    }

    async deployment(payload: Deployment.DTO.Create): Promise<void> {
      const entry = this.cache.get(payload.commit);

      const text = this.text('deployment', payload);

      if (entry) {
        const baseText = (entry.text ?? text).trimEnd();
        const nextText = this.upsert(baseText, payload);

        clearTimeout(entry.timer);
        const timer = setTimeout(() => this.cache.delete(payload.commit), Telegram.Cache.TTL);
        this.cache.set(payload.commit, { message: entry.message, timer, text: nextText });

        await this.editMessageTextWithRetry(CONSTRAINTS.DEPLOYMENT_CHAT_ID, entry.message, nextText, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      const msg = await this.sendMessageWithRetry(CONSTRAINTS.DEPLOYMENT_CHAT_ID, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });

      if (!msg) return;

      const timer = setTimeout(() => this.cache.delete(payload.commit), Telegram.Cache.TTL);
      this.cache.set(payload.commit, { message: msg.message_id, timer, text });
    }

    async registration(payload: Record<string, string>): Promise<void> {
      await this.sendMessageWithRetry(CONSTRAINTS.REGISTRATION_CHAT_ID, this.text('registration', payload), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    }

    async dead(domain: string, reason: string): Promise<void> {
      await this.sendMessageWithRetry(CONSTRAINTS.DOMAIN_CHAT_ID, `<strong>⚠️ Домен упал!</strong>\n\Домен <code>${domain}</code> упал в <code>${new Date().toUTCString()}</code> по UTC.\n\nПричина: <code>${reason}</code>`, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Удалить домен', callback_data: `delete_${domain}` }]
          ]
        }
      });
    }

    async alive(domain: string): Promise<void> {
      await this.sendMessageWithRetry(CONSTRAINTS.DOMAIN_CHAT_ID, `<strong>✅ Домен ожил!</strong>\n\n Домен <code>${domain}</code> ожил в <code>${new Date().toUTCString()}</code> по UTC`, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true }
      });
    }

    private async retryOn429<T>(fn: () => Promise<T>): Promise<T | null> {
      try {
        return await new Promise(resolve => setTimeout(() => fn().then(resolve), Math.random() * 5000))
      } catch (error) {
        if (error.error_code === 429 && error.parameters?.retry_after) {
          const retryAfter = error.parameters.retry_after * 1000;
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          return await fn();
        } else {
          return null;
        }
      }
    }

    private async sendMessageWithRetry(chatId: string, text: string, options?: any) {
      return this.retryOn429(() => this.bot.api.sendMessage(chatId, text, options));
    }

    private async editMessageTextWithRetry(chatId: string, messageId: number, text: string, options?: any) {
      return this.retryOn429(() => this.bot.api.editMessageText(chatId, messageId, text, options));
    }

    private async updateDomain(domain: string, action: 'add' | 'delete', ctx?: any) {
      const domains = await Storage.get();

      if (action === 'add') {
        if (domains.has(domain)) return ctx?.reply(`Домен уже в списке: ${domain}`);
        domains.add(domain);
        await Storage.set(domains);
        return ctx?.reply(`Добавлен домен: ${domain}`);
      }

      if (action === 'delete') {
        if (!domains.has(domain)) return ctx?.reply(`Домен не найден: ${domain}`);
        domains.delete(domain);
        await Storage.set(domains);
        return ctx?.reply(`Удалён домен: ${domain}`);
      }
    }


    private text(use: 'deployment' | 'registration', payload: Record<string, any>): string {
      switch (use) {
        case 'deployment':
          return [
            `🔍 <b>Обнаружен новый деплой в репозитории</b> <code>${payload.repository}</code>`,
            ``,
            `Запущено коммитом <i>"${Utils.escapeHtml(payload.name)}"</i> в ветке <code>${Utils.escapeHtml(payload.branch)}</code> с айди <code>${Utils.escapeHtml(payload.commit)}</code> разработчиком <b>${Utils.escapeHtml(payload.by)}</b>`,
            ``,
            this.format(payload)
          ].join('\n');
        case 'registration':
          return [
            `<b>🟢 Новая регистрация</b>`,
            ``,
            `Данные:`,
            `<code>${JSON.stringify(payload, null, 2)}</code>`,
          ].join('\n');
      }
    }

    private format(payload: Record<string, any>): string {
      const status = Telegram.Service.getStringStatus(payload.status);
      return `• Статус задачи <code>${Utils.escapeHtml(payload.stage)}</code>: <b>${status.text}</b> ${status.icon}`;
    }

    private upsert(message: string, payload: Deployment.DTO.Create): string {
      const escaped = Utils.escapeHtml(payload.stage).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^• Статус задачи <code>${escaped}</code>: .*$`, 'gm');
      const line = this.format(payload);
      if (pattern.test(message)) {
        return message.replace(pattern, line);
      }
      const newLine = message.endsWith('\n') ? '' : '\n';
      return `${message}${newLine}${line}`;
    }

    private static getStringStatus = (status: string): { icon: string, text: string } => ({
      success: { icon: '✅', text: 'Успешно' },
      failed: { icon: '⚠️', text: 'Ошибка' },
      pending: { icon: '🕑', text: 'Ожидание' },
      running: { icon: '🕑', text: 'Выполняется' },
      canceled: { icon: '❌', text: 'Отменено' },
    })[status] ?? { icon: '❓', text: Utils.escapeHtml(status) };

    onModuleDestroy(): void {
      for (const item of this.cache.values()) clearTimeout(item.timer);
      this.cache.clear();
    }
  }

  @NestModule({
    providers: [Telegram.Service],
    exports: [Telegram.Service],
  })
  export class Module { }
}
