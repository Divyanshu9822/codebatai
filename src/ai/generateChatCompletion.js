import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const generateChatCompletion = async (messages, model = 'llama3-8b-8192') => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model,
    });

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating chat completion:', error);
    return '';
  }
};
