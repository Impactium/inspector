import { Body, HttpCode, Injectable, Logger, Controller as NestController, Module as NestModule, Post } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, Matches } from "class-validator";
import { Telegram } from "./telegram";

export namespace Deployment {
  export namespace DTO {
    export class Create {
      @ApiProperty({
        description: 'Repository in owner/name format',
        example: 'Impactium/inspector',
      })
      @IsString()
      @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
        message: 'repository must be "owner/repo"',
      })
      repository!: string;

      @ApiProperty({
        description: 'Job name that produced this event',
        example: 'build-and-deploy',
      })
      @IsString()
      name!: string;

      @ApiProperty({
        description: 'Git branch that triggered the job',
        example: 'main',
      })
      @IsString()
      @Matches(/^[A-Za-z0-9._\/-]+$/, {
        message: 'branch may contain letters, digits, ".", "_", "-", "/"',
      })
      branch!: string;

      @ApiProperty({
        description: 'Commit SHA (7–40 hex chars)',
        example: '9f2c4a1',
      })
      @IsString()
      @Matches(/^[0-9a-f]{7,40}$/i, {
        message: 'commit must be a 7–40 character hex SHA',
      })
      commit!: string;

      @ApiProperty({
        description: 'Commit author display name',
        example: 'Alice Doe',
      })
      @IsString()
      by!: string;

      @ApiProperty({
        description: 'Pipeline stage name',
        example: 'migrate-db',
      })
      @IsString()
      stage!: string;

      @ApiProperty({
        description: 'Deployment status',
        example: 'success | failed | pending | running | canceled',
      })
      @IsString()
      status!: string;
    }
  }

  @NestController('deployment')
  export class Controller {
    constructor(
      private readonly telegramService: Telegram.Service
    ) { }

    @Post()
    @HttpCode(200)
    post(@Body() payload: Deployment.DTO.Create) {
      this.telegramService.send(payload);

      return { ok: true };
    }
  }

  @NestModule({
    imports: [Telegram.Module],
    controllers: [Deployment.Controller],
  })
  export class Module { }
}
