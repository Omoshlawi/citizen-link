/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { ImageProcessingOptionsDto } from './ocr.dto';
import sharp from 'sharp';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class OcrService {
  constructor(private readonly httpService: HttpService) {}
  private readonly logger = new Logger(OcrService.name);

  /**
   * Download file from URL as a stream using HttpService
   */
  private async downloadFileAsStream(fileUrl: string): Promise<Readable> {
    try {
      const source$ = this.httpService.get(fileUrl, {
        responseType: 'stream',
      });

      const response = await lastValueFrom(source$);
      return response.data as Readable;
    } catch (error) {
      this.logger.error(
        `Failed to download file from ${fileUrl}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Download file from URL as a buffer using HttpService
   */
  async downloadFileAsBuffer(fileUrl: string): Promise<Buffer> {
    try {
      const source$ = this.httpService.get(fileUrl, {
        responseType: 'arraybuffer',
      });

      const response = await lastValueFrom(source$);
      return Buffer.from(response.data);
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

  blueImage(
    buffer: Buffer,
    type: 'gaussian' | 'light' | 'strong' = 'gaussian',
  ) {
    const b = type === 'gaussian' ? 5 : type === 'light' ? 0.8 : 12;
    // Use Sharp to create a blurred buffer
    // We resize it small so it's tiny (e.g., 20px) and apply a heavy blur
    return sharp(buffer).blur(b).toBuffer();
  }
  blueImageAsJpeg(buffer: Buffer) {
    // Use Sharp to create a blurred buffer
    // We resize it small so it's tiny (e.g., 20px) and apply a heavy blur
    return sharp(buffer)
      .resize(20, 20, { fit: 'inside' }) // Keep it tiny
      .blur(10) // More blur allows for more compression artifacts to be hidden
      .jpeg({
        quality: 30, // Aggressive compression
        progressive: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();
  }
}
