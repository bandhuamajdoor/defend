import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
// Exercise dictation controls with a deterministic browser-recognition fixture.
// No microphone is opened and no audio is captured in this test.
await context.addInitScript(() => {
  class Recognition {
    start() {
      window.__recognition = this;
      this.onstart?.();
    }
    stop() {
      this.onend?.();
    }
    abort() {
      this.onend?.();
    }
  }
  Object.defineProperty(window, "SpeechRecognition", {
    value: Recognition,
    configurable: true,
  });
});
const page = await context.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
async function check(name, fn) {
  await fn();
  results.push({ name, result: "passed" });
  console.log(`PASS ${name}`);
}
async function audit(name) {
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  await writeFile(
    `output/playwright/accessibility-${name}.json`,
    JSON.stringify(violations, null, 2),
  );
  expect(violations).toEqual([]);
}
const composer = () => page.getByLabel("YOUR ANSWER", { exact: false });
async function send(text) {
  await expect(composer()).toBeEnabled({ timeout: 20000 });
  await composer().fill(text);
  await composer().press("Control+Enter");
}
try {
  await check(
    "light/dark appearance, persistence and accessibility",
    async () => {
      await page.goto(origin);
      await expect(
        page.getByRole("heading", { name: /Good work deserves/ }),
      ).toBeVisible();
      await page.getByTitle("Change appearance").click();
      await page.getByRole("button", { name: "Light", exact: true }).click();
      await audit("light");
      await page.screenshot({
        path: "output/playwright/overview.png",
        fullPage: true,
      });
      await page.getByTitle("Change appearance").click();
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await audit("dark");
      await page.screenshot({
        path: "output/playwright/overview-dark.png",
        fullPage: true,
      });
    },
  );
  await check("sample consent, source coverage and confirmation", async () => {
    await expect(
      page.getByRole("button", { name: "Try a sample" }),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Try a sample" }).click();
    await expect(
      page.getByRole("heading", { name: "Campus Tickets", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm & start practice" }),
    ).toBeEnabled({ timeout: 20000 });
    await expect(
      page.getByText("6 files indexed", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "output/playwright/project.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Confirm & start practice" })
      .click();
    await expect(composer()).toBeEnabled({ timeout: 20000 });
  });
  await check(
    "bad answer, simulated dictation and lost-response recovery",
    async () => {
      await page.getByRole("button", { name: "Dictate", exact: true }).click();
      await page.evaluate(() =>
        window.__recognition.onresult({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: "I don't know" } }],
        }),
      );
      await expect(composer()).toHaveValue("I don't know");
      let url = new URL(page.url());
      let snapshot = await (
        await context.request.get(
          `${origin}/api/v1/sessions/${url.pathname.split("/")[2]}`,
        )
      ).json();
      expect(snapshot.turns.filter((t) => t.role === "student")).toHaveLength(
        0,
      );
      await page
        .getByRole("button", { name: "Stop listening", exact: true })
        .click();
      await page.route(
        "**/api/v1/sessions/*/answers",
        async (route) => {
          const accepted = await route.fetch();
          expect(accepted.status()).toBe(202);
          await route.abort();
        },
        { times: 1 },
      );
      await composer().press("Control+Enter");
      await expect(
        page.getByRole("heading", { name: /Try a 30-second introduction/ }),
      ).toBeVisible({ timeout: 20000 });
      await expect(composer()).toHaveValue("");
      await expect(
        page.getByText("Let’s strengthen this", { exact: true }),
      ).toBeVisible();
      await page
        .getByText("See one way to structure the answer")
        .last()
        .click();
      await expect(
        page.getByText(/Adapt this to your actual work/).last(),
      ).toBeVisible();
      snapshot = await (
        await context.request.get(
          `${origin}/api/v1/sessions/${url.pathname.split("/")[2]}`,
        )
      ).json();
      expect(snapshot.turns.filter((t) => t.role === "student")).toHaveLength(
        1,
      );
      expect(snapshot.coaching).toHaveLength(1);
    },
  );
  await check(
    "good answer still receives refinement and a conversational next question",
    async () => {
      await send(
        "I built the quantity selector and ticket calculation. The app helps college students book seats.",
      );
      await expect(
        page.getByRole("heading", {
          name: /Walk me through how changing the ticket quantity/,
        }),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByText("That explanation works", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("One more bit of precision", { exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    "reload, pause/resume, wrong claim and a coached revision",
    async () => {
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: /Walk me through how changing the ticket quantity/,
        }),
      ).toBeVisible();
      await expect(page.getByText("I don't know", { exact: true })).toHaveCount(
        1,
      );
      await composer().fill(
        "The total automatically updates on every quantity change.",
      );
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(composer()).toBeDisabled();
      await expect(composer()).toHaveValue(
        "The total automatically updates on every quantity change.",
      );
      await page
        .getByRole("button", { name: "Resume practice", exact: true })
        .click();
      await expect(composer()).toBeEnabled();
      await page.getByRole("button", { name: "Send answer" }).click();
      await expect(
        page.getByRole("heading", { name: /The unit price is 200/ }),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByText(/That claim doesn’t match this sample/),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Inspect the source behind this feedback",
        })
        .last()
        .click();
      await expect(
        page.getByRole("heading", { name: "Source context" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close source context" }).click();
      await send(
        "Quantity changes, but total is initialized only once and becomes stale. I would derive total from quantity and unitPrice, then test the displayed price after an input change.",
      );
      await expect(
        page.getByRole("heading", {
          name: /Choose one implementation decision/,
        }),
      ).toBeVisible({ timeout: 20000 });
      await expect(
        page.getByText(/Tighten the answer by distinguishing/),
      ).toBeVisible();
      await page.screenshot({
        path: "output/playwright/interview-dark.png",
        fullPage: true,
      });
      await audit("conversation");
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "output/playwright/conversation-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1100 });
    },
  );
  await check("specific debrief, export and review receipt", async () => {
    await page.getByRole("button", { name: "End practice" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "End & view report" }).click();
    await expect(
      page.getByRole("heading", { name: /Here’s what to take forward/ }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Demonstrated", { exact: true })).toHaveCount(
      1,
    );
    await expect(page.getByText("Not assessed", { exact: true })).toHaveCount(
      3,
    );
    await expect(
      page.getByText("Guided sample debrief", { exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "JSON", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("defend-report.json");
    await page
      .getByRole("button", { name: "This seems wrong" })
      .first()
      .click();
    await page
      .getByLabel("What needs another look?")
      .fill("Please review the source context.");
    await page.getByRole("button", { name: "Save review request" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Review request recorded",
    );
    await page.screenshot({
      path: "output/playwright/report.png",
      fullPage: true,
    });
  });
  await check("focused retest uses a new scenario", async () => {
    await page.locator(".concept-option input").first().check();
    await page.getByRole("button", { name: "Start focused retest" }).click();
    await expect(
      page.getByRole("heading", { name: /ten times as many users/ }),
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: "End practice" }).click();
    await page.getByRole("button", { name: "End & view report" }).click();
    await expect(
      page.getByRole("heading", { name: /Here’s what to take forward/ }),
    ).toBeVisible({ timeout: 20000 });
  });
  await check(
    "folder upload retains paths and discloses exclusions",
    async () => {
      const fixture = path.resolve("output/playwright/folder-fixture");
      await mkdir(path.join(fixture, "src"), { recursive: true });
      await mkdir(path.join(fixture, "node_modules"), { recursive: true });
      await mkdir(path.join(fixture, "artifacts"), { recursive: true });
      await writeFile(
        path.join(fixture, ".gitignore"),
        "node_modules/\nartifacts/\n*.generated.ts\n",
      );
      await writeFile(
        path.join(fixture, "src", ".gitignore"),
        "!manual.generated.ts\n",
      );
      await writeFile(
        path.join(fixture, "src", "auto.generated.ts"),
        "export const auto = true;",
      );
      await writeFile(
        path.join(fixture, "src", "manual.generated.ts"),
        "export const manual = true;",
      );
      await writeFile(
        path.join(fixture, "artifacts", "compiled.hpp"),
        "// ignored by project rules",
      );
      await writeFile(
        path.join(fixture, "README.md"),
        "# Calculator\nA tiny calculation feature.",
      );
      await writeFile(
        path.join(fixture, "src", "main.ts"),
        "export function twice(n: number) { return n * 2; }",
      );
      await writeFile(path.join(fixture, ".env"), "DUMMY_VALUE=fixture");
      await writeFile(
        path.join(fixture, "node_modules", "generated.ts"),
        "export const generated = true;",
      );
      await page.goto(`${origin}/projects/new`);
      await page.getByLabel("Project name").fill("Folder smoke project");
      await page
        .getByLabel("What does it do?")
        .fill("A calculator that doubles a number.");
      await page
        .getByLabel("What did you work on?")
        .fill("I wrote the pure calculation function.");
      await expect(page.getByLabel("Select project folder")).toBeEnabled();
      await page.getByLabel("Select project folder").setInputFiles(fixture);
      await expect(
        page.getByText("src/main.ts", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("4 files excluded — review before continuing", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Applied 2 .gitignore file(s), including nested rules and ! exceptions.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page
          .locator(".file-list")
          .getByText("src/manual.generated.ts", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator(".file-list")
          .getByText("src/auto.generated.ts", { exact: true }),
      ).toHaveCount(0);
      await page.locator(".upload-exclusions summary").click();
      await expect(
        page.getByText("src/auto.generated.ts · Ignored by .gitignore", {
          exact: true,
        }),
      ).toBeVisible();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Prepare my project" }).click();
      await expect(
        page.getByRole("heading", {
          name: "Folder smoke project",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Confirm & start practice" }),
      ).toBeEnabled({ timeout: 20000 });
    },
  );
  await check(
    "C++ folder keeps original source and skips bundled libraries",
    async () => {
      const fixture = path.resolve("output/playwright/cpp-fixture");
      await mkdir(path.join(fixture, "src"), { recursive: true });
      await mkdir(path.join(fixture, "include", "kv"), { recursive: true });
      await mkdir(path.join(fixture, "include", "asio", "detail"), {
        recursive: true,
      });
      await mkdir(path.join(fixture, "config"), { recursive: true });
      const own = {
        "README.md": "# Storage engine\nA synthetic C++ source upload fixture.",
        ".gitignore": "*.o\n",
        "src/main.cpp":
          '#include "../include/kv/storage_engine.hpp"\nint main() { return storageSize(); }',
        "include/kv/storage_engine.hpp":
          "inline int storageSize() { return 1; }",
        "include/kv/map.tpp":
          "template<class T> T identity(T value) { return value; }",
        Makefile: "all:\n\tc++ src/main.cpp -o app",
        "CMakeLists.txt":
          "cmake_minimum_required(VERSION 3.20)\nproject(storage)",
        "config/db.conf": "port=8080",
        "src/main.o": "ignored object",
      };
      await Promise.all(
        Object.entries(own).map(([name, text]) =>
          writeFile(path.join(fixture, name), text),
        ),
      );
      await Promise.all(
        Array.from({ length: 622 }, (_, i) =>
          writeFile(
            path.join(fixture, "include", "asio", "detail", `header-${i}.hpp`),
            "// bundled fixture",
          ),
        ),
      );
      await page.goto(`${origin}/projects/new`);
      await page.getByLabel("Project name").fill("C++ upload smoke project");
      await page.getByLabel("What does it do?").fill("A C++ storage feature.");
      await page
        .getByLabel("What did you work on?")
        .fill("I wrote the storage engine.");
      await expect(page.getByLabel("Select project folder")).toBeEnabled();
      await page.getByLabel("Select project folder").setInputFiles(fixture);
      await expect(page.getByText(/8 source files selected/)).toBeVisible();
      for (const name of [
        "src/main.cpp",
        "include/kv/storage_engine.hpp",
        "include/kv/map.tpp",
        "Makefile",
        "config/db.conf",
      ])
        await expect(
          page.locator(".file-list").getByText(name, { exact: true }),
        ).toBeVisible();
      await expect(
        page.getByText("623 files excluded — review before continuing", {
          exact: true,
        }),
      ).toBeVisible();
      await writeFile(path.join(fixture, ".gitignore"), "*.o\nsrc/main.cpp\n");
      await page.getByLabel("Select project folder").setInputFiles(fixture);
      await expect(page.getByText(/7 source files selected/)).toBeVisible();
      await expect(
        page.locator(".file-list").getByText("src/main.cpp", { exact: true }),
      ).toHaveCount(0);
      await writeFile(path.join(fixture, ".gitignore"), "*.o\n");
      await page.getByLabel("Select project folder").setInputFiles(fixture);
      await expect(page.getByText(/8 source files selected/)).toBeVisible();
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Prepare my project" }).click();
      await expect(
        page.getByRole("heading", {
          name: "C++ upload smoke project",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Confirm & start practice" }),
      ).toBeEnabled({ timeout: 20000 });
      await expect(
        page.getByText("8 files indexed", { exact: true }),
      ).toBeVisible();
    },
  );
  await check(
    "documentation-only upload requires explicit acknowledgement",
    async () => {
      await page.goto(`${origin}/projects/new`);
      await page.getByLabel("Project name").fill("Documentation only fixture");
      await page
        .getByLabel("What does it do?")
        .fill("Checks limited-context disclosure.");
      await page
        .getByLabel("What did you work on?")
        .fill("I wrote the README.");
      await expect(page.getByLabel("Select project files")).toBeEnabled();
      await page.getByLabel("Select project files").setInputFiles({
        name: "README.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Only documentation"),
      });
      await expect(
        page.getByText("No implementation source is selected.", {
          exact: true,
        }),
      ).toBeVisible();
      await page.getByRole("checkbox", { name: /I agree to store/ }).check();
      await expect(
        page.getByRole("button", { name: "Prepare my project" }),
      ).toBeDisabled();
      await page
        .getByRole("checkbox", {
          name: "Continue with documentation and configuration only",
        })
        .check();
      await expect(
        page.getByRole("button", { name: "Prepare my project" }),
      ).toBeEnabled();
    },
  );
  await check(
    "mobile reflow, free setup and delete-all revokes access",
    async () => {
      await page.goto(`${origin}/settings`);
      await expect(
        page.getByRole("heading", { name: "Connect free AI." }),
      ).toBeVisible();
      await expect(page.locator(".setup-code")).toHaveCount(2);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(origin);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "output/playwright/mobile.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("link", { name: "Privacy & data", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Delete all my data", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete all my data" })
        .click();
      await expect(page).toHaveURL(origin + "/");
      expect(
        (await context.request.get(`${origin}/api/v1/projects`)).status(),
      ).toBe(401);
    },
  );
  expect(errors).toEqual([]);
  await writeFile(
    "output/playwright/results.json",
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        results,
        pageErrors: errors,
        dictation: "Browser recognition was simulated; no microphone used.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({
    path: "output/playwright/failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
