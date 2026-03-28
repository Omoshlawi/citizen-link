export const DOCUMENT_EMBEDDING_QUEUE = 'document-indexing';

// Three-stage extraction pipeline — each stage triggers the next on success
export const CASE_VISION_EXTRACTION_QUEUE = 'case-vision-extraction';
export const CASE_TEXT_EXTRACTION_QUEUE = 'case-text-extraction';
export const CASE_POST_PROCESSING_QUEUE = 'case-post-processing';
