
import sharp from "sharp";
const meta1 = await sharp("C:/Users/Harsh/.gemini/antigravity/brain/df498a11-ceb6-4415-989c-11e230da1b96/.user_uploaded/media_1790700617175.jpg").metadata();
console.log("Image 1:", meta1.width, "x", meta1.height);
const meta2 = await sharp("C:/Users/Harsh/.gemini/antigravity/brain/df498a11-ceb6-4415-989c-11e230da1b96/.user_uploaded/media_1790700633881.jpg").metadata();
console.log("Image 2:", meta2.width, "x", meta2.height);

