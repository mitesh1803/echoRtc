import 'dotenv/config'
import  {WebSocket}  from 'ws'
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {  Peer, TranscriptChunk } from './types.js';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const send = (socket: WebSocket, data: unknown) => {
  socket.send(JSON.stringify(data));
};
console.log('GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);

export const generateSummary = async (
  transcript: TranscriptChunk[],
  peers: Peer[]
) => {
  try {
    console.log("Hello from gemini")
    const formatted = transcript
      .map(
        c =>
          `[${new Date(c.timestamp).toLocaleTimeString()}] ${c.displayName}: ${c.text}`
      )
      .join('\n');

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

    const prompt = `You are summarizing a video meeting transcript.

Transcript:
${formatted}

Return a JSON object with exactly these keys:
- summary
- keyPoints
- actionItems
- duration

Return only valid JSON.`;

    const result = await model.generateContent(prompt);

    const raw = result.response
      .text()
      .replace(/```json|```/g, '')
      .trim();

    let summary;

    try {
      summary = JSON.parse(raw);
    } catch {
      console.error('Invalid JSON from Gemini');

      summary = {
        summary: 'Meeting completed.',
        keyPoints: ['Transcript processed'],
        actionItems: [],
        duration: 'Unknown',
      };
    }

    peers.forEach(peer => {
      if (peer.socket.readyState === peer.socket.OPEN) {
        send(peer.socket, {
          type: 'callSummary',
          summary,
        });
      }
    });

  } catch (err) {
    console.error('Summary generation failed:', err);

    // fallback summary if Gemini fails completely
    const fallbackSummary = {
      summary: 'AI summary unavailable right now.',
      keyPoints: ['Meeting transcript captured successfully'],
      actionItems: [],
      duration: 'Unknown',
    };

    peers.forEach(peer => {
      if (peer.socket.readyState === peer.socket.OPEN) {
        send(peer.socket, {
          type: 'callSummary',
          summary: fallbackSummary,
        });
      }
    });
  }
};