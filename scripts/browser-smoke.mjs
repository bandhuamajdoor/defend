import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "passed" });
  console.log(`PASS ${name}`);
}
try {
  await check("public landing, consent and sample preparation", async () => {
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: /Good work deserves/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Try a sample" }),
    ).toBeDisabled();
    await page.screenshot({
      path: "output/playwright/overview.png",
      fullPage: true,
    });
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations;
    await writeFile(
      "output/playwright/accessibility-overview.json",
      JSON.stringify(violations, null, 2),
    );
    expect(violations).toEqual([]);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Try a sample" }).click();
    await expect(
      page.getByRole("heading", { name: "Campus Tickets", exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole("button", { name: "Confirm & start practice" }),
    ).toBeEnabled({ timeout: 20000 });
    await page.screenshot({
      path: "output/playwright/project.png",
      fullPage: true,
    });
  });
  await check("confirmation and keyboard answer submission", async () => {
    await page
      .getByRole("button", { name: "Confirm & start practice" })
      .click();
    await expect(page.getByLabel("YOUR ANSWER", { exact: false })).toBeEnabled({
      timeout: 20000,
    });
    // Simulate acceptance followed by a lost HTTP response. The UI must recover
    // from canonical state, without losing the accepted answer or duplicating it.
    await page.route(
      "**/api/v1/sessions/*/answers",
      async (route) => {
        const accepted = await route.fetch();
        expect(accepted.status()).toBe(202);
        await route.abort();
      },
      { times: 1 },
    );
    await page
      .getByLabel("YOUR ANSWER", { exact: false })
      .fill(
        "I built the quantity selector and ticket calculation. The app helps college students book seats.",
      );
    await page
      .getByLabel("YOUR ANSWER", { exact: false })
      .press("Control+Enter");
    await expect(
      page.getByRole("heading", { name: /Walk me through what happens/ }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel("YOUR ANSWER", { exact: false })).toHaveValue(
      "",
    );
  });
  await check(
    "accepted answer recovery, pause/resume and source context",
    async () => {
      await page.reload();
      await expect(
        page.getByRole("heading", { name: /Walk me through what happens/ }),
      ).toBeVisible();
      await page.getByText("Conversation so far").click();
      await expect(
        page.getByText(
          "I built the quantity selector and ticket calculation. The app helps college students book seats.",
          { exact: true },
        ),
      ).toBeVisible();
      const draft = page.getByLabel("YOUR ANSWER", { exact: false });
      await draft.fill(
        "I trace the quantity from the input to component state.",
      );
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(draft).toBeDisabled();
      await expect(draft).toHaveValue(
        "I trace the quantity from the input to component state.",
      );
      await page
        .getByRole("button", { name: "Resume practice", exact: true })
        .click();
      await expect(draft).toBeEnabled();
      await page.getByRole("button", { name: "Send answer" }).click();
      await expect(page.getByRole("heading", { name: /You said/ })).toBeVisible(
        { timeout: 20000 },
      );
      await page.screenshot({
        path: "output/playwright/interview.png",
        fullPage: true,
      });
    },
  );
  await check("end dialog, report, export and review request", async () => {
    await page.getByRole("button", { name: "End practice" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "End & view report" }).click();
    await expect(
      page.getByRole("heading", { name: /Here’s what to take forward/ }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Not assessed", { exact: true })).toHaveCount(
      4,
    );
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "JSON", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("defend-report.json");
    await page
      .getByRole("button", { name: "This seems wrong" })
      .first()
      .click();
    await page
      .getByLabel("What needs another look?")
      .fill("Please check the source context before making a claim.");
    await page.getByRole("button", { name: "Save review request" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Review request recorded",
    );
    await page.screenshot({
      path: "output/playwright/report.png",
      fullPage: true,
    });
  });
  await check("focused retest uses a fresh scenario", async () => {
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
  await check("own-project upload and validation", async () => {
    await page.goto(`${origin}/projects/new`);
    await page.getByLabel("Project name").fill("Browser smoke project");
    await page
      .getByLabel("What does it do?")
      .fill("A calculator that doubles a number.");
    await page
      .getByLabel("What did you work on?")
      .fill("I wrote the pure calculation function.");
    await expect(page.getByLabel("Select project files")).toBeEnabled();
    await page.getByLabel("Select project files").setInputFiles({
      name: "main.ts",
      mimeType: "text/plain",
      buffer: Buffer.from("export function twice(n: number) { return n * 2; }"),
    });
    await expect(page.getByText("main.ts", { exact: true })).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Prepare my project" }).click();
    await expect(
      page.getByRole("heading", { name: "Browser smoke project" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirm & start practice" }),
    ).toBeEnabled({ timeout: 20000 });
  });
  await check("mobile reflow and delete-all revokes access", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin);
    await expect(
      page.getByRole("heading", { name: /Good work deserves/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
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
    const response = await context.request.get(`${origin}/api/v1/projects`);
    expect(response.status()).toBe(401);
  });
  expect(errors).toEqual([]);
  await writeFile(
    "output/playwright/results.json",
    JSON.stringify(
      { createdAt: new Date().toISOString(), results, pageErrors: errors },
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
