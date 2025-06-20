// Developed by RJ Nelson
// 6/15/2025

// IMPORTS
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteer.use(StealthPlugin());
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// VARIABLES
const URL =
  "https://www.kickstarter.com/discover/advanced?category_id=3&sort=newest";
const sheetbestUrl =
  "https://api.sheetbest.com/sheets/8450bf12-4a9d-43e5-bc50-8696cc402eb1";

// FUNCTIONS

// LAUNCH BROWSER
const launchBrowser = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: false,
  });

  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "domcontentloaded" });

  console.log("Launched browser");

  return { browser, page };
};

// GET LATEST PROJECT INFO FROM KICKSTARTER
const getProjectInfo = async (page) => {
  const projectData = await page.evaluate(() => {
    const projectCards = document.querySelectorAll(".js-react-proj-card");

    return [...projectCards].map((card) => {
      const projectNameEl = card.querySelector(".project-card__title");
      const creatorNameEl = card.querySelector(
        ".project-card__creator .do-not-visually-track"
      );
      const creatorLinkEl = card.querySelector(".project-card__creator");

      return {
        projectName: projectNameEl?.textContent.trim() || null,
        creatorName: creatorNameEl?.textContent.trim() || null,
        creatorProfile: creatorLinkEl?.href || null,
      };
    });
  });

  return projectData;
};

// GET EXISTING DATA
const fetchExistingSheetData = async () => {
  try {
    const response = await axios.get(sheetbestUrl);
    const rows = response.data;

    if (!rows || rows.length === 0) {
      console.log("ℹ️ No existing data found. First run.");
    }

    return rows || [];
  } catch (error) {
    console.error("❌ Error fetching existing sheet data:", error.message);
    return [];
  }
};

// UPLOAD NEW DATA
const postToSheetBest = async (scrapedData) => {
  const existingRows = await fetchExistingSheetData();

  const normalize = (str) =>
    str?.toLowerCase().replace(/\s+/g, " ").trim() || "";

  const seenKeys = new Set(
    existingRows.map(
      (row) =>
        `${normalize(row["Project Name"])}|${normalize(row["Creator Name"])}`
    )
  );

  const newRows = scrapedData.filter((item) => {
    if (!item.projectName || !item.creatorName) return false; // skip incomplete rows
    const key = `${normalize(item.projectName)}|${normalize(item.creatorName)}`;
    return !seenKeys.has(key);
  });

  if (newRows.length === 0) {
    console.log("🟡 No new unique projects found to upload.");
    return;
  }

  const payload = newRows.map((item) => ({
    Id: uuidv4(),
    "Project Name": item.projectName,
    "Creator Name": item.creatorName,
    "Creator Profile": item.creatorProfile,
    "Scraped At": new Date().toISOString(),
  }));

  try {
    await axios.post(sheetbestUrl, payload, {
      headers: { "Content-Type": "application/json" },
    });
    console.log(`✅ Uploaded ${payload.length} new rows to Google Sheet.`);
  } catch (error) {
    console.error("❌ Upload error:", error.message);
  }
};

// MAIN FUNCTION
const main = async () => {
  const { browser, page } = await launchBrowser();

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const projectData = await getProjectInfo(page);

  await browser.close();

  console.log("HTML content extracted");

  console.log(projectData);

  console.log("Uploading to Sheet.best");

  await postToSheetBest(projectData);

  console.log(`🔍 Scraped ${projectData.length} projects.`);
};

main();