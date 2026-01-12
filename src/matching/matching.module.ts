import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchFoundDocumentService } from './matching.found.service';
import { MatchLostDocumentService } from './matching.lost.service';
import { MatchingVerifierService } from './matching.verifier.service';

@Module({
  providers: [
    MatchingService,
    MatchFoundDocumentService,
    MatchLostDocumentService,
    MatchingVerifierService,
  ],
  exports: [MatchingService],
})
export class MatchingModule {}
