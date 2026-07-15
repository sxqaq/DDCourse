import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import Home from "../app/page";

test("the complete home screen renders without browser globals", () => {
  const html = renderToString(<Home />);
  assert.match(html, /DDCourse/);
  assert.match(html, /选择课程文件夹/);
});
