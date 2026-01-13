import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchFoundDocumentService } from './matching.found.service';
import { MatchLostDocumentService } from './matching.lost.service';
import { MatchingVerifierService } from './matching.verifier.service';
import { MatchingController } from './matching.controller';

@Module({
  providers: [
    MatchingService,
    MatchFoundDocumentService,
    MatchLostDocumentService,
    MatchingVerifierService,
  ],
  exports: [MatchingService],
  controllers: [MatchingController],
})
export class MatchingModule {}
