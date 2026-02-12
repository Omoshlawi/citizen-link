# AI Requirements

### System Requirements

- Identify document type
- Extract field
- Normalize + Structure into guided JSON

### Architecture

#### Extract first, then structured reasoning (best balance)

- The vision model takes image as input and extracts OCR + layout
- For extraction, vision should be a preprocessing step — not the reasoning engine.
- The text only llm takes the output of vision as input to process and structure hnce ceperating roles as follows
  - LLM:
    - Reason
    - Normalize
    - Structure
    - Validate
  - Vision:
    - See
    - Read
    - Locate

#### 1. Vision Extraction (FOUNDATION STEP- just seeing,accurate reading + layout)

---

Purpose

- Transform images or PDFs into a canonical OCR + layout representation with no semantic interpretation.

Goal:

1. read all visible text
2. Preserve layout
3. Assign confidence
4. Is LLM Friendly
5. Is reusable for many downstream tasks

Avoid:

1. Classification
2. Interpretation
3. Structuring business logic / No JSON nomalization
4. Reasoning

##### a) What Vision extraction must output

- Should be machine friendly not "Human readable"
- Must ALWAYS be same structure regardles of document type(document agnostic)

1. Text blocks
2. Bounding boxes
3. OCR Confidence
4. Page grouping
5. Metadata

**Canonical output contract**

```json
{
  "meta": {
    "sourceType": "image|pdf",
    "pageCount": number,
    "languageHints": ["en", "sw"],
    "engine": "vision-llm|ocr-engine"
  },

  "pages": [
    {
      "pageNumber": number,
      "width": number,
      "height": number,

      "blocks": [
        {
          "id": "b1",
          "type": "text|stamp|signature|photo|logo|seal|watermark",
          "text": "string",
          "confidence": 0.0,
          "bbox": [0.0, 0.0, 1.0, 1.0]
        }
      ]
    }
  ],

  "fullText": "string",
  "averageConfidence": 0.0
}
```

**Cannonical Output shape**

```json
{
  "meta": {
    "sourceType": "image|pdf",
    "pageCount": 1,
    "languageHints": ["en", "sw"],
    "engine": "vision-llm|ocr-engine"
  },
  "pages": [
    {
      "pageNumber": 1,
      "width": 2480,
      "height": 3508,
      "blocks": [
        {
          "id": "b1",
          "type": "text",
          "text": "REPUBLIC OF KENYA",
          "confidence": 98,
          "bbox": [0.12, 0.05, 0.84, 0.11]
        },
        {
          "id": "b2",
          "text": "ID NUMBER 34567890",
          "confidence": 95,
          "bbox": [0.1, 0.3, 0.55, 0.36],
          "type": "text"
        }
      ]
    }
  ],
  "fullText": "REPUBLIC OF KENYA\nID NUMBER 34567890\n...",
  "averageConfidence": 0.91
}
```

💡 Everything downstream depends on this being clean.

**Why this shape?**

- `bbox` is normalized (0–1) → resolution independent
- `blocks` are atomic → reusable downstream
- `confidence` allows filtering + scoring (percentage)
- `type` helps ignore logos / stamps later

##### b) What NOT to do in Step 1

Do NOT:

- Guess document type
- Normalize dates
- Combine blocks
- Extract fields (name, DOB, etc.)
- Output JSON for application use

Step 1 is raw perception only.

##### c) How to perform Vision Extraction - LLM Based

- We use multimodal here but in restricted role
- Use multimodal LLM ONLY to:
  - Read text
  - Detect layout blocks
  - Assign Confidence
- Inputs:
  - Images
  - No prior assumptions
- Output
  - OCR Like strcture data + layout

##### d) Block Design

- Each block must include
  - `id` - tracebility
  - `text` - Actual ocr
  - `confidence` - Quality gates (Percentage)
  - `bbox` - Spatial Reasoning later (Nomalized coordinates: `[x_min, y_min, x_max, y_max] ∈ [0,1]` - Survives resizing)
  - `type` - text | stamp | signature | photo | logo | seal | watermark

##### e) Confidence handling(non-ngotiable)

- Block confidence
  - Directly from vision model OR
  - Estimates(text clarity,length,OCR Certainity)
- page confidnce
  - `avg(block.confidence)`
- Document Confidence
  - `avg(page.confidence)`

##### f) Filtering rules

- At this stage:
  - Do NOT drop low-confidence blocks
  - Do NOT merge blocks aggressively
- Instead:
  - Keep everything
  - Let Step 2 decide what to trust

##### g) Storage

- persist vision output as is to be reused in
  - classification
  - extraction
  - dispute resolution
  - audits

##### h) Vision Extraction prompt design principles

- The prompt must enforce:
  - Exhaustiveness
  - Neutrality
  - Strict JSON
  - No hallucination
- Key rules
  - “Read exactly what you see”
  - “Preserve casing”
  - “Preserve line breaks”
  - “Do not correct spelling”
  - “Do not infer missing text”

#### 2. Text-Only Extraction, Classification & Structuring

---

**Goal**

Take the **canonical vision output** from Step 1 and:

1. Identify document type
2. Extract relevant fields
3. Normalize values
4. Structure into strict, application-ready JSON
5. Compute confidence scores
6. Emit warnings instead of guessing

**No vision here. Text only.**

##### a) Inputs to Step 2 (very important)

- Input contract (from Step 1)
  You pass **only** this:

```json
{
  "meta": { ... },
  "pages": [ ... ],
  "fullText": "...",
  "averageConfidence": 0.91
}
```

- Do NOT pass the image
- Do NOT pass user assumptions
- Do NOT pass extracted guesses

The LLM reasons **only** from OCR output.


##### b) Responsibilities split (locked in)

- Text-only LLM is responsible for:
  - Document type identification
  - Field extraction
  - Normalization
  - Structuring
  - Validation
  - Confidence computation

- It is NOT allowed to:
  - Invent missing data
  - Use world knowledge beyond text
  - Assume document type from context
  - Correct spelling
  - Re-OCR text


##### c) Canonical structured output (unchanged forever)

This is the **same schema you will use globally**.

```json
{
  "documentType": {
    "code": "KE_NATIONAL_ID",
    "confidence": 0.0
  },
  "country": "KE",
  "person": {
    "fullName": null,
    "givenNames": [],
    "surname": null,
    "dateOfBirth": null,
    "gender": null
  },
  "document": {
    "number": null,
    "serialNumber": null,
    "issueDate": null,
    "expiryDate": null
  },
  "address": {
    "raw": null,
    "county": null,
    "constituency": null,
    "ward": null
  },
  "biometrics": {
    "photoPresent": false,
    "fingerprintPresent": false,
    "signaturePresent": false
  },
  "raw": {
    "blocksUsed": []
  },
  "quality": {
    "ocrConfidence": 0.0,
    "extractionConfidence": 0.0,
    "warnings": []
  }
}
```

⚠️ Missing data → `null`
⚠️ Arrays default to empty

---

## 4️⃣ Document type classification (text-only)

### Allowed document types (Phase 1 – Kenya)

```text
KE_NATIONAL_ID
KE_PASSPORT
KE_BIRTH_CERT
KE_POLICE_ABSTRACT
KE_STUDENT_ID
KE_NHIF
UNKNOWN
```

### Classification rules

- Match **keywords**
- Match **field patterns**
- Match **layout hints (via block order)**

❌ No guessing
❌ If uncertain → `UNKNOWN`

---

## 5️⃣ Field extraction rules (strict)

### Extraction rules

- Use **only OCR text**
- Extract values exactly as written
- Normalize formats, not meaning
- Never merge conflicting values
- Track source blocks

### Examples

| Field     | Rule                       |
| --------- | -------------------------- |
| Names     | Uppercase, split on spaces |
| Dates     | Convert to ISO 8601        |
| ID number | Regex validated            |
| Gender    | M / F only                 |

---

## 6️⃣ Raw traceability (non-negotiable)

Every extracted field must record **which blocks were used**.

```json
"raw": {
  "blocksUsed": ["b2", "b7", "b11"]
}
```

This gives you:

- explainability
- auditability
- dispute resolution

---

## 7️⃣ Confidence scoring (deterministic, not vibes)

### a) OCR confidence

Directly from Step 1:

```text
ocrConfidence = vision.averageConfidence
```

---

### b) Document type confidence

```text
docTypeConfidence =
  (keywordMatchScore * 0.4) +
  (fieldPatternScore * 0.3) +
  (layoutConsistencyScore * 0.3)
```

---

### c) Extraction confidence

```text
extractionConfidence =
  avg(fieldConfidence) * ocrConfidence
```

Each field confidence is based on:

- source block confidence
- regex validity
- uniqueness (no conflicts)

---

## 8️⃣ Warning system (instead of hallucination)

Warnings replace guessing.

Examples:

```json
"warnings": [
  "MULTIPLE_DOB_VALUES_FOUND",
  "LOW_OCR_CONFIDENCE",
  "DOCUMENT_TYPE_UNCERTAIN"
]
```

---

## 9️⃣ Fallback trigger (hand-off to multimodal)

Trigger **multimodal rescue** only if:

- `extractionConfidence < 0.7`
- Document type is `UNKNOWN`
- Critical field conflicts exist
- OCR confidence < 0.75

Otherwise, **never invoke vision again**.

---

# 10️⃣ Step 2 Prompt Template (`.hbs`)

### 📄 `text-extraction.hbs`

```hbs
You are a document understanding engine.

Your task is to analyze OCR output and extract structured identity information.
You MUST use only the provided OCR data.
You MUST NOT infer or guess missing values.

Input OCR data:
<<<{{vision_output}}>>>

Allowed document types:
- KE_NATIONAL_ID
- KE_PASSPORT
- KE_BIRTH_CERT
- KE_POLICE_ABSTRACT
- KE_STUDENT_ID
- KE_NHIF
- UNKNOWN

Rules:
- Missing fields → null
- Names → uppercase
- Dates → ISO 8601 (YYYY-MM-DD)
- Do not correct spelling
- Do not assume context
- If uncertain, add a warning

Return ONLY valid JSON matching the schema below.

Schema:
{
  "documentType": {
    "code": string,
    "confidence": number
  },
  "country": "KE",
  "person": {
    "fullName": string | null,
    "givenNames": string[],
    "surname": string | null,
    "dateOfBirth": string | null,
    "gender": string | null
  },
  "document": {
    "number": string | null,
    "serialNumber": string | null,
    "issueDate": string | null,
    "expiryDate": string | null
  },
  "address": {
    "raw": string | null,
    "county": string | null,
    "constituency": string | null,
    "ward": string | null
  },
  "biometrics": {
    "photoPresent": boolean,
    "fingerprintPresent": boolean,
    "signaturePresent": boolean
  },
  "raw": {
    "blocksUsed": string[]
  },
  "quality": {
    "ocrConfidence": number,
    "extractionConfidence": number,
    "warnings": string[]
  }
}

Important:
- Output must be valid JSON
- Do not include markdown
- Do not include explanations
```

---

## ✅ Step 2 acceptance checklist

Before moving on:

✔️ Text-only LLM works without images
✔️ Missing fields are null
✔️ Confidence is computed, not guessed
✔️ Warnings appear instead of hallucination
✔️ Schema never changes

---

## Next step (when you’re ready)

👉 **STEP 3: Kenyan-specific validators & regex rules**
(ID numbers, dates, names, counties)

Or
👉 **STEP 4: Lost–Found document matching logic**

Just tell me where you want to go next.
