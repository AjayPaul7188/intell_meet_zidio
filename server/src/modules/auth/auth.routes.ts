import express from "express";
import { signUp, login } from "./auth.controller";
import { uploadAvatar } from "./auth.controller";
import { protect } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import { authLimiter } from "../../middleware/rateLimit";

const router = express.Router();

router.post("/signup", authLimiter,  signUp);
router.post("/login", authLimiter,  login);
router.post("/avatar", protect, upload.single("avatar"), uploadAvatar);
// console.log("Auth routes loaded");

export default router;