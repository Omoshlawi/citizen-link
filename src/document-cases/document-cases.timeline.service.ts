import { Injectable, NotFoundException } from '@nestjs/common';
import { UserSession } from '../auth/auth.types';
import { isSuperUser } from '../app.utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentCasesTimelineService {
  constructor(private readonly prismaService: PrismaService) {}

  private async isClaimantAVerifiedOwner(caseId: string, userId: string) {
    return this.prismaService.claim.findFirst({
      where: {
        status: 'VERIFIED',
        userId,
        match: {
          lostDocumentCase: { case: { userId } },
          foundDocumentCase: { caseId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCaseTimeline(id: string, user: UserSession['user']) {
    const isAdmin = isSuperUser(user);
    const isVerifiedOwner = await this.isClaimantAVerifiedOwner(id, user.id);

    const docCase = await this.prismaService.documentCase.findUnique({
      where: { id, userId: isAdmin || isVerifiedOwner ? undefined : user.id },
      select: {
        eventDate: true,
        createdAt: true,
        extraction: {
          select: { extractionStatus: true, createdAt: true },
        },
        lostDocumentCase: {
          select: {
            id: true,
            auto: true,
            matches: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                createdAt: true,
                claims: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    createdAt: true,
                    status: true,
                    handover: {
                      select: {
                        scheduledDate: true,
                        completedAt: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        foundDocumentCase: {
          select: {
            id: true,
            matches: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                createdAt: true,
                claims: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    createdAt: true,
                    status: true,
                    handover: {
                      select: {
                        scheduledDate: true,
                        completedAt: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!docCase) throw new NotFoundException('Document case not found');

    const isLost = !!docCase.lostDocumentCase;
    const sub = isLost ? docCase.lostDocumentCase : docCase.foundDocumentCase;
    const subEntityId = sub?.id;
    const matches = sub?.matches ?? [];

    // Pick the most meaningful match to follow.
    // Priority: verified claim > active claim (pending/under_review) > any claim > latest match.
    // Within the same priority tier, prefer the most recently created match.
    const matchPriority = (m: (typeof matches)[number]): number => {
      if (m.claims.some((c) => c.status === 'VERIFIED')) return 0;
      if (
        m.claims.some(
          (c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW',
        )
      )
        return 1;
      if (m.claims.length > 0) return 2;
      return 3;
    };
    const selectedMatch =
      [...matches].sort((a, b) => {
        const diff = matchPriority(a) - matchPriority(b);
        return diff !== 0
          ? diff
          : b.createdAt.getTime() - a.createdAt.getTime();
      })[0] ?? null;

    // Pick the most meaningful claim within the selected match.
    // Priority: verified > active (pending/under_review) > latest.
    const claimPriority = (
      c: (typeof matches)[number]['claims'][number],
    ): number => {
      if (c.status === 'VERIFIED') return 0;
      if (c.status === 'PENDING' || c.status === 'UNDER_REVIEW') return 1;
      return 2;
    };
    const selectedClaim = selectedMatch
      ? ([...selectedMatch.claims].sort((a, b) => {
          const diff = claimPriority(a) - claimPriority(b);
          return diff !== 0
            ? diff
            : b.createdAt.getTime() - a.createdAt.getTime();
        })[0] ?? null)
      : null;

    const handover = selectedClaim?.handover ?? null;

    // Fetch sub-entity transitions + claim transitions in one round trip.
    const transitionEntityIds = [
      subEntityId,
      ...(selectedClaim ? [selectedClaim.id] : []),
    ].filter(Boolean) as string[];

    const allTransitions = await this.prismaService.statusTransition.findMany({
      where: { entityId: { in: transitionEntityIds } },
      select: { entityId: true, toStatus: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const subTransitionMap = new Map(
      allTransitions
        .filter((t) => t.entityId === subEntityId)
        .map((t) => [t.toStatus, t.createdAt]),
    );
    const claimTransitionMap = new Map(
      allTransitions
        .filter((t) => t.entityId === selectedClaim?.id)
        .map((t) => [t.toStatus, t.createdAt]),
    );

    const events: {
      key: string;
      timestamp: string | null;
      status: 'done' | 'active' | 'pending';
    }[] = [];

    // 1. Document event
    events.push({
      key: 'document_event',
      timestamp: docCase.eventDate.toISOString(),
      status: 'active',
    });

    // 2. Case reported
    events.push({
      key: 'case_reported',
      timestamp: docCase.createdAt.toISOString(),
      status: 'done',
    });

    // 3. AI extraction (found always; lost only when auto=true)
    const needsExtraction = !isLost || docCase.lostDocumentCase!.auto;
    if (needsExtraction && docCase.extraction) {
      const extStatus = docCase.extraction.extractionStatus;
      events.push({
        key: 'ai_extraction',
        timestamp:
          extStatus === 'COMPLETED'
            ? docCase.extraction.createdAt.toISOString()
            : null,
        status:
          extStatus === 'COMPLETED'
            ? 'done'
            : extStatus === 'FAILED'
              ? 'pending'
              : 'active',
      });
    }

    // 4. Case submitted
    const submittedAt = subTransitionMap.get('SUBMITTED');
    events.push({
      key: 'case_submitted',
      timestamp: submittedAt ? submittedAt.toISOString() : null,
      status: submittedAt ? 'done' : 'pending',
    });

    // 5. Verified / rejected (found cases only)
    if (!isLost) {
      const rejectedAt = subTransitionMap.get('REJECTED');
      const verifiedAt = subTransitionMap.get('VERIFIED');
      if (rejectedAt) {
        events.push({
          key: 'case_rejected',
          timestamp: rejectedAt.toISOString(),
          status: 'done',
        });
      } else {
        events.push({
          key: 'case_verified',
          timestamp: verifiedAt ? verifiedAt.toISOString() : null,
          status: verifiedAt ? 'done' : 'pending',
        });
      }
    }

    // 6. Document matched — uses the selected (highest-priority) match
    events.push({
      key: 'document_matched',
      timestamp: selectedMatch ? selectedMatch.createdAt.toISOString() : null,
      status: selectedMatch ? 'done' : 'pending',
    });

    // 7. Claim submitted
    events.push({
      key: 'claim_submitted',
      timestamp: selectedClaim ? selectedClaim.createdAt.toISOString() : null,
      status: selectedClaim ? 'done' : 'pending',
    });

    // 8. Claim outcome: verified or rejected/cancelled
    const isClaimTerminated =
      selectedClaim?.status === 'REJECTED' ||
      selectedClaim?.status === 'CANCELLED';

    if (isClaimTerminated) {
      const terminatedAt =
        claimTransitionMap.get(selectedClaim.status) ??
        claimTransitionMap.get('REJECTED') ??
        claimTransitionMap.get('CANCELLED');
      events.push({
        key: 'claim_rejected',
        timestamp: terminatedAt ? terminatedAt.toISOString() : null,
        status: 'done',
      });
    } else {
      const verifiedAt = claimTransitionMap.get('VERIFIED');
      events.push({
        key: 'claim_verified',
        timestamp: verifiedAt ? verifiedAt.toISOString() : null,
        status: selectedClaim?.status === 'VERIFIED' ? 'done' : 'pending',
      });
    }

    // 9. Handover scheduled
    events.push({
      key: 'handover_scheduled',
      timestamp: handover ? handover.scheduledDate.toISOString() : null,
      status: !handover
        ? 'pending'
        : handover.status === 'SCHEDULED' || handover.status === 'IN_PROGRESS'
          ? 'active'
          : 'done',
    });

    // 10. Case completed (document returned)
    events.push({
      key: 'case_completed',
      timestamp: handover?.completedAt
        ? handover.completedAt.toISOString()
        : null,
      status: handover?.status === 'COMPLETED' ? 'done' : 'pending',
    });

    return { events };
  }
}
