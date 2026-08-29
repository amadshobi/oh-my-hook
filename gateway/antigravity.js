/**
 * gateway/antigravity.js — Google Cloud Code Assist (CCA) / Antigravity Schema Sanitizer.
 *
 * Google Antigravity endpoints reject OpenAPI keywords like `$schema`, `title`,
 * `additionalProperties: false`, `patternProperties`, and complex combiners,
 * causing HTTP 400 Malformed Argument errors. This module cleans them in-flight.
 */

const CCA_STRIP_KEYWORDS = new Set([
	"$schema",
	"$id",
	"title",
	"patternProperties",
	"propertyNames",
	"minProperties",
	"maxProperties",
	"additionalProperties",
]);

/**
 * Recursively sanitize and normalize JSON Schema for Google CCA / Antigravity compatibility.
 * Always returns a new object (immutable).
 *
 * @param {any} schema
 * @returns {any}
 */
export function normalizeSchemaForCCA(schema) {
	if (!schema || typeof schema !== "object") {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map(normalizeSchemaForCCA);
	}

	const cleaned = {};

	for (const [key, value] of Object.entries(schema)) {
		// Strip forbidden keywords
		if (CCA_STRIP_KEYWORDS.has(key)) {
			continue;
		}

		// Recursively clean properties, definitions and defs
		if (
			(key === "properties" || key === "$defs" || key === "definitions") &&
			value &&
			typeof value === "object"
		) {
			const cleanedDict = {};
			for (const [subKey, subVal] of Object.entries(value)) {
				cleanedDict[subKey] = normalizeSchemaForCCA(subVal);
			}
			cleaned[key] = cleanedDict;
			continue;
		}

		// Recursively clean items, additionalItems
		if ((key === "items" || key === "additionalItems") && value) {
			cleaned[key] = normalizeSchemaForCCA(value);
			continue;
		}

		// Clean schema combiners (anyOf, oneOf, allOf)
		if (key === "anyOf" || key === "oneOf" || key === "allOf") {
			if (Array.isArray(value)) {
				cleaned[key] = value.map(normalizeSchemaForCCA);
			}
			continue;
		}

		// Clean conditional sub-schemas (if, then, else, not)
		if (
			(key === "if" || key === "then" || key === "else" || key === "not") &&
			value &&
			typeof value === "object"
		) {
			cleaned[key] = normalizeSchemaForCCA(value);
			continue;
		}

		cleaned[key] = value;
	}

	// Ensure object types have properties defined
	if (cleaned.type === "object" && !cleaned.properties) {
		cleaned.properties = {};
	}

	return cleaned;
}
