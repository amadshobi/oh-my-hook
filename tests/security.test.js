import { test } from "node:test";
import assert from "node:assert/strict";
import { securityHooks } from "../guard/security.js";

async function makeHooks(opts = {}) {
  const hooks = await securityHooks({ client: null }, { config: opts });
  return hooks["tool.execute.before"];
}

test("blocks write when content contains a GitHub token", async () => {
  const before = await makeHooks();
  const input = {
    tool: "write",
    args: {
      filePath: "/tmp/foo.js",
      content: `const token = "ghp_${"abcdefghijklmnopqrstuvwxyz1234567890ABCD"}";\n`,
    },
  };

  await assert.rejects(
    () => before(input, {}),
    /Secret Terdeteksi/
  );
});

test("blocks edit when newString contains an AWS access key", async () => {
  const before = await makeHooks();
  const input = {
    tool: "edit",
    args: {
      filePath: "/tmp/foo.js",
      newString: "AKIA" + "IOSFODNN7EXAMPLE",
    },
  };

  await assert.rejects(
    () => before(input, {}),
    /Secret Terdeteksi/
  );
});

test("allows clean content", async () => {
  const before = await makeHooks();
  const input = {
    tool: "write",
    args: {
      filePath: "/tmp/foo.js",
      content: "const greeting = 'hello';\n",
    },
  };

  await assert.doesNotReject(() => before(input, {}));
});

test("blocks write when content contains an OpenAI API key", async () => {
  const before = await makeHooks();
  const input = {
    tool: "write",
    args: {
      filePath: "/tmp/foo.js",
      content: `const key = "sk-proj-${"abc123456789012345678901234567890"}";\n`,
    },
  };

  await assert.rejects(
    () => before(input, {}),
    /Secret Terdeteksi/
  );
});

test("blocks dangerous force push to main branch", async () => {
  const before = await makeHooks();
  const input = {
    tool: "bash",
    args: {
      command: "git push origin main --force",
    },
  };

  await assert.rejects(
    () => before(input, {}),
    /push/i
  );
});

test("allows normal git push without throwing", async () => {
  const before = await makeHooks();
  const input = {
    tool: "bash",
    args: {
      command: "git push",
    },
  };

  await assert.doesNotReject(() => before(input, {}));
});
