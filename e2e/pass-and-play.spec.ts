import { expect, test, type Page } from "@playwright/test";

test("keeps online banquet disabled when Supabase config is absent", async ({ page }, testInfo) => {
  await page.goto("./?qa=offline-only-pages");

  await expect(page.getByRole("button", { name: /この端末で遊ぶ/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /オンライン祝宴/ })).toBeDisabled();
  await expect(page.getByText("Vercel版で開場予定")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("offline-only-entrance.png"), fullPage: true });
});

test("keeps local setup instructions and actions inside the viewport", async ({ page }, testInfo) => {
  await page.goto("./?qa=setup-layout");
  await page.getByRole("button", { name: /この端末で遊ぶ/ }).click();
  await expect(page.getByRole("heading", { name: "遊び方" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("setup-layout.png"), fullPage: true });

  const start = await page.getByRole("button", { name: "祝宴を始める" }).boundingBox();
  const back = await page.getByRole("button", { name: "入口へ戻る" }).boundingBox();
  const viewport = page.viewportSize();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );

  expect(start).not.toBeNull();
  expect(back).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!start || !back || !viewport) return;

  expect(start.y + start.height).toBeLessThanOrEqual(viewport.height - 8);
  expect(back.y + back.height).toBeLessThanOrEqual(viewport.height - 4);
  expect(hasHorizontalOverflow).toBe(false);
});

test("plays a full short feast without exposing sealed reservations", async ({ page }, testInfo) => {
  test.slow();
  await page.goto("./?qa=initial-release-1");
  await page.getByRole("button", { name: /この端末で遊ぶ/ }).click();
  await page.getByLabel("プレイヤー 1 の名前").fill("あおい");
  await page.getByLabel("プレイヤー 2 の名前").fill("れん");
  await page.getByRole("button", { name: "祝宴を始める" }).click();

  await expect(page.getByText("次は あおい さん")).toBeVisible();
  await expect(page.getByRole("button", { name: "予約札 9" })).toHaveCount(0);

  for (let round = 0; round < 9; round += 1) {
    await chooseCard(page, 9 - round);
    await expect(page.getByText("次は れん さん")).toBeVisible();
    await expect(page.getByRole("button", { name: `予約札 ${9 - round}`, exact: true })).toHaveCount(0);
    await chooseCard(page, 1 + round);
    await expect(page.getByRole("button", { name: "クロッシュを開ける" })).toBeVisible();

    await clickVisibleButton(page, "クロッシュを開ける");
    if (round === 0) {
      await page.screenshot({ path: testInfo.outputPath("reveal.png"), fullPage: true });
    }
    if (round < 8) {
      await clickVisibleButton(page, "次の皿へ");
    } else {
      await expect(page.getByText(/さんが獲得|この皿は未配膳/)).toBeVisible();
      await clickVisibleButton(page, "結果を見る");
    }
  }

  await expect(page.getByText("今宵の表彰")).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度乾杯" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("results.png"), fullPage: true });
  await clickVisibleButton(page, "もう一度乾杯");
  await expect(page.getByText("次は あおい さん")).toBeVisible();
});

test("keeps the dish stage and private controls separated inside the viewport", async ({ page }, testInfo) => {
  await page.goto("./?qa=layout-check");
  await page.getByRole("button", { name: /この端末で遊ぶ/ }).click();
  await page.getByLabel("プレイヤー 1 の名前").fill("あおい");
  await page.getByLabel("プレイヤー 2 の名前").fill("れん");
  await page.getByRole("button", { name: "祝宴を始める" }).click();
  await openHand(page);
  await page.screenshot({ path: testInfo.outputPath("selection-layout.png"), fullPage: true });

  const stage = await page.getByTestId("dish-stage").boundingBox();
  const hand = await page.getByTestId("card-hand").boundingBox();
  const cta = await page.getByTestId("primary-cta").boundingBox();
  const viewport = page.viewportSize();
  const lastCard = page.getByRole("button", { name: "予約札 9", exact: true });
  const firstCard = page.getByRole("button", { name: "予約札 1", exact: true });

  expect(stage).not.toBeNull();
  expect(hand).not.toBeNull();
  expect(cta).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (!stage || !hand || !cta || !viewport) {
    return;
  }
  expect(stage.y + stage.height + 12).toBeLessThanOrEqual(hand.y);
  expect(hand.x + hand.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(cta.y + cta.height).toBeLessThanOrEqual(viewport.height - 8);

  await lastCard.scrollIntoViewIfNeeded();
  const visibleLastCard = await lastCard.boundingBox();
  expect(visibleLastCard).not.toBeNull();
  if (visibleLastCard) {
    expect(visibleLastCard.x).toBeGreaterThanOrEqual(8);
    expect(visibleLastCard.x + visibleLastCard.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(visibleLastCard.y + visibleLastCard.height).toBeLessThanOrEqual(cta.y - 8);
    expect(visibleLastCard.height).toBeGreaterThanOrEqual(88);
  }

  await expectCardCenterReceivesPointer(page, firstCard, "予約札 1");
  await expectCardCenterReceivesPointer(page, lastCard, "予約札 9");
});

async function chooseCard(page: Page, value: number): Promise<void> {
  await openHand(page);
  await clickVisibleButton(page, `予約札 ${value}`);
  await clickVisibleButton(page, "この札を封蝋する");
}

async function openHand(page: Page): Promise<void> {
  await clickVisibleButton(page, "手札を開く");
  await expect(page.getByTestId("card-hand")).toBeVisible();
}

async function clickVisibleButton(page: Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  await button.dispatchEvent("click");
}

async function expectCardCenterReceivesPointer(
  page: Page,
  card: ReturnType<Page["getByRole"]>,
  label: string,
): Promise<void> {
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const hitLabel = await page.evaluate(
    ({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return target?.closest("button")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(hitLabel).toContain(label.replace("予約札 ", ""));
}
