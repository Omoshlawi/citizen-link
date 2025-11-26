/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { createWorker } from 'tesseract.js';
import { ImageProcessingOptionsDto } from './ocr.dto';
import sharp from 'sharp';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  async recognizeFromUrl(url: string) {
    const worker = await createWorker();
    const { data } = await worker.recognize(url);
    await worker.terminate();
    return data.text;
  }

  async recognizeFromBuffer(buffer: Buffer) {
    const worker = await createWorker();
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return data.text;
  }

  /**
   * Download file from URL as a stream
   */
  private async downloadFileAsStream(fileUrl: string): Promise<Readable> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download file: ${response.status} ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // Convert web stream to Node.js Readable stream
      return Readable.fromWeb(response.body as any);
    } catch (error) {
      this.logger.error(
        `Failed to download file from ${fileUrl}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Download file from URL as a buffer
   */
  private async downloadFileAsBuffer(fileUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download file: ${response.status} ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(
        `Failed to download file from ${fileUrl}: ${error.message}`,
      );
      throw error;
    }
  }

  async processImage(options: ImageProcessingOptionsDto, buffer: Buffer) {
    const {
      fit,
      grayScale,
      brightness = 1,
      contrast,
      height,
      width,
      blur,
      hue = 1,
      lightness = 1,
      saturation = 1,
      sharpness,
      normalize,
      threshold,
    } = options;
    let sharpInstance = sharp(buffer)
      .grayscale(grayScale)
      .resize(width, height, { fit })
      .modulate({
        hue: hue,
        saturation: saturation,
        lightness: lightness,
        brightness,
      });

    // Apply contrast if specified
    if (contrast !== undefined) {
      // Sharp.js doesn't have a direct 'contrast' method.
      // We can approximate contrast adjustment using the 'linear' transformation.
      // A multiplier > 1 increases contrast, and < 1 decreases it.
      const multiplier = contrast;
      const offset = -(128 * multiplier) + 128;
      sharpInstance = sharpInstance.linear(multiplier, offset);
    }

    if (sharpness !== undefined) {
      sharpInstance = sharpInstance.sharpen({ sigma: sharpness });
    }

    if (blur !== undefined) {
      sharpInstance = sharpInstance.blur(blur);
    }

    if (normalize) {
      sharpInstance = sharpInstance.normalize();
    }

    if (threshold !== undefined) {
      sharpInstance = sharpInstance.threshold(threshold);
    }

    return sharpInstance.toBuffer();
  }

  async processImageFromUrl(options: ImageProcessingOptionsDto, url: string) {
    const buffer = await this.downloadFileAsBuffer(url);
    return this.processImage(options, buffer);
  }
}
