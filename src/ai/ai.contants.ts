import { GenerateContentConfig, Type } from '@google/genai';

export const AI_OPTIONS_TOKEN = 'AI_OPTIONS';
export const AI_DATA_EXTRACT_CONFIG: GenerateContentConfig = {
  temperature: 0.1,
  responseMimeType: 'application/json', // Critical for structured output
  maxOutputTokens: 2048,
  // NOTE: The responseSchema is identical to scanAsStream
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      serialNumber: {
        type: Type.STRING,
        description: 'Serial number of the document',
        title: 'Serial Number',
        nullable: true,
      },
      documentNumber: {
        type: Type.STRING,
        description: 'Document number (unique identifier on most documents)',
        title: 'Document Number',
        nullable: true,
      },
      batchNumber: {
        type: Type.STRING,
        description: 'Batch number or barcode/QR batch',
        title: 'Batch Number',
        nullable: true,
      },
      issuer: {
        type: Type.STRING,
        description: 'Issuer (government, authority, country, state, etc.)',
        title: 'Issuer',
        nullable: true,
      },
      ownerName: {
        type: Type.STRING,
        description: "Owner's full name as printed on the document (optional)",
        title: 'Owner Name',
        nullable: true,
      },
      dateOfBirth: {
        type: Type.STRING,
        description: "Owner's date of birth (ISO: YYYY-MM-DD)",
        title: 'Date of Birth',
        nullable: true,
      },
      placeOfBirth: {
        type: Type.STRING,
        description: "Owner's place of birth (city, country, etc.)",
        title: 'Place of Birth',
        nullable: true,
      },
      placeOfIssue: {
        type: Type.STRING,
        description: 'Document place of issue (if available)',
        title: 'Place of Issue',
        nullable: true,
      },
      gender: {
        type: Type.STRING,
        description: "Owner's gender (Male, Female, Unknown)",
        enum: ['Male', 'Female', 'Unknown'],
        title: 'Gender',
        nullable: true,
      },
      note: {
        type: Type.STRING,
        description: 'Special notes, remarks or status found on the document',
        title: 'Note',
        nullable: true,
      },
      typeId: {
        type: Type.STRING,
        description:
          'Document type identifier (should match one of the provided document types)',
        title: 'Type ID',
      },
      issuanceDate: {
        type: Type.STRING,
        description: "Document's issuance/issue date (ISO format if possible)",
        title: 'Issuance Date',
        nullable: true,
      },
      expiryDate: {
        type: Type.STRING,
        description: "Document's expiration/expiry date (ISO: YYYY-MM-DD)",
        title: 'Expiry Date',
        nullable: true,
      },
      additionalFields: {
        type: Type.ARRAY,
        description:
          'Additional fields found on the document that do not fit standard categories',
        title: 'Additional Fields',
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            fieldName: {
              type: Type.STRING,
              description: 'Name of the field',
              title: 'Field Name',
            },
            fieldValue: {
              type: Type.STRING,
              description: 'Value of the field',
              title: 'Field Value',
            },
          },
        },
      },
      securityQuestions: {
        type: Type.ARRAY,
        description:
          'Security questions and answers derived from document content',
        title: 'Security Questions',
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            question: {
              type: Type.STRING,
              title: 'Question',
              description: 'Security question',
            },
            answer: {
              type: Type.STRING,
              title: 'Answer',
              description: 'Answer to the question',
            },
          },
        },
      },
    },
  },
};

export const AI_CONFIDENCE_CONFIG: GenerateContentConfig = {
  temperature: 0.1,
  responseMimeType: 'application/json', // Critical for structured output
  maxOutputTokens: 2048,
  responseSchema: {
    type: Type.OBJECT,
    properties: {
      serialNumber: {
        type: Type.NUMBER,
        description: 'Confidence score for serial number if found else null',
        title: 'Serial Number',
        nullable: true,
      },
      documentNumber: {
        type: Type.NUMBER,
        description: 'Confidence score for document number if found else null',
        title: 'Document Number',
        nullable: true,
      },
      batchNumber: {
        type: Type.NUMBER,
        description: 'Confidence score for batch number if found else null',
        title: 'Batch Number',
        nullable: true,
      },
      issuer: {
        type: Type.NUMBER,
        description: 'Confidence score for issuer if found else null',
        title: 'Issuer',
        nullable: true,
      },
      ownerName: {
        type: Type.NUMBER,
        description: "Confidence score for owner's name if found else null",
        title: 'Owner Name',
        nullable: true,
      },
      dateOfBirth: {
        type: Type.NUMBER,
        description: 'Confidence score for date of birth if found else null',
        title: 'Date of Birth',
        nullable: true,
      },
      placeOfBirth: {
        type: Type.NUMBER,
        description: 'Confidence score for place of birth if found else null',
        title: 'Place of Birth',
        nullable: true,
      },
      placeOfIssue: {
        type: Type.NUMBER,
        description: 'Confidence score for place of issue if found else null',
        title: 'Place of Issue',
        nullable: true,
      },
      gender: {
        type: Type.NUMBER,
        description: "Confidence score for owner's gender if found else null",
        title: 'Gender',
        nullable: true,
      },
      typeId: {
        type: Type.NUMBER,
        description:
          'Confidence score for document type identifier if found else null',
        title: 'Type ID',
        nullable: true,
      },
      issuanceDate: {
        type: Type.NUMBER,
        description: 'Confidence score for issuance date if found else null',
        title: 'Issuance Date',
        nullable: true,
      },
      expiryDate: {
        type: Type.NUMBER,
        description: 'Confidence score for expiry date if found else null',
        title: 'Expiry Date',
        nullable: true,
      },
      additionalFields: {
        type: Type.ARRAY,
        description:
          'Additional fields found on the document that do not fit standard categories if found else null',
        title: 'Additional Fields',
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            fieldName: {
              type: Type.STRING,
              description: 'Name of the field',
              title: 'Field Name',
              nullable: true,
            },
            nameScore: {
              type: Type.NUMBER,
              description:
                'Confidence score for the field name if found else null',
              title: 'Field Name Score',
              nullable: true,
            },
            fieldValue: {
              type: Type.STRING,
              description: 'Value of the field',
              title: 'Field Value',
              nullable: true,
            },
            valueScore: {
              type: Type.NUMBER,
              description:
                'Confidence score for the field value if found else null',
              title: 'Field Value Score',
              nullable: true,
            },
          },
        },
      },
      securityQuestions: {
        type: Type.ARRAY,
        description:
          'Security questions and answers derived from document content',
        title: 'Security Questions',
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            question: {
              type: Type.STRING,
              title: 'Question',
              description: 'Security question',
              nullable: true,
            },
            questionScore: {
              type: Type.NUMBER,
              description:
                'Confidence score for the question if found else null',
              title: 'Question Score',
              nullable: true,
            },
            answer: {
              type: Type.STRING,
              title: 'Answer',
              description: 'Answer to the question',
              nullable: true,
            },
            answerScore: {
              type: Type.NUMBER,
              description: 'Confidence score for the answer if found else null',
              title: 'Answer Score',
              nullable: true,
            },
          },
        },
      },
    },
  },
};

export const AI_IMAGE_ANALYSIS_CONFIG: GenerateContentConfig = {
  temperature: 0.1,
  responseMimeType: 'application/json', // Critical for structured output
  maxOutputTokens: 2048,
  responseSchema: {
    type: Type.ARRAY,
    description: 'List of image analysis if found else null',
    title: 'Image Analysis',
    nullable: true,
    items: {
      type: Type.OBJECT,
      properties: {
        index: {
          type: Type.NUMBER,
          description: 'Index of the image if found else null',
          title: 'Index',
          nullable: true,
        },
        imageType: {
          type: Type.STRING,
          description: 'Type of the image if found else null',
          title: 'Image Type',
          nullable: true,
        },
        quality: {
          type: Type.NUMBER,
          description: '0-1 score for image quality if found else null',
          title: 'Quality',
          nullable: true,
        },
        readability: {
          type: Type.NUMBER,
          description: '0-1 score for text readability if found else null',
          title: 'Readability',
          nullable: true,
        },
        tamperingDetected: {
          type: Type.BOOLEAN,
          description:
            'true if tampering detected in the image if found else null',
          title: 'Tampering Detected',
          nullable: true,
        },
        warnings: {
          type: Type.ARRAY,
          description: 'List of warnings about the image if found else null',
          title: 'Warnings',
          nullable: true,
          items: {
            type: Type.STRING,
            description: 'Warning about the image if found else null',
            title: 'Warning',
            nullable: true,
          },
        },
      },
    },
  },
};
