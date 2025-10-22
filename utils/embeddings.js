const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateEmbeddings = async (text) => {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
      dimensions: 1024,
    });
    return response.data[0].embedding;
  } catch (error) {
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
};

module.exports = {
  generateEmbeddings,
};