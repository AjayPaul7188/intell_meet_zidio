import { Request, Response } from "express";
import fs from "fs";
import { handleTranscription } from "./transcription.service";

export const transcribeAudio = async (req: Request, res: Response) => {
  try {
    const filePath = req.file?.path;

    if (!filePath) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const text = await handleTranscription(filePath);

    fs.unlinkSync(filePath); // cleanup

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Transcription failed" });
  }
};