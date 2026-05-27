import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const jobs = [
  {
    input: "assets/source/banquet-stage-source.png",
    output: "public/assets/backgrounds/banquet-stage.webp",
    width: 780,
    quality: 72,
  },
  {
    input: "assets/source/jewel-strawberry-tart.png",
    output: "public/assets/dishes/jewel-strawberry-tart.webp",
    width: 720,
    quality: 80,
  },
];

await mkdir("public/assets/backgrounds", { recursive: true });
await mkdir("public/assets/dishes", { recursive: true });

for (const job of jobs) {
  const result = await sharp(job.input)
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: job.quality, effort: 6 })
    .toFile(job.output);

  console.log(`${job.output}: ${result.size} bytes`);
}
