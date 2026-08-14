import { test } from "node:test";
import assert from "node:assert/strict";
import { toolPolicyHooks } from "../guard/tool-policy.js";

async function makeHooks(opts = {}) {
  const hooks = await toolPolicyHooks({ client: null }, opts);
  return hooks["tool.execute.before"];
}

test("string policy 'deny' blocks tool execution", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        rm: "deny",
        delete_file: "deny",
      },
    },
  });

  await assert.rejects(
    () => before({ tool: "rm", args: { filePath: "/tmp/file.txt" } }),
    /Tool Diblokir/
  );

  await assert.rejects(
    () => before({ tool: "delete_file", args: {} }),
    (err) => {
      assert.match(err.message, /Tool 'delete_file' diblokir oleh kebijakan guardrail/);
      assert.match(err.message, /kebijakan: deny/);
      return true;
    }
  );
});

test("string policy 'allow' permits tool execution", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        read: "allow",
        write: "allow",
      },
    },
  });

  await assert.doesNotReject(
    () => before({ tool: "read", args: { filePath: "/tmp/file.txt" } })
  );

  await assert.doesNotReject(
    () => before({ tool: "write", args: { filePath: "/tmp/file.txt", content: "hello" } })
  );
});

test("'readonly' policy blocks mutating tools (edit, write, delete) but allows read", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        edit: "readonly",
        write: "readonly",
        delete: "readonly",
        read: "readonly",
        glob: "readonly",
      },
    },
  });

  await assert.rejects(
    () => before({ tool: "edit", args: { filePath: "/tmp/file.txt", newString: "bar" } }),
    /kebijakan: readonly/
  );

  await assert.rejects(
    () => before({ tool: "write", args: { filePath: "/tmp/file.txt", content: "bar" } }),
    /kebijakan: readonly/
  );

  await assert.rejects(
    () => before({ tool: "delete", args: { filePath: "/tmp/file.txt" } }),
    /kebijakan: readonly/
  );

  await assert.doesNotReject(
    () => before({ tool: "read", args: { filePath: "/tmp/file.txt" } })
  );

  await assert.doesNotReject(
    () => before({ tool: "glob", args: { pattern: "*.js" } })
  );
});

test("wildcard pattern matching (e.g. 'mcp:github:*')", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        "mcp:github:*": "deny",
        "mcp:slack:read_*": "allow",
        "mcp:slack:*": "deny",
      },
    },
  });

  // mcp:github:* should block any subtool
  await assert.rejects(
    () => before({ tool: "mcp:github:create_issue", args: {} }),
    /Tool 'mcp:github:create_issue' diblokir/
  );

  await assert.rejects(
    () => before({ tool: "mcp:github:delete_repo", args: {} }),
    /Tool 'mcp:github:delete_repo' diblokir/
  );

  // mcp:slack:read_messages should be allowed by specific pattern
  await assert.doesNotReject(
    () => before({ tool: "mcp:slack:read_messages", args: {} })
  );

  // other mcp:slack tools should be blocked by fallback wildcard
  await assert.rejects(
    () => before({ tool: "mcp:slack:post_message", args: {} }),
    /Tool 'mcp:slack:post_message' diblokir/
  );
});

test("denyPatterns in object policy (e.g. matching bash commands)", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        bash: {
          policy: "allow",
          denyPatterns: ["npm\\s+publish", "git\\s+push.*--force"],
          reason: "Publishing and force pushing are restricted",
        },
      },
    },
  });

  // Matching denyPatterns should block
  await assert.rejects(
    () => before({ tool: "bash", args: { command: "npm publish --access public" } }),
    (err) => {
      assert.match(err.message, /Publishing and force pushing are restricted/);
      return true;
    }
  );

  await assert.rejects(
    () => before({ tool: "bash", args: { command: "git push origin main --force" } }),
    /Publishing and force pushing are restricted/
  );

  // Non-matching commands should pass
  await assert.doesNotReject(
    () => before({ tool: "bash", args: { command: "npm test" } })
  );

  await assert.doesNotReject(
    () => before({ tool: "bash", args: { command: "git status" } })
  );
});

test("object policy with policy: 'deny'", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        destructive_tool: {
          policy: "deny",
          reason: "Destructive actions disabled in this environment",
        },
      },
    },
  });

  await assert.rejects(
    () => before({ tool: "destructive_tool", args: {} }),
    /Destructive actions disabled in this environment/
  );
});

test("default unconfigured tools pass through", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        restricted_tool: "deny",
      },
    },
  });

  await assert.doesNotReject(
    () => before({ tool: "unconfigured_tool", args: {} })
  );

  await assert.doesNotReject(
    () => before({ tool: "bash", args: { command: "ls -la" } })
  );
});

test("supports reading tools from opts.tools or opts.config.guard.tools", async () => {
  const beforeFromOptsTools = await makeHooks({
    tools: {
      blocked_direct: "deny",
    },
  });

  await assert.rejects(
    () => beforeFromOptsTools({ tool: "blocked_direct", args: {} }),
    /kebijakan: deny/
  );

  const beforeFromGuard = await makeHooks({
    config: {
      guard: {
        tools: {
          blocked_guard: "deny",
        },
      },
    },
  });

  await assert.rejects(
    () => beforeFromGuard({ tool: "blocked_guard", args: {} }),
    /kebijakan: deny/
  );
});

test("supports global catch-all wildcard '*'", async () => {
  const before = await makeHooks({
    config: {
      tools: {
        read: "allow",
        "*": "deny",
      },
    },
  });

  await assert.doesNotReject(
    () => before({ tool: "read", args: {} })
  );

  await assert.rejects(
    () => before({ tool: "random_tool", args: {} }),
    /kebijakan: deny/
  );
});
