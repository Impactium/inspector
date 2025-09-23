import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestMiddleware implements NestMiddleware {
  use(request: Request, _: Response, next: NextFunction) {
    // @ts-ignore
    request['custom'] = {
      timestamp: Date.now(),
      req_id: typeof request.headers['req_id'] === 'string'
        ? request.headers['req_id']
        : randomUUID()
    };
    next();
  }
}
