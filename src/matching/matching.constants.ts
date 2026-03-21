export const MATCHING_OPTIONS_TOKEN = 'MATCHING_OPTIONS_TOKEN';

// OCR confusion pairs — used in fuzzy matching
export const OCR_CONFUSION_PAIRS: [string, string][] = [
  ['0', 'O'],
  ['1', 'I'],
  ['1', 'L'],
  ['5', 'S'],
  ['8', 'B'],
  ['6', 'G'],
  ['2', 'Z'],
  ['4', 'A'],
];

// Field weights for Layer 2 exact matching — must sum to 1.0
export const EXACT_FIELD_WEIGHTS = {
  documentNumber: 0.4, // back to strongest — unique identifier
  fullName: 0.3, // primary name field
  dateOfBirth: 0.2, // strong corroborating signal
  serialNumber: 0.1, // secondary identifier
} as const;

export const DOCUMENT_MATCHING_QUEUE = 'document-matching';
