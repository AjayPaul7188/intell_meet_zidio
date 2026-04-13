import express from "express";
import { transcribeAudio } from "./transcription.controller";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/transcribe", upload.single("file"), transcribeAudio);

export default router;