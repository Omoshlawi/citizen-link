# ─── Layer 1 — Vector ──────────────────────────────────────────────────────

MATCH_VECTOR_THRESHOLD=0.70

# Minimum cosine similarity for a document to be a candidate

# Lower = more candidates (better recall, more Layer 2/3 work)

# Higher = fewer candidates (less recall, faster pipeline)

# Recommended range: 0.65 - 0.85

MATCH_TOP_N_CANDIDATES=5

# How many top candidates pass from Layer 1 to Layer 2 and 3

# Recommended range: 3 - 10

# ─── Layer 2 — Exact ───────────────────────────────────────────────────────

MATCH_EXACT_THRESHOLD=0.40

# Minimum weighted exact field score to survive Layer 2

# 0.40 allows OCR-affected documents to survive

# Recommended range: 0.35 - 0.60

# ─── Layer 3 — AI ──────────────────────────────────────────────────────────

MATCH_AI_THRESHOLD=0.65

# Minimum AI overallScore (deterministic) to survive Layer 3

# Recommended range: 0.60 - 0.80

# ─── Final score ───────────────────────────────────────────────────────────

MATCH_MIN_FINAL_SCORE=0.75

# Minimum weighted final score to be persisted as a match

# Recommended range: 0.70 - 0.85

MATCH_AUTO_CONFIRM_THRESHOLD=0.95

# Above this finalScore → AUTO_CONFIRMED, no human review needed

# Keep this high — auto-confirmation skips admin review entirely

# Recommended range: 0.93 - 0.98

# ─── Weights — must sum exactly to 1.0 ────────────────────────────────────

MATCH_WEIGHT_VECTOR=0.25
MATCH_WEIGHT_EXACT=0.40
MATCH_WEIGHT_AI=0.35

# ─── Security questions ────────────────────────────────────────────────────

MATCH_MAX_SECURITY_QUESTIONS=4
