
import sharp from "sharp";
const m1 = await sharp("C:/Users/Harsh/.gemini/antigravity/brain/df498a11-ceb6-4415-989c-11e230da1b96/.user_uploaded/media_1790701403552.jpg").metadata();
console.log("Image 1:", m1.width, "x", m1.height);
const m2 = await sharp("C:/Users/Harsh/.gemini/antigravity/brain/df498a11-ceb6-4415-989c-11e230da1b96/.user_uploaded/media_1790701411050.jpg").metadata();
console.log("Image 2:", m2.width, "x", m2.height);
const m3 = await sharp("C:/Users/Harsh/.gemini/antigravity/brain/df498a11-ceb6-4415-989c-11e230da1b96/.user_uploaded/media_1790701442207.jpg").metadata();
console.log("Image 3:", m3.width, "x", m3.height);
const m4 = await sharp("C:/Users/Harsh/.gemini/antigravity/brain/df498a11-ceb6-4415-989c-11e230da1b96/.user_uploaded/media_1790701454756.jpg").metadata();
console.log("Image 4:", m4.width, "x", m4.height);

