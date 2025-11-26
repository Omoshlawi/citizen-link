import { Module } from '@nestjs/common';
import { DocumentImagesController } from './document-images.controller';
import { DocumentImagesService } from './document-images.service';

@Module({
  controllers: [DocumentImagesController],
  providers: [DocumentImagesService]
})
export class DocumentImagesModule {}
