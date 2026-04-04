import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CandidateMatch, VectorSearchParams } from './matching.interface';

@Injectable()
export class MatchingQueryService {
  constructor(private readonly prisma: PrismaService) {}

  // Direction 1 — lost case submitted → search verified found documents
  /**
   * Find candidates for a lost document case based on vector search.
   * @param params - The vector search parameters.
   * @returns An array of candidate matches.
   */
  async findFoundCandidates(
    params: VectorSearchParams,
  ): Promise<CandidateMatch[]> {
    const vectorString = `[${params.embeddingVector.join(',')}]`;
    const dims = params.embeddingVector.length;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<Omit<CandidateMatch, 'similarity'> & { similarity: string }>
    >(
      `
      SELECT 
        d.id as "documentId",
        d."caseId",
        d."typeId",
        d."fullName",
        d."documentNumber",
        d."serialNumber",
        d."dateOfBirth",
        d."placeOfBirth",
        1 - (d.embedding_${dims} <=> $1::vector) as similarity
      FROM "documents" d
      INNER JOIN "document_cases" dc ON d."caseId" = dc.id
      INNER JOIN "found_document_cases" fdc ON dc.id = fdc."caseId"
      WHERE 
        d.embedding_${dims} IS NOT NULL
        AND d."typeId" = $2
        AND fdc.status IN ('VERIFIED')
        AND d.id != $3
        AND dc."userId" != $4
        AND 1 - (d.embedding_${dims} <=> $1::vector) > $5
      ORDER BY d.embedding_${dims} <=> $1::vector
      LIMIT $6
      `,
      vectorString,
      params.typeId,
      params.excludeDocumentId,
      params.excludeUserId,
      params.similarityThreshold,
      params.topN,
    );

    return this.parseRows(rows);
  }

  // Direction 2 — found case verified → search submitted lost documents
  /**
   * Find candidates for a found document case based on vector search.
   * @param params - The vector search parameters.
   * @returns An array of candidate matches.
   */
  async findLostCandidates(
    params: VectorSearchParams,
  ): Promise<CandidateMatch[]> {
    const vectorString = `[${params.embeddingVector.join(',')}]`;
    const dims = params.embeddingVector.length;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<Omit<CandidateMatch, 'similarity'> & { similarity: string }>
    >(
      `
      SELECT 
          d.id as "documentId",
          d."caseId",
          d."typeId",
          d."fullName",
          d."documentNumber",
          d."serialNumber",
          d."dateOfBirth",
          d."placeOfBirth",
          1 - (d.embedding_${dims} <=> $1::vector) as similarity
        FROM "documents" d
        INNER JOIN "document_cases" dc ON d."caseId" = dc.id
        INNER JOIN "lost_document_cases" ldc ON dc.id = ldc."caseId"
        WHERE 
          d.embedding_${dims} IS NOT NULL
          AND d."typeId" = $2
          AND ldc.status = 'SUBMITTED'
          AND d.id != $3
          AND dc."userId" != $4
          AND 1 - (d.embedding_${dims} <=> $1::vector) > $5
        ORDER BY d.embedding_${dims} <=> $1::vector
        LIMIT $6
      `,
      vectorString,
      params.typeId,
      params.excludeDocumentId,
      params.excludeUserId,
      params.similarityThreshold,
      params.topN,
    );

    return this.parseRows(rows);
  }

  private parseRows(
    rows: Array<Omit<CandidateMatch, 'similarity'> & { similarity: string }>,
  ): CandidateMatch[] {
    return rows.map((r) => ({
      ...r,
      similarity: parseFloat(parseFloat(r.similarity).toFixed(4)),
    }));
  }
}
