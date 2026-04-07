import express from "express";
import { create, list } from "./meeting.controller";
import { protect } from "../../middleware/auth.middleware";

const router = express.Router();

router.post("/", protect, create);
router.get("/", protect, list);

export default router;