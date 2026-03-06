/* eslint-disable @typescript-eslint/unbound-method */
import { Configuration, Value } from '@itgorillaz/configify';
import z from 'zod';

@Configuration()
export class MatchingConfig {
  // Weights
  @Value('MATCH_WEIGHT_VECTOR', {
    default: 0.25,
    parse: z.coerce.number().optional().parse,
  })
  weightVector: number;
  @Value('MATCH_WEIGHT_EXACT', {
    default: 0.4,
    parse: z.coerce.number().optional().parse,
  })
  weightExact: number;
  @Value('MATCH_WEIGHT_AI', {
    default: 0.35,
    parse: z.coerce.number().optional().parse,
  })
  weightAi: number;

  //   Thresholds
  // ─── Layer 1 — Vector similarity ─────────────────

  /**
   *  0.70 — intentionally permissive — Layer 1 casts a wide net
   *  increase to 0.80+ only if too many false candidates reach Layer 2
   */
  @Value('MATCH_VECTOR_THRESHOLD', {
    default: 0.7,
    parse: z.coerce.number().optional().parse,
  })
  vectorSimilarityThreshold: number;

  /**
   * 10 — enough candidates for good recall without overloading Layer 3
   * increase if high-volume system misses valid matches
   */
  @Value('MATCH_TOP_N_CANDIDATES', {
    default: 20,
    parse: z.coerce.number().optional().parse,
  })
  topNCandidates: number;

  // ─── Layer 2 — Exact field matching ──────────────
  /**
   *  0.40 — allows partial matches (OCR errors) to survive
   *  a document with correct DOB + surname but OCR'd number scores ~0.65
   *  increase to 0.55+ only if too many weak candidates reach Layer 3
   */
  @Value('MATCH_EXACT_THRESHOLD', {
    default: 0.4,
    parse: z.coerce.number().optional().parse,
  })
  exactMatchThreshold: number;

  // ─── Layer 3 — AI verification ───────────────────
  /**
   *  0.65 — AI overallScore minimum to survive Layer 3
   *  below this the AI is not confident enough to proceed
   *  increase to 0.75+ for stricter matching
   */
  @Value('MATCH_AI_THRESHOLD', {
    default: 0.65,
    parse: z.coerce.number().optional().parse,
  })
  aiMatchThreshold: number;

  // ─── Final score ──────────────────────────────────
  /**
   *  0.75 — minimum weighted final score to be persisted as a match
   *    below this all three layers did not agree strongly enough
   *   increase to 0.80+ for stricter systems
   */
  @Value('MATCH_MIN_FINAL_SCORE', {
    default: 0.75,
    parse: z.coerce.number().optional().parse,
  })
  minimumFinalScore: number;

  /**
   *  0.95 — above this finalScore → AUTO_CONFIRMED, no human review needed
   *  only set this high — auto-confirmation skips admin review entirely
   */
  @Value('MATCH_AUTO_CONFIRM_THRESHOLD', {
    default: 0.95,
    parse: z.coerce.number().optional().parse,
  })
  autoConfirmThreshold: number;

  /**
   *  4 — enough to verify ownership without being burdensome
   */
  @Value('MATCH_MAX_SECURITY_QUESTIONS', {
    default: 4,
    parse: z.coerce.number().optional().parse,
  })
  maxSecurityQuestions: number;
}
