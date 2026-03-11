/**
 * MCP Gateway — Types Unit Tests
 *
 * Tests tool classification and category mapping.
 */

import { describe, it, expect } from "vitest";
import { classifyTool, DEFAULT_TOOL_CATEGORIES } from "../../mcp-gateway/src/types.js";

describe("classifyTool", () => {
  it("classifies filesystem tools", () => {
    expect(classifyTool("read_file")).toBe("filesystem");
    expect(classifyTool("write_file")).toBe("filesystem");
    expect(classifyTool("list_directory")).toBe("filesystem");
    expect(classifyTool("create_directory")).toBe("filesystem");
    expect(classifyTool("search_files")).toBe("filesystem");
  });

  it("classifies shell tools", () => {
    expect(classifyTool("execute_command")).toBe("shell");
    expect(classifyTool("run_command")).toBe("shell");
  });

  it("classifies web tools", () => {
    expect(classifyTool("brave_web_search")).toBe("web");
    expect(classifyTool("fetch")).toBe("web");
  });

  it("classifies browser tools", () => {
    expect(classifyTool("puppeteer_navigate")).toBe("browser");
    expect(classifyTool("puppeteer_screenshot")).toBe("browser");
    expect(classifyTool("puppeteer_click")).toBe("browser");
  });

  it("classifies database tools", () => {
    expect(classifyTool("query")).toBe("database");
    expect(classifyTool("read_query")).toBe("database");
    expect(classifyTool("list_tables")).toBe("database");
  });

  it("classifies git tools", () => {
    expect(classifyTool("create_repository")).toBe("git");
    expect(classifyTool("create_pull_request")).toBe("git");
    expect(classifyTool("fork_repository")).toBe("git");
    expect(classifyTool("push_files")).toBe("git");
    expect(classifyTool("search_repositories")).toBe("git");
  });

  it("classifies GitHub MCP server tools", () => {
    expect(classifyTool("get_file_contents")).toBe("git");
    expect(classifyTool("create_or_update_file")).toBe("git");
    expect(classifyTool("create_branch")).toBe("git");
    expect(classifyTool("list_issues")).toBe("git");
    expect(classifyTool("update_issue")).toBe("git");
    expect(classifyTool("add_issue_comment")).toBe("git");
    expect(classifyTool("search_code")).toBe("git");
    expect(classifyTool("search_issues")).toBe("git");
    expect(classifyTool("list_commits")).toBe("git");
    expect(classifyTool("get_issue")).toBe("git");
    expect(classifyTool("get_pull_request")).toBe("git");
    expect(classifyTool("list_pull_requests")).toBe("git");
    expect(classifyTool("merge_pull_request")).toBe("git");
    expect(classifyTool("create_pull_request_review")).toBe("git");
    expect(classifyTool("get_pull_request_files")).toBe("git");
    expect(classifyTool("get_pull_request_status")).toBe("git");
    expect(classifyTool("update_pull_request_branch")).toBe("git");
    expect(classifyTool("get_pull_request_comments")).toBe("git");
    expect(classifyTool("get_pull_request_reviews")).toBe("git");
    expect(classifyTool("search_users")).toBe("git");
  });

  it("classifies messaging tools", () => {
    expect(classifyTool("send_message")).toBe("messaging");
    expect(classifyTool("slack_post_message")).toBe("messaging");
  });

  it("returns 'other' for unknown tools", () => {
    expect(classifyTool("unknown_tool")).toBe("other");
    expect(classifyTool("custom_action")).toBe("other");
  });

  it("all mapped categories are valid strings", () => {
    const validCategories = new Set([
      "filesystem", "shell", "web", "browser", "database", "git", "messaging",
    ]);
    for (const [tool, category] of Object.entries(DEFAULT_TOOL_CATEGORIES)) {
      expect(validCategories.has(category!), `${tool} → ${category}`).toBe(true);
    }
  });
});
