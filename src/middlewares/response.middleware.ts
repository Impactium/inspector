import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ResponseMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const _json = response.json.bind(response);
    const _send = response.send.bind(response);
    const _redirect = response.redirect.bind(response);

    const wrap = (body: any) => {
      const data = (() => { try { return JSON.parse(body) } catch (_) { return body } })();
      response.setHeader('Content-Type', 'application/json');
      response.locals.wrapped = true;

      return {
        timestamp: Date.now(),
        req_id: request['custom' as keyof Request]?.req_id || '',
        status: response.statusCode,
        data,
      };
    };

    response.json = (body) => _json(wrap(body));
    response.send = (body) => _send(response.locals.wrapped || response.locals.redirecting ? body : JSON.stringify(wrap(body)));
    response.redirect = (url: string | number, status: string | number = 302) => {
      response.locals.redirecting = true;
      return _redirect(
        typeof status === 'number' ? status : url as unknown as any,
        typeof url === 'number' ? status : url as unknown as any,
      );
    };

    next();
  }
}
