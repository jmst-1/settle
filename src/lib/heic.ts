import sharp from "sharp";

export async function toJpegBuffer(input: Buffer, filename = "", mime = "") {
  const heic = /\.hei[cf]$/i.test(filename) || mime.includes("heic") || mime.includes("heif");
  try {
    const img = sharp(input, { failOn: "none" });
    if (heic) {
      return await img.rotate().jpeg({ quality: 88 }).toBuffer();
    }
    const meta = await img.metadata();
    if (meta.format && meta.format !== "jpeg") {
      return await img.rotate().jpeg({ quality: 88 }).toBuffer();
    }
    return await img.rotate().jpeg({ quality: 88 }).toBuffer();
  } catch {
    return input;
  }
}
