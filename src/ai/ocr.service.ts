/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

@Injectable()
export class OcrService {
  async recognizeFromUrl(url: string) {
    const worker = await createWorker();
    const { data } = await worker.recognize(url);
    await worker.terminate();
    return data.text as string;
  }

  async recognizeFromBuffer(buffer: Buffer) {
    const worker = await createWorker();
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return data.text as string;
  }
}
