import { expect, test } from "bun:test";
import { locate } from "../src/anchoring";

test("rendered text locates links and whole character references in Markdown (F6)", () => {
  for (const [body, query, exact] of [
    ["Tom &amp; Jerry", "Tom & Jerry", "Tom &amp; Jerry"],
    ["Read [this paper](https://example.com) today.", "Read this paper today.", "Read [this paper](https://example.com) today."],
    ["A copyright &copy;", "A copyright ©", "A copyright &copy;"],
    ["Meet &#x1F600;", "Meet 😀", "Meet &#x1F600;"],
    ["One&nbsp;two", "One two", "One&nbsp;two"],
  ] as const) {
    expect(locate(body, query)).toEqual({ start: 0, end: exact.length });
  }
});

test("raw source quotes still locate old data, including image alt text and link destinations (F6)", () => {
  const body = "![a caption](images/figure.png) and [paper](https://example.com).";
  for (const query of ["a caption", "images/figure.png", "https://example.com", body]) {
    expect(locate(body, query)).toEqual({ start: body.indexOf(query), end: body.indexOf(query) + query.length });
  }
});

test("a copied code passage keeps its punctuation when whitespace differs (F6)", () => {
  const exact = "items[0] = first_value;\nitems[1] = second_value;";
  const body = `Code:\n\n\`\`\`js\n${exact}\n\`\`\`\n`;
  expect(locate(body, exact.replace("\n", " "))).toEqual({ start: body.indexOf(exact), end: body.indexOf(exact) + exact.length });
});

test("a formula's placeholder cannot make a different formula match (F6)", () => {
  const body = "Result $$x + y$$ follows.\n\nResult $$x - y$$ follows.";
  expect(locate(body, "Result $$x-y$$ follows.")).toEqual({ start: body.lastIndexOf("Result"), end: body.length });
  expect(locate(body, "Result $$x * y$$ follows.")).toBeNull();
});
