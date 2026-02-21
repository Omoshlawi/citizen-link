import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HUMAN_ID_OPTIONS } from './human-id.constants';
import {
  DecodedHumanId,
  HumanIdModuleOptions,
  ParsedHumanId,
} from './human-id.interface';
import { DecodeIdDto, GenerateIdDto } from './human-id.dto';

@Injectable()
export class HumanIdService {
  private readonly paddingLength: number;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(HUMAN_ID_OPTIONS) readonly options: HumanIdModuleOptions,
  ) {
    this.paddingLength = options.paddingLength ?? 6;
  }

  /**
   * Pads a sequence number with leading zeros.
   * @param seq The sequence number to pad.
   * @returns The padded sequence number.
   */
  private padSequence(seq: number): string {
    return String(seq).padStart(this.paddingLength, '0');
  }
  /**
   * Encodes a date into a base-36 string.
   * @param date The date to encode.
   * @returns The encoded date as a base-36 string.
   */
  private encodeEpoch(date: Date = new Date()): string {
    const epochSeconds = Math.floor(date.getTime() / 1000);
    return epochSeconds.toString(36).toUpperCase();
  }

  /**
   * Decodes a base-36 string back into a date.
   * @param encoded The encoded date as a base-36 string.
   * @returns The decoded date.
   */
  private decodeEpoch(encoded: string): Date {
    const epochSeconds = parseInt(encoded, 36);
    return new Date(epochSeconds * 1000);
  }

  /**
   * Parses a human ID into its components.
   * @param humanId The human ID to parse.
   * @returns An object containing the prefix, creation date, and sequence number.
   */
  private decode(humanId: string): DecodedHumanId {
    const parts = humanId.split('-');

    if (parts.length !== 3) {
      throw new Error(
        `Invalid humanId format: "${humanId}". Expected PREFIX-EPOCH-SEQUENCE`,
      );
    }

    const [prefix, epochEncoded, seqStr] = parts;
    const sequence = parseInt(seqStr, 10);

    if (isNaN(sequence)) {
      throw new Error(
        `Invalid sequence segment "${seqStr}" in humanId "${humanId}"`,
      );
    }

    const createdAt = this.decodeEpoch(epochEncoded);

    if (isNaN(createdAt.getTime())) {
      throw new Error(
        `Invalid epoch segment "${epochEncoded}" in humanId "${humanId}"`,
      );
    }

    return {
      raw: humanId,
      prefix,
      createdAt,
      sequence,
    };
  }

  /**
   * Parses a human ID into its components.
   * @param humanId The human ID to parse.
   * @returns An object containing the prefix, creation date, and sequence number.
   */
  parse(humanId: string): ParsedHumanId {
    const [prefix, epochEncoded, seqStr] = humanId.split('-');
    return {
      prefix,
      createdAt: this.decodeEpoch(epochEncoded),
      sequence: parseInt(seqStr, 10),
    };
  }

  decodeId({ id }: DecodeIdDto) {
    try {
      const decoded = this.decode(id);
      return {
        raw: decoded.raw,
        prefix: decoded.prefix,
        sequence: decoded.sequence,
        createdAt: decoded.createdAt,
        createdAtFormatted: decoded.createdAt.toUTCString(),
      };
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new BadRequestException(e.message);
    }
  }
  /**
   * Generates the next human ID for a given prefix.
   * @param prefix The prefix for the human ID.
   * @returns The generated human ID.
   */
  async generate({ prefix }: GenerateIdDto): Promise<string> {
    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.entitySequence.upsert({
        where: { prefix },
        update: { lastSeq: { increment: 1 } },
        create: { prefix, lastSeq: 1 },
      });
    });

    const epochEncoded = this.encodeEpoch();
    const paddedSeq = this.padSequence(updated.lastSeq);

    return `${prefix}-${epochEncoded}-${paddedSeq}`;
  }

  /**
   * Gets all sequences.
   * @returns An array of all sequences.
   */
  async getAllSequences() {
    const sequences = await this.prisma.entitySequence.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return {
      results: sequences.map((seq) => ({
        prefix: seq.prefix,
        lastSequence: seq.lastSeq,
        paddedSequence: this.padSequence(seq.lastSeq),
        lastUsedAt: seq.updatedAt,
        nextWillBe: `${seq.prefix}-${this.encodeEpoch()}-${this.padSequence(seq.lastSeq + 1)}`,
      })),
    };
  }
}
