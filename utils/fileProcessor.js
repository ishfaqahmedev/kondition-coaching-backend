const fs = require("fs").promises;
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const getFileType = (filename) => {
  const extension = filename.split(".").pop().toLowerCase();
  return extension;
};

const extractTextFromFile = async (filePath, mimetype) => {
  try {
    if (mimetype === "application/pdf") {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimetype === "text/plain") {
      return await fs.readFile(filePath, "utf8");
    } else {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }
  } catch (error) {
    throw new Error(`Failed to extract text: ${error.message}`);
  }
};

const chunkText = (text, chunkSize = 1000, overlap = 200) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);

    if (end === text.length) break;
    start = end - overlap;
  }

  return chunks;
};

module.exports = {
  getFileType,
  extractTextFromFile,
  chunkText,
};