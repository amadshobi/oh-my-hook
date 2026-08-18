/**
 * memory/matcher.js — Pure JS BM25 token matcher for dynamic rule retrieval.
 *
 * Implements Okapi BM25 scoring algorithm with zero external dependencies:
 *   score(D, Q) = sum( IDF(q_i) * (TF(q_i, D) * (k1 + 1)) / (TF(q_i, D) + k1 * (1 - b + b * (|D| / avgdl))) )
 */
import { STOPWORDS } from "./stopwords.js";

/**
 * Tokenize input text into filtered, normalized terms.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
	if (!text || typeof text !== "string") return [];
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, " ")
		.split(/\s+/)
		.map((w) => w.trim())
		.filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * Build inverted index and document statistics from a list of rules.
 * @param {object[]} rules Array of rule records
 * @returns {object} { docCount, avgDocLen, docLens: Map<id, number>, inverted: Map<term, Map<id, number>>, rulesMap: Map<id, object> }
 */
export function buildIndex(rules = []) {
	const docLens = new Map();
	const inverted = new Map();
	const rulesMap = new Map();
	let totalTokens = 0;

	for (const rule of rules) {
		if (!rule || !rule.id) continue;
		rulesMap.set(rule.id, rule);

		// Document text combines triggers (weighted x2) + content + rationale
		const triggerText = Array.isArray(rule.triggers)
			? rule.triggers.join(" ") + " " + rule.triggers.join(" ")
			: "";
		const fullText = `${triggerText} ${rule.content || ""} ${rule.rationale || ""}`;
		const tokens = tokenize(fullText);

		docLens.set(rule.id, tokens.length);
		totalTokens += tokens.length;

		// Calculate term frequencies in this doc
		for (const token of tokens) {
			if (!inverted.has(token)) {
				inverted.set(token, new Map());
			}
			const postings = inverted.get(token);
			postings.set(rule.id, (postings.get(rule.id) || 0) + 1);
		}
	}

	const docCount = rulesMap.size;
	const avgDocLen = docCount > 0 ? totalTokens / docCount : 1;

	return {
		docCount,
		avgDocLen,
		docLens,
		inverted,
		rulesMap,
	};
}

/**
 * Calculate Okapi BM25 score for a query against indexed rules.
 * @param {string} query
 * @param {object[]} rules
 * @param {object} [opts]
 * @param {number} [opts.k1=1.2] Term frequency saturation parameter
 * @param {number} [opts.b=0.75] Length normalization parameter
 * @param {number} [opts.minScore=0.3] Minimum score threshold
 * @param {number} [opts.boostProject=1.3] Multiplier for project_skill
 * @param {number} [opts.boostPrefs=1.2] Multiplier for preference
 * @returns {Array<{ rule: object, score: number }>} Sorted by score descending
 */
export function scoreAll(query, rules = [], opts = {}) {
	const {
		k1 = 1.2,
		b = 0.75,
		minScore = 0.3,
		boostProject = 1.3,
		boostPrefs = 1.2,
	} = opts;

	if (!query || typeof query !== "string" || rules.length === 0) {
		return [];
	}

	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return [];

	const index = buildIndex(rules);
	const { docCount, avgDocLen, docLens, inverted, rulesMap } = index;

	if (docCount === 0) return [];

	const scores = new Map();

	for (const qToken of queryTokens) {
		const postings = inverted.get(qToken);
		if (!postings) continue;

		const n = postings.size; // number of docs containing qToken
		// Robertson-Spärck Jones IDF formula
		const idf = Math.log((docCount - n + 0.5) / (n + 0.5) + 1);

		for (const [docId, tf] of postings.entries()) {
			const docLen = docLens.get(docId) || 1;
			const numerator = tf * (k1 + 1);
			const denominator = tf + k1 * (1 - b + b * (docLen / avgDocLen));
			const termScore = idf * (numerator / denominator);

			scores.set(docId, (scores.get(docId) || 0) + termScore);
		}
	}

	const results = [];
	for (const [docId, rawScore] of scores.entries()) {
		const rule = rulesMap.get(docId);
		if (!rule || rule.status !== "active") continue;

		let multiplier = 1.0;
		if (rule.category === "project_skill") multiplier = boostProject;
		else if (rule.category === "preference") multiplier = boostPrefs;

		// Factor in rule confidence
		const confidence = Number.isFinite(rule.confidence) ? rule.confidence : 0.5;
		const finalScore = rawScore * multiplier * (0.5 + 0.5 * confidence);

		if (finalScore >= minScore) {
			results.push({
				rule,
				score: Number(finalScore.toFixed(3)),
			});
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results;
}
