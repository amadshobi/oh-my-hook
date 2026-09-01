import test from "node:test";
import assert from "node:assert/strict";
import { detectPlanIntent, detectExecuteIntent } from "../plans/index.js";

test("detectPlanIntent: explicit triggers activate plan mode", () => {
	const explicit = [
		"masuk mode plan",
		"switch to plan mode",
		"ke mode planning",
		"enter plan mode",
		"start design mode",
		"pindah ke plan mode",
		"ganti ke design mode",
		"masuk ke mode plan",
	];
	for (const text of explicit) {
		assert.equal(
			detectPlanIntent(text),
			true,
			`expected plan intent for: "${text}"`,
		);
	}
});

test("detectPlanIntent: conversational phrases are NOT plan triggers", () => {
	const conversational = [
		"coba kita bahas dulu arsitekturnya",
		"mikir dulu arsitekturnya ya",
		"jangan edit file A, tapi edit file B",
		"cuma mau bahas konsepnya dulu",
		"analisis dulu sebelum gas",
		"rancang dulu desainnya",
		"kita diskusi dulu ya",
		"jangan langsung coding dulu",
	];
	for (const text of conversational) {
		assert.equal(
			detectPlanIntent(text),
			false,
			`expected NO plan intent for: "${text}"`,
		);
	}
});

test("detectPlanIntent: reject non-string / empty input", () => {
	assert.equal(detectPlanIntent(""), false);
	assert.equal(detectPlanIntent(null), false);
	assert.equal(detectPlanIntent(undefined), false);
	assert.equal(detectPlanIntent(123), false);
	assert.equal(detectPlanIntent({}), false);
});

test("detectExecuteIntent: explicit triggers activate execute mode", () => {
	const explicit = [
		"plan approved, gasken",
		"gasken bikin kodenya sekarang",
		"gas blin, eksekusi",
		"masuk mode execute",
		"proceed with the plan",
		"go ahead",
		"eksekusi sekarang kodenya",
	];
	for (const text of explicit) {
		assert.equal(
			detectExecuteIntent(text),
			true,
			`expected execute intent for: "${text}"`,
		);
	}
});

test("detectExecuteIntent: conversational usage does not trigger", () => {
	const conversational = [
		"kita gas dulu mikirnya",
		"gimana kalau gass?",
		"apakah sudah approved?",
		"cuma mau tanya soal approve",
	];
	for (const text of conversational) {
		assert.equal(
			detectExecuteIntent(text),
			false,
			`expected NO execute intent for: "${text}"`,
		);
	}
});

test("detectExecuteIntent: reject non-string / empty input", () => {
	assert.equal(detectExecuteIntent(""), false);
	assert.equal(detectExecuteIntent(null), false);
	assert.equal(detectExecuteIntent(undefined), false);
	assert.equal(detectExecuteIntent(123), false);
	assert.equal(detectExecuteIntent({}), false);
});
