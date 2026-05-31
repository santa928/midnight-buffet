import { expect, test, type Locator, type Page } from "@playwright/test";

test("joins two phones, keeps seals private, reveals together and restores the guest seat", async ({
  browser,
  page: host,
}, testInfo) => {
  const guestContext = await browser.newContext({
    viewport: host.viewportSize() ?? { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const guest = await guestContext.newPage();
  const consoleProblems: string[] = [];
  captureConsoleProblems(host, consoleProblems);
  captureConsoleProblems(guest, consoleProblems);

  try {
    await openOnlineEntrance(host, "host");
    await host.getByRole("button", { name: "招待状を作る" }).click();
    await host.getByLabel("幹事の名前").fill("やまだ");
    await host.getByLabel("合言葉").fill("月夜のタルト");
    await host.getByRole("button", { name: "招待状を発行する" }).click();
    const inviteCode = (await host.locator(".invitation-code strong").textContent())?.trim();
    expect(inviteCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);

    await openOnlineEntrance(guest, "guest");
    await guest.getByRole("button", { name: "合言葉で入場" }).click();
    await guest.getByLabel("招待コード").fill(inviteCode ?? "");
    await guest.getByLabel("あなたの名前").fill("さとう");
    await guest.getByLabel("合言葉").fill("月夜のタルト");
    await guest.getByRole("button", { name: "控室へ入る" }).click();

    await expect(host.getByText("さとう")).toBeVisible();
    await expectInsideViewport(host, host.getByTestId("online-panel"));
    await host.screenshot({ path: testInfo.outputPath("online-lobby.png"), fullPage: true });

    await host.getByRole("button", { name: "開宴する" }).click();
    await expect(host.getByTestId("card-hand")).toBeVisible();
    await expect(guest.getByTestId("card-hand")).toBeVisible();
    await expectSelectionAnchors(host);
    await host.screenshot({ path: testInfo.outputPath("online-selection.png"), fullPage: true });

    await host.getByRole("button", { name: "予約札 15", exact: true }).click();
    await host.getByRole("button", { name: "この札を封蝋する" }).click();
    await guest.getByRole("button", { name: "予約札 1", exact: true }).click();
    await guest.getByRole("button", { name: "この札を封蝋する" }).click();

    await expect(host.locator(".seal-status")).toBeVisible();
    await expect(guest.locator(".seal-status")).toBeVisible();
    await expect(host.locator(".seal-status")).not.toContainText("15");
    await expect(guest.locator(".seal-status")).not.toContainText("15");

    await host.getByRole("button", { name: "クロッシュを開ける" }).click();
    await expect(guest.getByLabel("公開された予約札")).toContainText("15");
    const winnerText = await visibleWinnerText(guest);
    expect(winnerText).toMatch(/^(やまだ|さとう) さんが獲得$/);
    await expectInsideViewport(guest, guest.getByTestId("online-panel"));
    await guest.screenshot({ path: testInfo.outputPath("online-reveal.png"), fullPage: true });

    await guest.reload();
    await expect(guest.getByText("席へ戻りました")).toBeVisible();
    await expect(guest.getByText(winnerText)).toBeVisible();
    await guest.screenshot({ path: testInfo.outputPath("online-restored.png"), fullPage: true });
    expect(consoleProblems).toEqual([]);
  } finally {
    await guestContext.close();
  }
});

/** Reads the revealed winner without assuming the first shuffled dish is positive. */
async function visibleWinnerText(page: Page): Promise<string> {
  const heading = page.getByRole("heading", { name: /^(やまだ|さとう) さんが獲得$/ });
  await expect(heading).toBeVisible();
  return (await heading.textContent()) ?? "";
}

/** Enters online mode in an isolated browser identity. */
async function openOnlineEntrance(page: Page, suffix: string): Promise<void> {
  await page.goto(`./?qa=online-${suffix}`);
  await page.getByRole("button", { name: /オンライン祝宴/ }).click();
  await expect(page.getByRole("button", { name: "招待状を作る" })).toBeVisible();
}

/** Verifies a lower invitation panel does not escape the portrait viewport. */
async function expectInsideViewport(page: Page, panel: Locator): Promise<void> {
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 8);
}

/** Verifies the dish stage is separated from the private controls and CTA. */
async function expectSelectionAnchors(page: Page): Promise<void> {
  const stage = await page.getByTestId("dish-stage").boundingBox();
  const hand = await page.getByTestId("card-hand").boundingBox();
  const cta = await page.getByTestId("primary-cta").boundingBox();
  const viewport = page.viewportSize();
  expect(stage).not.toBeNull();
  expect(hand).not.toBeNull();
  expect(cta).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!stage || !hand || !cta || !viewport) return;
  expect(stage.y + stage.height + 12).toBeLessThanOrEqual(hand.y);
  expect(cta.y + cta.height).toBeLessThanOrEqual(viewport.height - 8);
}

/** Records runtime errors and warnings visible to party guests. */
function captureConsoleProblems(page: Page, problems: string[]): void {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
}
