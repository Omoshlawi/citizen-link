/**
 * Extraction pipeline step names.
 *
 * Stored as plain TEXT in the database (ai_extractions.current_step) so
 * adding a new step never requires a schema migration — just extend this enum.
 *
 * Enforced at the service layer: only values defined here should be written.
 */
export enum ExtractionStep {
  VISION = 'VISION',
  STRUCTURE = 'STRUCTURE',
}
