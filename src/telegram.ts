import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Module as NestModule } from '@nestjs/common';
import { Bot } from 'grammy';
import { Utils } from "./utils";
import { ApplicationError } from "./error";
import { Deployment } from "./deployment";

export namespace Telegram {
  export const CONSTRAINTS = {
    CHAT_ID: process.env.TELEGRAM_CHAT_ID || Utils._throw(ApplicationError.EnvironmentKeyNotProvided.new('TELEGRAM_CHAT_ID')),
    TOKEN: process.env.TELEGRAM_TOKEN || Utils._throw(ApplicationError.EnvironmentKeyNotProvided.new('TELEGRAM_TOKEN'))
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
  export class Service implements OnModuleDestroy {
    private readonly bot = new Bot(CONSTRAINTS.TOKEN);
    private readonly cache = new Map<string, Telegram.Cache.Type>();

    async send(payload: Deployment.DTO.Create): Promise<void> {
      const entry = this.cache.get(payload.commit);

      if (entry) {
        const baseText = (entry.text ?? this.text(payload)).trimEnd();
        const nextText = this.upsert(baseText, payload);

        clearTimeout(entry.timer);
        const timer = setTimeout(() => this.cache.delete(payload.commit), Telegram.Cache.TTL);
        this.cache.set(payload.commit, { message: entry.message, timer, text: nextText });

        await this.bot.api.editMessageText(CONSTRAINTS.CHAT_ID, entry.message, nextText, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        });
        return;
      }

      const text = this.text(payload);
      const msg = await this.bot.api.sendMessage(CONSTRAINTS.CHAT_ID, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });

      const timer = setTimeout(() => this.cache.delete(payload.commit), Telegram.Cache.TTL);
      this.cache.set(payload.commit, { message: msg.message_id, timer, text });
    }

    private text(payload: Deployment.DTO.Create): string {
      return [
        `🔍 <b>New deployment detected in repository</b> <code>${payload.repository}</code>`,
        ``,
        `Triggered by <i>"${Utils.escapeHtml(payload.name)}"</i> in branch <code>${Utils.escapeHtml(payload.branch)}</code> for commit <code>${Utils.escapeHtml(payload.commit)}</code> by <b>${Utils.escapeHtml(payload.by)}</b>`,
        ``,
        this.format(payload),
      ].join('\n');
    }

    private format(payload: Deployment.DTO.Create): string {
      const status = Telegram.Service.getStringStatus(payload.status);
      return `• Status of job <code>${Utils.escapeHtml(payload.stage)}</code> is <b>${status.text}</b> ${status.icon}`;
    }

    private upsert(message: string, payload: Deployment.DTO.Create): string {
      const escaped = Utils.escapeHtml(payload.stage).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^• Status of job <code>${escaped}</code> is .*$`, 'gm');
      const line = this.format(payload);
      if (pattern.test(message)) {
        return message.replace(pattern, line);
      }
      const newLine = message.endsWith('\n') ? '' : '\n';
      return `${message}${newLine}${line}`;
    }

    private static getStringStatus = (status: string): { icon: string, text: string } => ({
      success: { icon: '✅', text: 'Success' },
      failed: { icon: '⚠️', text: 'Failed' },
      pending: { icon: '🕑', text: 'Pending' },
      running: { icon: '🕑', text: 'Running' },
      canceled: { icon: '❌', text: 'Canceled' },
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
