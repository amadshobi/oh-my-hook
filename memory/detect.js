/**
 * memory/detect.js — heuristic correction and success signal classifier.
 *
 * Scans incoming user messages for patterns that indicate:
 *   - Direct corrections ("bukan gitu", "salah, harusnya X", "don't use npm")
 *   - Explicit prohibitions ("jangan pernah sentuh folder dist")
 *   - Success confirmations ("bagus, mantap, thanks")
 */

export const CORRECTION_PATTERNS = [
	// Explicit prohibitions (Indonesian)
	{
		re: /\b(jangan|jgn|gak usah|nggak usah|stop|hindari|skip|drop)\s+(pakai|pake|gunakan|tulis|buat|deploy|install|jalankan|run|make|use)\b/i,
		confidence: 0.85,
		label: "prohibition_id",
	},
	// Explicit prohibitions (English)
	{
		re: /\b(don'?t|never|stop|avoid|no need to)\s+(use|run|write|install|deploy|call|put)\b/i,
		confidence: 0.85,
		label: "prohibition_en",
	},
	// Direct corrections (Indonesian)
	{
		re: /\b(bukan|bkn|salah|keliru|yang benar|harusnya|seharusnya|mestinya)\b/i,
		confidence: 0.75,
		label: "correction_id",
	},
	// Direct corrections (English)
	{
		re: /\b(that'?s wrong|not like that|wrong|incorrect|actually|instead|it should be)\b/i,
		confidence: 0.75,
		label: "correction_en",
	},
	// Styling / preference statement
	{
		re: /\b(pakai|pake|gunakan|tulis|buat|jadikan|selalu|always)\s+(saja|aja|langsung|every time|mulai sekarang)\b/i,
		confidence: 0.65,
		label: "preference_statement",
	},
];

export const SUCCESS_PATTERNS = [
	{
		re: /\b(bagus|mantap|sip|oke sip|nice|good|great|perfect|exactly|bener|betul|terima kasih|makasih|thanks|good job|well done|pas banget)\b/i,
		confidence: 0.6,
		label: "success_confirmation",
	},
];

/**
 * Analyze a user text message for learning signals.
 * @param {string} text
 * @returns {{ kind: "correction" | "success" | null, confidence: number, label?: string, excerpt: string }}
 */
export function analyzeUserMessage(text) {
	if (!text || typeof text !== "string") {
		return { kind: null, confidence: 0, excerpt: "" };
	}

	const trimmed = text.trim();

	// Guardrails: ignore if too long (> 200 chars) or contains web URLs (often copy-pasted docs)
	if (
		trimmed.length > 200 ||
		trimmed.includes("http://") ||
		trimmed.includes("https://")
	) {
		return { kind: null, confidence: 0, excerpt: "" };
	}

	// 1. Check correction patterns first (higher priority)
	for (const pattern of CORRECTION_PATTERNS) {
		if (pattern.re.test(trimmed)) {
			return {
				kind: "correction",
				confidence: pattern.confidence,
				label: pattern.label,
				excerpt: trimmed.slice(0, 120),
			};
		}
	}

	// 2. Check success patterns
	for (const pattern of SUCCESS_PATTERNS) {
		if (pattern.re.test(trimmed)) {
			return {
				kind: "success",
				confidence: pattern.confidence,
				label: pattern.label,
				excerpt: trimmed.slice(0, 120),
			};
		}
	}

	return { kind: null, confidence: 0, excerpt: "" };
}

/**
 * Check if the signal passes confidence threshold to enqueue a distill job.
 * @param {{ kind: string|null, confidence: number }} signal
 * @param {number} [minConfidence=0.6]
 * @returns {boolean}
 */
export function shouldQueue(signal, minConfidence = 0.6) {
	return Boolean(
		signal &&
			signal.kind === "correction" &&
			signal.confidence >= minConfidence,
	);
}
