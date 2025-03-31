(window as any).global = window;
global.Buffer = global.Buffer || require('buffer').Buffer;

// (window as any).process = {
//   env: { DEBUG: undefined },
// };
// import * as crypto from 'crypto-browserify';
// (window as any).crypto = crypto;
// (window as any).crypto = require('crypto-browserify');

// import { ReadableStream, WritableStream } from 'stream-browserify';
// (window as any).ReadableStream = ReadableStream;
// (window as any).WritableStream = WritableStream;