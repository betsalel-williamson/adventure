// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import { shellClickShouldSkipFocus } from "./shellClickFocus.js";

describe("shellClickShouldSkipFocus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("skips when clicking the command input", () => {
    document.body.innerHTML = `<input id="command-input" />`;
    const input = document.querySelector("#command-input")!;
    expect(shellClickShouldSkipFocus(input)).toBe(true);
  });

  it("does not skip when clicking the prompt glyph (closest does not traverse into children)", () => {
    document.body.innerHTML = `
      <div id="crt-command-line"><span class="crt-prompt">&gt;</span><input id="command-input" /></div>`;
    const promptGlyph = document.querySelector(".crt-prompt")!;
    expect(shellClickShouldSkipFocus(promptGlyph)).toBe(false);
  });

  it("does not skip when clicking CRT chrome without nested controls", () => {
    document.body.innerHTML = `
      <div id="crt-viewport"><pre id="crt-transcript"></pre><span class="x">game</span></div>
      <input id="command-input" />
    `;
    const span = document.querySelector(".x")!;
    expect(shellClickShouldSkipFocus(span)).toBe(false);
  });

  it("skips link clicks", () => {
    document.body.innerHTML = `<a href="/help">help</a>`;
    expect(shellClickShouldSkipFocus(document.querySelector("a")!)).toBe(true);
  });

  it("skips button clicks", () => {
    document.body.innerHTML = `<button type="button">x</button>`;
    expect(shellClickShouldSkipFocus(document.querySelector("button")!)).toBe(true);
  });

  it("skips details summary clicks", () => {
    document.body.innerHTML = `<details><summary>Panels</summary></details>`;
    expect(shellClickShouldSkipFocus(document.querySelector("summary")!)).toBe(true);
  });

  it("does not skip disabled buttons (selector uses :not([disabled]))", () => {
    document.body.innerHTML = `<button type="button" disabled>x</button>`;
    const btn = document.querySelector("button")!;
    expect(shellClickShouldSkipFocus(btn)).toBe(false);
  });

  it("skips other inputs", () => {
    document.body.innerHTML = `<input id="other" type="checkbox" /><input id="command-input" />`;
    expect(shellClickShouldSkipFocus(document.querySelector("#other")!)).toBe(true);
  });

  it("skips textarea and role=button", () => {
    document.body.innerHTML = `<textarea></textarea><span role="button">go</span>`;
    expect(shellClickShouldSkipFocus(document.querySelector("textarea")!)).toBe(true);
    expect(shellClickShouldSkipFocus(document.querySelector('[role="button"]')!)).toBe(true);
  });

  it("skips contenteditable", () => {
    document.body.innerHTML = `<div contenteditable="true">edit</div>`;
    expect(shellClickShouldSkipFocus(document.querySelector("div")!)).toBe(true);
  });
});
