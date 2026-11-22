import { IncomingMessage, ServerResponse } from 'http';
import { Duplex } from 'stream';
import { INestApplication } from '@nestjs/common';

export interface TestHttpResponse {
  status: number;
  headers: Record<string, any>;
  body: any;
  text: string;
}

class InMemoryRequestBuilder implements PromiseLike<TestHttpResponse> {
  private headers: Record<string, string> = {};
  private payload: any = undefined;
  private expectedStatus?: number;

  constructor(
    private readonly app: INestApplication,
    private readonly method: string,
    private readonly url: string,
  ) {}

  set(key: string, value: string): this {
    this.headers[key.toLowerCase()] = value;
    return this;
  }

  send(body: any): this {
    this.payload = body;
    return this;
  }

  expect(status: number): this {
    this.expectedStatus = status;
    return this;
  }

  private async execute(): Promise<TestHttpResponse> {
    const httpServer = this.app.getHttpServer();

    const bodyBuffer =
      this.payload !== undefined
        ? Buffer.from(
            typeof this.payload === 'string' ? this.payload : JSON.stringify(this.payload),
            'utf8',
          )
        : Buffer.alloc(0);

    if (this.payload !== undefined && !this.headers['content-type']) {
      this.headers['content-type'] = 'application/json';
    }
    if (bodyBuffer.length > 0) {
      this.headers['content-length'] = String(bodyBuffer.length);
    }

    return new Promise<TestHttpResponse>((resolve, reject) => {
      const socket = new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      (socket as any).remoteAddress = '127.0.0.1';

      const req = new IncomingMessage(socket as any);
      req.method = this.method;
      req.url = this.url;
      req.headers = { ...this.headers };

      const res = new ServerResponse(req);
      const chunks: Buffer[] = [];

      const origWrite = res.write.bind(res);
      const origEnd = res.end.bind(res);

      (res as any).write = (chunk: any, encoding?: any, cb?: any) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }
        return origWrite(chunk, encoding, cb);
      };

      (res as any).end = (chunk?: any, encoding?: any, cb?: any) => {
        if (chunk && typeof chunk !== 'function') {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }
        origEnd(chunk, encoding, cb);

        const rawBuf = Buffer.concat(chunks);
        const text = rawBuf.toString('utf8');
        const rawHeaders = res.getHeaders();
        const headers: Record<string, any> = {};
        for (const [k, v] of Object.entries(rawHeaders)) {
          headers[k.toLowerCase()] = v;
        }

        const contentType = String(headers['content-type'] || '');
        let parsedBody: any = text;
        if (contentType.includes('application/json') && text.length > 0) {
          try {
            parsedBody = JSON.parse(text);
          } catch {
            parsedBody = text;
          }
        } else if (
          contentType.includes('application/pdf') ||
          contentType.includes('spreadsheetml.sheet')
        ) {
          parsedBody = rawBuf;
        }

        const response: TestHttpResponse = {
          status: res.statusCode,
          headers,
          body: parsedBody,
          text,
        };

        if (this.expectedStatus !== undefined && response.status !== this.expectedStatus) {
          return reject(
            new Error(
              `Expected status ${this.expectedStatus} but received ${response.status}: ${text}`,
            ),
          );
        }
        resolve(response);
      };

      httpServer.emit('request', req, res);

      process.nextTick(() => {
        if (bodyBuffer.length > 0) {
          req.push(bodyBuffer);
        }
        req.push(null);
      });
    });
  }

  then<TResult1 = TestHttpResponse, TResult2 = never>(
    onfulfilled?: ((value: TestHttpResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function testRequest(app: INestApplication) {
  return {
    get: (url: string) => new InMemoryRequestBuilder(app, 'GET', url),
    post: (url: string) => new InMemoryRequestBuilder(app, 'POST', url),
    put: (url: string) => new InMemoryRequestBuilder(app, 'PUT', url),
    patch: (url: string) => new InMemoryRequestBuilder(app, 'PATCH', url),
    delete: (url: string) => new InMemoryRequestBuilder(app, 'DELETE', url),
  };
}
