import { Body, HttpCode, Controller as NestController, Module as NestModule, Post } from "@nestjs/common";
import { Telegram } from "./telegram";
import { ApiBody } from "@nestjs/swagger";

export namespace Registration {
  @NestController('registration')
  export class Controller {
    constructor(
      private readonly telegramService: Telegram.Service
    ) { }

    @Post()
    @HttpCode(200)
    @ApiBody({
      description: 'Key-Value object',
      schema: {
        type: 'object',
        additionalProperties: { type: 'string' },
        example: { name: 'John Doe', telegram: '@johndoe' }
      },
    })
    post(@Body() payload: Record<string, string>) {
      this.telegramService.registration(payload);

      return { ok: true };
    }
  }

  @NestModule({
    imports: [Telegram.Module],
    controllers: [Registration.Controller],
  })
  export class Module { }
}
