export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  mongoUri: process.env.MONGO_URI || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
};
